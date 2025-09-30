from django.core.mail import send_mail, EmailMessage
from django.conf import settings
import logging
from datetime import datetime
from django.db import transaction
import threading
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import ssl_  # type: ignore
from urllib3.util.retry import Retry  # type: ignore
import ssl as pyssl
from django.utils import timezone
import phonenumbers

logger = logging.getLogger(__name__)


class TLSv1_2HttpAdapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        ctx = ssl_.create_urllib3_context()
        try:
            ctx.minimum_version = pyssl.TLSVersion.TLSv1_2
        except Exception:
            pass
        pool_kwargs["ssl_context"] = ctx
        return super().init_poolmanager(connections, maxsize, block, **pool_kwargs)

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        ctx = ssl_.create_urllib3_context()
        try:
            ctx.minimum_version = pyssl.TLSVersion.TLSv1_2
        except Exception:
            pass
        proxy_kwargs["ssl_context"] = ctx
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def render_template(template: str, context: dict) -> str:
    msg = template or ''
    # Very simple placeholder replacement
    for key, val in (context or {}).items():
        msg = msg.replace(f'{{{key}}}', str(val))
    return msg


def _send_sms_via_at_rest(username: str, api_key: str, phone: str, message: str, sender: str | None) -> bool:
    """Send SMS using Africa's Talking REST API directly.
    This is used to circumvent the WhatsApp sandbox initialization error in the SDK.
    """
    try:
        base = "https://api.sandbox.africastalking.com" if username.lower() == "sandbox" else "https://api.africastalking.com"
        url = f"{base}/version1/messaging"
        data = {
            "username": username,
            "to": phone,
            "message": message,
        }
        if sender:
            # Optional short code or sender ID
            data["from"] = sender
        headers = {
            "apiKey": api_key,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "edutrack/1.0 (+requests)",
        }

        # Prepare a TLS 1.2-enforced adapter and small retry policy (adapter defined top-level)

        retries = Retry(total=2, backoff_factor=0.5, status_forcelist=(429, 500, 502, 503, 504))

        # Use a session that ignores environment proxies to avoid system/corporate proxy TLS downgrades
        with requests.Session() as s:
            s.trust_env = False  # ignore HTTP(S)_PROXY, NO_PROXY, etc.
            s.mount("https://", TLSv1_2HttpAdapter(max_retries=retries))
            try:
                resp = s.post(url, data=data, headers=headers, timeout=20)
                resp.raise_for_status()
            except requests.exceptions.SSLError:
                # Guarded fallback: try once with certificate verification disabled, using a fresh session
                logger.warning("SSL handshake to Africa's Talking failed; retrying once with verify=False")
                with requests.Session() as s2:
                    s2.trust_env = False
                    resp = s2.post(url, data=data, headers=headers, timeout=20, verify=False)
                    resp.raise_for_status()

        payload = resp.json() if resp.headers.get("Content-Type", "").startswith("application/json") else json.loads(resp.text)
        recipients = (payload or {}).get('SMSMessageData', {}).get('Recipients', [])
        if recipients:
            status = recipients[0].get('status', '').lower()
            if 'success' in status:
                logger.info("SMS sent via AT REST -> %s: %s", phone, status)
                return True
        logger.warning("AT REST response did not confirm success: %s", payload)
        return False
    except Exception:
        logger.exception("Failed to send SMS via AT REST to %s", phone)
        return False


def send_sms(phone: str, message: str) -> bool:
    """
    Send SMS via Africa's Talking. Returns True if accepted for delivery.
    Uses sandbox or live based on credentials in settings.
    """
    if not phone or not message:
        return False
    at_username = getattr(settings, 'AT_USERNAME', None)
    at_api_key = getattr(settings, 'AT_API_KEY', None)
    at_sender = getattr(settings, 'AT_SENDER_ID', None) or None
    if not at_username or not at_api_key:
        logger.warning("Africa's Talking credentials missing; skipping SMS to %s", phone)
        return False
    # Normalize phone into E.164 if possible (defaults to KE)
    try:
        region = 'KE'
        if phone and not phone.startswith('+'):
            parsed = phonenumbers.parse(phone, region)
        else:
            parsed = phonenumbers.parse(phone)
        if phonenumbers.is_valid_number(parsed):
            phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    try:
        # If sandbox, use REST directly to avoid Whatsapp sandbox error in SDK
        if str(at_username).lower() == 'sandbox':
            return _send_sms_via_at_rest(at_username, at_api_key, phone, message, at_sender)

        # Import lazily to avoid hard dependency when not configured
        import africastalking  # type: ignore
        africastalking.initialize(at_username, at_api_key)
        sms = africastalking.SMS
        # Africa's Talking expects list of recipients
        resp = sms.send(message, [phone], at_sender) if at_sender else sms.send(message, [phone])
        # Basic acceptance check
        recipients = (resp or {}).get('SMSMessageData', {}).get('Recipients', [])
        if recipients:
            status = recipients[0].get('status', '').lower()
            if 'success' in status:
                logger.info("SMS sent via AT -> %s: %s", phone, status)
                return True
        logger.warning("AT SDK response did not confirm success: %s", resp)
        return False
    except Exception as e:
        # If the SDK fails due to WhatsApp sandbox limitation, fall back to REST
        if 'Sandbox is currently not available for this service' in str(e):
            logger.warning("AT SDK raised WhatsApp sandbox error; falling back to REST")
            return _send_sms_via_at_rest(at_username, at_api_key, phone, message, at_sender)
        logger.exception("Failed to send SMS via Africa's Talking to %s", phone)
        return False


def send_email_safe(subject: str, message: str, recipient: str) -> bool:
    if not recipient:
        return False
    try:
        host_user = getattr(settings, 'EMAIL_HOST_USER', '')
        host_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        if not host_user or not host_pass:
            logger.warning("Email credentials missing; skipping email to %s", recipient)
            return False
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', host_user or 'no-reply@example.com')
        sent = send_mail(subject or 'Notification', message, from_email, [recipient], fail_silently=False)
        return sent > 0
    except Exception as e:
        logger.exception("Failed to send email to %s: %s", recipient, e)
        return False


def send_email_with_attachment(subject: str, message: str, recipient: str, filename: str, content: bytes, mimetype: str = 'application/pdf') -> bool:
    """Send an email with a single attachment. Returns False on error."""
    if not recipient:
        return False
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@example.com')
        email = EmailMessage(subject or 'Notification', message or '', from_email, [recipient])
        if content is not None:
            email.attach(filename or 'attachment.pdf', content, mimetype or 'application/octet-stream')
        email.send(fail_silently=True)
        return True
    except Exception as e:
        logger.exception("Failed to send email with attachment to %s: %s", recipient, e)
        return False
def process_arrears_campaign(campaign_id: int):
    """Background task: processes an arrears campaign by sending messages via selected channels.
    Updates campaign status, timestamps, counts, and error message on failure.
    """
    from django.db.models import Sum, F, Value, DecimalField
    from django.db.models.functions import Coalesce
    from .models import ArrearsMessageCampaign, Notification
    from academics.models import Student
    try:
        # Mark campaign as running
        with transaction.atomic():
            campaign = ArrearsMessageCampaign.objects.select_for_update().get(pk=campaign_id)
            campaign.status = ArrearsMessageCampaign.Status.RUNNING
            campaign.started_at = timezone.now()
            campaign.error_message = ''
            campaign.sent_count = 0
            campaign.save(update_fields=['status', 'started_at', 'error_message', 'sent_count'])

        students = Student.objects.filter(klass__school_id=campaign.school_id)
        if campaign.klass_id:
            students = students.filter(klass_id=campaign.klass_id)

        # Compute balances
        students = students.annotate(
            billed=Coalesce(Sum('invoice__amount'), Value(0, output_field=DecimalField(max_digits=10, decimal_places=2))),
            paid=Coalesce(Sum('invoice__payments__amount'), Value(0, output_field=DecimalField(max_digits=10, decimal_places=2)))
        ).annotate(balance=F('billed') - F('paid')).filter(balance__gte=campaign.min_balance)

        notifications = []
        # Prepare personalized chat messages: list of (user_id, body)
        personalized_pairs = []
        count = 0
        sms_sent = 0
        sms_failed = 0
        email_sent = 0
        email_failed = 0
        for stu in students.select_related('user', 'klass'):
            klass_name = getattr(getattr(stu, 'klass', None), 'name', '')
            context = {
                'student_name': getattr(stu, 'name', ''),
                'class': klass_name,
                'balance': getattr(stu, 'balance', ''),
            }
            msg = render_template(campaign.message, context)

            # In-app
            # Queue in-app notification if enabled
            if campaign.send_in_app and getattr(stu, 'user_id', None):
                notifications.append(Notification(user_id=stu.user_id, message=msg, type='in_app'))
                count += 1

            # Always mirror to chat for any student that has a linked user
            if getattr(stu, 'user_id', None):
                personalized_pairs.append((stu.user_id, msg))

            # SMS
            if campaign.send_sms:
                phone = getattr(stu, 'phone', None) or getattr(getattr(stu, 'user', None), 'phone', None)
                if phone:
                    ok = False
                    try:
                        ok = send_sms(phone, msg)
                    except Exception:
                        logger.exception("send_sms crashed for %s", phone)
                        ok = False
                    if ok:
                        sms_sent += 1
                        count += 1
                    else:
                        sms_failed += 1

            # Email
            if campaign.send_email:
                recipient = getattr(stu, 'email', None) or getattr(getattr(stu, 'user', None), 'email', None)
                if recipient:
                    ok = False
                    try:
                        ok = send_email_safe(campaign.email_subject or 'School Fees Arrears', msg, recipient)
                    except Exception:
                        logger.exception("send_email_safe crashed for %s", recipient)
                        ok = False
                    if ok:
                        email_sent += 1
                        count += 1
                    else:
                        email_failed += 1

        if notifications:
            Notification.objects.bulk_create(notifications)

        # Also create chat messages (personalized per recipient) so these announcements appear in the unified Messages UI
        try:
            if personalized_pairs:
                # Resolve a valid sender id (fallback to any admin in school if created_by is missing)
                sender_id = getattr(campaign.created_by, 'id', None) or resolve_default_sender_id(campaign.school_id)
                if sender_id:
                    create_personalized_messages_for_users(
                        school_id=campaign.school_id,
                        sender_id=sender_id,
                        user_body_pairs=personalized_pairs,
                        system_tag='arrears',
                    )
        except Exception:
            logger.exception("Failed to mirror arrears campaign to chat messages")

        # Mark as completed
        with transaction.atomic():
            campaign = ArrearsMessageCampaign.objects.select_for_update().get(pk=campaign_id)
            campaign.sent_count = count
            campaign.sms_sent = sms_sent
            campaign.sms_failed = sms_failed
            campaign.email_sent = email_sent
            campaign.email_failed = email_failed
            campaign.status = ArrearsMessageCampaign.Status.COMPLETED
            campaign.finished_at = timezone.now()
            campaign.save(update_fields=['sent_count', 'sms_sent', 'sms_failed', 'email_sent', 'email_failed', 'status', 'finished_at'])
    except Exception as e:
        logger.exception("Arrears campaign %s failed", campaign_id)
        try:
            # Update failure status
            campaign = ArrearsMessageCampaign.objects.get(pk=campaign_id)
            campaign.status = ArrearsMessageCampaign.Status.FAILED
            campaign.error_message = str(e)
            campaign.finished_at = timezone.now()
            campaign.save(update_fields=['status', 'error_message', 'finished_at'])
        except Exception:
            pass


def process_message_delivery(message_id: int):
    """Background task: forwards a Message to all recipients via SMS and Email.
    Uses user.phone and user.email if available. Errors are logged and do not stop delivery to others.
    """
    from .models import Message, MessageRecipient
    try:
        msg = Message.objects.select_related('sender', 'school').get(pk=message_id)
        # Iterate recipients
        recipients = (
            MessageRecipient.objects
            .filter(message_id=msg.id)
            .select_related('user')
        )
        sent_sms = 0
        sent_email = 0
        subject = f"New message from {getattr(msg.sender, 'username', 'user')}"
        for r in recipients:
            u = r.user
            if not u:
                continue
            # SMS
            phone = getattr(u, 'phone', '')
            if phone:
                try:
                    if send_sms(phone, msg.body):
                        sent_sms += 1
                except Exception:
                    logger.exception("Failed to SMS user %s", getattr(u, 'id', ''))
            # Email
            email = getattr(u, 'email', '')
            if email:
                try:
                    if send_email_safe(subject, msg.body, email):
                        sent_email += 1
                except Exception:
                    logger.exception("Failed to email user %s", getattr(u, 'id', ''))
        logger.info("Message %s delivery complete: email=%s sms=%s", message_id, sent_email, sent_sms)
    except Exception:
        logger.exception("Message delivery %s failed", message_id)


def queue_message_delivery(message_id: int):
    """Spawn a daemon thread to process message delivery asynchronously."""
    t = threading.Thread(target=process_message_delivery, args=(message_id,), daemon=True)
    t.start()


def create_messages_for_users(school_id: int, sender_id: int, body: str, recipient_user_ids: list[int], system_tag: str | None = None):
    """Create Message rows (one per recipient) and associated MessageRecipient rows.
    This mirrors system notifications (like arrears) into the chat so they appear in the Messages UI.
    Also queues email/SMS delivery for each created message.
    """
    from .models import Message, MessageRecipient
    if not recipient_user_ids:
        return 0
    created = 0
    for uid in recipient_user_ids:
        try:
            msg = Message.objects.create(
                school_id=school_id,
                sender_id=sender_id,
                body=body,
                audience=Message.Audience.USERS,
                system_tag=system_tag,
            )
            MessageRecipient.objects.create(message=msg, user_id=uid)
            try:
                queue_message_delivery(msg.id)
            except Exception:
                pass
            created += 1
        except Exception:
            logger.exception("Failed to create chat message for user %s", uid)
    return created


def create_personalized_messages_for_users(school_id: int, sender_id: int, user_body_pairs: list[tuple[int, str]], system_tag: str | None = None):
    """Create per-user Message with its own body and queue delivery. user_body_pairs: [(user_id, body), ...]"""
    from .models import Message, MessageRecipient
    created = 0
    for uid, body in user_body_pairs:
        try:
            msg = Message.objects.create(
                school_id=school_id,
                sender_id=sender_id,
                body=body,
                audience=Message.Audience.USERS,
            )
            MessageRecipient.objects.create(message=msg, user_id=uid)
            try:
                queue_message_delivery(msg.id)
            except Exception:
                pass
            created += 1
        except Exception:
            logger.exception("Failed to create personalized chat message for user %s", uid)
    return created


def create_message_for_role(school_id: int, sender_id: int, body: str, role: str):
    """Create a single Message targeted to a role and materialize recipients.
    Returns the created Message id or None.
    """
    from django.contrib.auth import get_user_model
    from .models import Message, MessageRecipient
    User = get_user_model()
    # Create a role-audience message (will be materialized here too)
    msg = Message.objects.create(
        school_id=school_id,
        sender_id=sender_id,
        body=body,
        audience=Message.Audience.ROLE,
        recipient_role=role,
    )
    # Materialize recipients (same-school, same role)
    recipients_qs = User.objects.filter(school_id=school_id, role=role)
    recs = [MessageRecipient(message=msg, user=u) for u in recipients_qs]
    if recs:
        MessageRecipient.objects.bulk_create(recs, ignore_conflicts=True)
    try:
        queue_message_delivery(msg.id)
    except Exception:
        pass
    return msg.id


def resolve_default_sender_id(school_id: int):
    """Return a valid sender user id from the given school (admin/staff preferred)."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u = (User.objects.filter(school_id=school_id, role='admin').first()
         or User.objects.filter(school_id=school_id, is_staff=True).first()
         or User.objects.filter(school_id=school_id).first())
    return getattr(u, 'id', None)


def create_broadcast_message(school_id: int, sender_id: int, body: str):
    """Create a broadcast message to everyone in the school and materialize recipients."""
    from django.contrib.auth import get_user_model
    from .models import Message, MessageRecipient
    User = get_user_model()
    msg = Message.objects.create(
        school_id=school_id,
        sender_id=sender_id,
        body=body,
        audience=Message.Audience.ALL,
    )
    recipients_qs = User.objects.filter(school_id=school_id)
    recs = [MessageRecipient(message=msg, user=u) for u in recipients_qs]
    if recs:
        MessageRecipient.objects.bulk_create(recs, ignore_conflicts=True)
    try:
        queue_message_delivery(msg.id)
    except Exception:
        pass
    return msg.id
