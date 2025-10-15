from django.core.mail import send_mail, EmailMessage
from django.conf import settings
import logging
from datetime import datetime
from django.db import transaction
import threading
import json
import requests
import os
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

        # Determine verification and proxy behavior from settings
        ca_bundle = getattr(settings, 'AT_CA_BUNDLE', '') or ''
        verify_param = ca_bundle if ca_bundle else True
        trust_env = getattr(settings, 'AT_TRUST_ENV', False)

        # Use a session and honor configured proxy trust and CA bundle
        with requests.Session() as s:
            s.trust_env = bool(trust_env)
            s.mount("https://", TLSv1_2HttpAdapter(max_retries=retries))
            try:
                resp = s.post(url, data=data, headers=headers, timeout=20, verify=verify_param)
                resp.raise_for_status()
            except requests.exceptions.SSLError:
                # Guarded fallback: try once with certificate verification disabled, using a fresh session
                logger.warning("SSL handshake to Africa's Talking failed; retrying once with verify=False")
                with requests.Session() as s2:
                    s2.trust_env = bool(trust_env)
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
    # Immediate loopback: if SMS_LOOPBACK is enabled, do not attempt any network calls
    if getattr(settings, 'SMS_LOOPBACK', False):
        logger.info("SMS_LOOPBACK enabled: simulating SMS send to %s", phone)
        return True

    at_username = getattr(settings, 'AT_USERNAME', None)
    at_api_key = getattr(settings, 'AT_API_KEY', None)
    at_sender = getattr(settings, 'AT_SENDER_ID', None) or None
    if not at_username or not at_api_key:
        logger.warning("Africa's Talking credentials missing; skipping SMS to %s", phone)
        return False
    # Normalize phone into E.164 if possible (defaults to KE)
    # Normalize and validate phone (default region KE)
    valid_number = False
    try:
        region = 'KE'
        parsed = phonenumbers.parse(phone, region) if (phone and not phone.startswith('+')) else phonenumbers.parse(phone)
        if phonenumbers.is_valid_number(parsed):
            phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            valid_number = True
    except Exception:
        valid_number = False
    if not valid_number:
        # If loopback is enabled, simulate success to avoid blocking user flows in dev/demo
        if getattr(settings, 'SMS_LOOPBACK', False):
            logger.info("SMS_LOOPBACK enabled: accepting invalid phone '%s' as sent", phone)
            return True
        logger.warning("SMS not sent: invalid phone '%s' and SMS_LOOPBACK is disabled", phone)
        return False
    try:
        use_rest_pref = getattr(settings, 'AT_USE_REST_FOR_SANDBOX', True)
        is_sandbox = str(at_username).lower() == 'sandbox'

        # Strategy on sandbox:
        # - If AT_USE_REST_FOR_SANDBOX True: try REST first, then SDK fallback on SSL/proxy errors
        # - If False: try SDK first, then REST fallback
        if is_sandbox:
            if use_rest_pref:
                ok = _send_sms_via_at_rest(at_username, at_api_key, phone, message, at_sender)
                if ok:
                    return True
                # Fallback to SDK once
                try:
                    # Avoid system proxies for SDK if AT_TRUST_ENV is False (prevents TLS interception issues)
                    _old_env = {}
                    if not getattr(settings, 'AT_TRUST_ENV', False):
                        for k in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy','NO_PROXY','no_proxy'):
                            if k in os.environ:
                                _old_env[k] = os.environ.pop(k)
                    import africastalking  # type: ignore
                    africastalking.initialize(at_username, at_api_key)
                    sms = africastalking.SMS
                    resp = sms.send(message, [phone], at_sender) if at_sender else sms.send(message, [phone])
                    recipients = (resp or {}).get('SMSMessageData', {}).get('Recipients', [])
                    if recipients and 'success' in (recipients[0].get('status','').lower()):
                        logger.info("SMS sent via AT SDK fallback -> %s", phone)
                        return True
                except Exception:
                    logger.exception("AT SDK fallback failed on sandbox")
                finally:
                    # Restore proxies
                    try:
                        for k, v in (_old_env.items() if '_old_env' in locals() else []):
                            os.environ[k] = v
                    except Exception:
                        pass
                return False
            else:
                # Prefer SDK first
                try:
                    _old_env = {}
                    if not getattr(settings, 'AT_TRUST_ENV', False):
                        for k in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy','NO_PROXY','no_proxy'):
                            if k in os.environ:
                                _old_env[k] = os.environ.pop(k)
                    import africastalking  # type: ignore
                    africastalking.initialize(at_username, at_api_key)
                    sms = africastalking.SMS
                    resp = sms.send(message, [phone], at_sender) if at_sender else sms.send(message, [phone])
                    recipients = (resp or {}).get('SMSMessageData', {}).get('Recipients', [])
                    if recipients and 'success' in (recipients[0].get('status','').lower()):
                        logger.info("SMS sent via AT SDK (sandbox) -> %s", phone)
                        return True
                except Exception as e:
                    # Known WhatsApp sandbox error or TLS anomalies -> fallback to REST
                    logger.warning("AT SDK on sandbox error; falling back to REST: %s", e)
                finally:
                    try:
                        for k, v in (_old_env.items() if '_old_env' in locals() else []):
                            os.environ[k] = v
                    except Exception:
                        pass
                return _send_sms_via_at_rest(at_username, at_api_key, phone, message, at_sender)

        # Live mode: use official SDK
        # If a custom CA bundle is provided, propagate it to requests used by the SDK
        ca_bundle = getattr(settings, 'AT_CA_BUNDLE', '') or ''
        if ca_bundle and not os.environ.get('REQUESTS_CA_BUNDLE'):
            os.environ['REQUESTS_CA_BUNDLE'] = ca_bundle
        # Live: ensure proxies are cleared if AT_TRUST_ENV=False
        _old_env = {}
        if not getattr(settings, 'AT_TRUST_ENV', False):
            for k in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy','NO_PROXY','no_proxy'):
                if k in os.environ:
                    _old_env[k] = os.environ.pop(k)
        import africastalking  # type: ignore
        africastalking.initialize(at_username, at_api_key)
        sms = africastalking.SMS
        resp = sms.send(message, [phone], at_sender) if at_sender else sms.send(message, [phone])
        recipients = (resp or {}).get('SMSMessageData', {}).get('Recipients', [])
        if recipients:
            status = recipients[0].get('status', '').lower()
            if 'success' in status:
                logger.info("SMS sent via AT (live) -> %s: %s", phone, status)
                return True
        logger.warning("AT SDK (live) response did not confirm success: %s", resp)
        return False
    except Exception:
        logger.exception("Failed to send SMS via Africa's Talking to %s", phone)
        # Final guard: allow loopback to simulate success in dev
        if getattr(settings, 'SMS_LOOPBACK', False):
            logger.info("SMS_LOOPBACK enabled: simulating success for %s after failure", phone)
            return True
        return False
    finally:
        # Restore proxies for live path if we cleared them
        try:
            for k, v in (_old_env.items() if '_old_env' in locals() else []):
                os.environ[k] = v
        except Exception:
            pass


def send_email_safe(subject: str, message: str, recipient: str) -> bool:
    if not recipient:
        return False
    host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    host_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    if not host_user or not host_pass:
        logger.warning("Email credentials missing; skipping email to %s", recipient)
        return False
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', host_user or 'no-reply@example.com')

    # 1) Try using current Django settings (usually TLS on 587)
    try:
        sent = send_mail(subject or 'Notification', message, from_email, [recipient], fail_silently=False)
        if sent > 0:
            return True
    except Exception as e:
        logger.warning("Primary SMTP send failed (TLS/port from settings): %s", e)

    # 2) Fallback: explicit TLS on 587 using a new connection
    try:
        from django.core.mail import get_connection
        conn = get_connection(
            host=getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com'),
            port=int(getattr(settings, 'EMAIL_PORT', 587) or 587),
            username=host_user,
            password=host_pass,
            use_tls=True,
            use_ssl=False,
            timeout=20,
        )
        conn.open()
        try:
            email = EmailMessage(subject or 'Notification', message or '', from_email, [recipient], connection=conn)
            email.send(fail_silently=False)
            return True
        finally:
            try:
                conn.close()
            except Exception:
                pass
    except Exception as e:
        logger.warning("SMTP TLS fallback failed: %s", e)

    # 3) Final fallback: SSL on 465 (useful when 587 is blocked or intercepted)
    try:
        from django.core.mail import get_connection
        conn = get_connection(
            host=getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com'),
            port=465,
            username=host_user,
            password=host_pass,
            use_tls=False,
            use_ssl=True,
            timeout=20,
        )
        conn.open()
        try:
            email = EmailMessage(subject or 'Notification', message or '', from_email, [recipient], connection=conn)
            email.send(fail_silently=False)
            return True
        finally:
            try:
                conn.close()
            except Exception:
                pass
    except Exception as e:
        logger.exception("All SMTP attempts failed for %s: %s", recipient, e)
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

        # Compute balances per student using Subqueries to avoid join multiplication between invoices and payments
        from django.db.models import OuterRef, Subquery
        from finance.models import Invoice, Payment
        billed_sq = (
            Invoice.objects
            .filter(student_id=OuterRef('pk'))
            .values('student_id')
            .annotate(s=Sum('amount'))
            .values('s')[:1]
        )
        paid_sq = (
            Payment.objects
            .filter(invoice__student_id=OuterRef('pk'))
            .values('invoice__student_id')
            .annotate(s=Sum('amount'))
            .values('s')[:1]
        )
        students = students.annotate(
            billed=Coalesce(Subquery(billed_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
            paid=Coalesce(Subquery(paid_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
        ).annotate(balance=F('billed') - F('paid'))
        # Enforce strictly positive balances: do not notify 0 or negative
        try:
            threshold = float(getattr(campaign, 'min_balance', 0) or 0)
        except Exception:
            threshold = 0.0
        if threshold < 0:
            threshold = 0.0
        students = students.filter(balance__gt=threshold)

        notifications = []
        # Prepare personalized chat messages only if in-app is selected
        personalized_pairs = [] if campaign.send_in_app else None
        count = 0
        sms_sent = 0
        sms_failed = 0
        email_sent = 0
        email_failed = 0
        for stu in students.select_related('user', 'klass'):
            klass_name = getattr(getattr(stu, 'klass', None), 'name', '')
            currency = getattr(settings, 'CURRENCY', 'KES')
            try:
                balance_val = float(getattr(stu, 'balance', 0) or 0)
            except Exception:
                balance_val = 0.0
            balance_str = f"{balance_val:,.2f}"
            context = {
                'student_name': getattr(stu, 'name', ''),
                'class': klass_name,
                'balance': balance_str,
                'balance_formatted': f"{currency} {balance_str}",
                'currency': currency,
            }
            msg = render_template(campaign.message, context)
            tpl = campaign.message or ''
            if ('{balance' not in tpl) and ('{balance_formatted' not in tpl):
                msg = f"{msg} Outstanding balance: {currency} {balance_str}."

            # In-app
            # Queue in-app notification if enabled
            if campaign.send_in_app and getattr(stu, 'user_id', None):
                notifications.append(Notification(user_id=stu.user_id, message=msg, type='in_app'))
                count += 1

            # Mirror to chat only when in-app selected, so it shows in Messages UI
            if campaign.send_in_app and getattr(stu, 'user_id', None) and personalized_pairs is not None:
                personalized_pairs.append((stu.user_id, msg))

            # SMS: send ONLY to guardian phone
            if campaign.send_sms:
                phone = getattr(stu, 'guardian_id', None)
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
                        queue_delivery=False,  # do not trigger email/SMS from chat mirror; channels are independent
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


def deliver_message_collect(message_id: int) -> dict:
    """Synchronously deliver a message via SMS and Email and return per-channel results.
    Returns dict like:
    {
      'message_id': int,
      'in_app': {'created': True},
      'sms': [{'user_id': int, 'phone': str, 'ok': bool}],
      'email': [{'user_id': int, 'email': str, 'ok': bool}],
    }
    Does not raise; logs errors and marks ok=False when applicable.
    """
    from .models import Message, MessageRecipient
    results = {
        'message_id': message_id,
        'in_app': {'created': False},
        'sms': [],
        'email': [],
    }
    try:
        msg = Message.objects.select_related('sender', 'school').get(pk=message_id)
        # If recipients exist, we consider in-app as created (Message + MessageRecipient rows)
        has_recipients = MessageRecipient.objects.filter(message_id=msg.id).exists()
        results['in_app']['created'] = has_recipients

        # Iterate recipients and attempt channel deliveries, collecting outcome
        recipients = (
            MessageRecipient.objects
            .filter(message_id=msg.id)
            .select_related('user')
        )
        subject = f"New message from {getattr(msg.sender, 'username', 'user')}"
        for r in recipients:
            u = r.user
            if not u:
                continue
            # SMS
            phone = getattr(u, 'phone', '')
            if phone:
                ok_sms = False
                try:
                    ok_sms = send_sms(phone, msg.body)
                except Exception:
                    logger.exception("Failed to SMS user %s", getattr(u, 'id', ''))
                    ok_sms = False
                results['sms'].append({'user_id': getattr(u, 'id', None), 'phone': phone, 'ok': bool(ok_sms)})

            # Email
            email = getattr(u, 'email', '')
            if email:
                ok_email = False
                try:
                    ok_email = send_email_safe(subject, msg.body, email)
                except Exception:
                    logger.exception("Failed to email user %s", getattr(u, 'id', ''))
                    ok_email = False
                results['email'].append({'user_id': getattr(u, 'id', None), 'email': email, 'ok': bool(ok_email)})
    except Exception:
        logger.exception("deliver_message_collect failed for message %s", message_id)
    return results


def create_messages_for_users(school_id: int, sender_id: int, body: str, recipient_user_ids: list[int], system_tag: str | None = None, *, queue_delivery: bool = True):
    """Create Message rows (one per recipient) and associated MessageRecipient rows.
    Mirrors notifications into the chat so they appear in the Messages UI.
    When queue_delivery is True (default), also queue email/SMS delivery for each created message.
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
            if queue_delivery:
                try:
                    queue_message_delivery(msg.id)
                except Exception:
                    pass
            created += 1
        except Exception:
            logger.exception("Failed to create chat message for user %s", uid)
    return created


def create_personalized_messages_for_users(school_id: int, sender_id: int, user_body_pairs: list[tuple[int, str]], system_tag: str | None = None, *, queue_delivery: bool = True):
    """Create per-user Message with its own body. user_body_pairs: [(user_id, body), ...].
    When queue_delivery is True (default), queues email/SMS delivery for each created message.
    """
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
            if queue_delivery:
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


def notify_enrollment(student) -> bool:
    """Send notifications after successful enrollment (Student creation).
    Attempts SMS, email, in-app Notification, and mirrors to chat Messages if a linked user exists.
    """
    try:
        from .models import Notification
        # Build context
        student_name = getattr(student, 'name', 'Student')
        klass_name = getattr(getattr(student, 'klass', None), 'name', '')
        school = getattr(getattr(student, 'klass', None), 'school', None)
        school_id = getattr(school, 'id', None)
        body = f"Welcome {student_name}! You have been enrolled{(' to ' + klass_name) if klass_name else ''}."

        # In-app notification
        if getattr(student, 'user_id', None):
            try:
                Notification.objects.create(user_id=student.user_id, message=body, type='in_app')
            except Exception:
                pass

        # Mirror to chat
        sender_id = resolve_default_sender_id(school_id) if school_id else None
        if sender_id and getattr(student, 'user_id', None):
            try:
                create_messages_for_users(
                    school_id=school_id,
                    sender_id=sender_id,
                    body=body,
                    recipient_user_ids=[student.user_id],
                    system_tag='enrollment',
                )
            except Exception:
                pass

        # SMS -> guardian phone only
        phone = getattr(student, 'guardian_id', None)
        if phone:
            try:
                send_sms(phone, body)
            except Exception:
                pass

        # Email
        recipient = getattr(student, 'email', None) or getattr(getattr(student, 'user', None), 'email', None)
        if recipient:
            try:
                subj = f"Enrollment Confirmation{(' - ' + getattr(school,'name','')) if school else ''}"
                send_email_safe(subj, body, recipient)
            except Exception:
                pass
        return True
    except Exception:
        logger.exception("notify_enrollment failed for student %s", getattr(student, 'id', None))
        return False


def notify_payment_received(invoice, payment) -> bool:
    """Notify student on payment received and updated balance.
    Sends SMS, Email, in-app Notification and chat mirror where possible.
    """
    try:
        from django.db.models import Sum
        from .models import Notification
        student = getattr(invoice, 'student', None)
        if not student:
            return False
        school = getattr(getattr(student, 'klass', None), 'school', None)
        school_id = getattr(school, 'id', None)
        # Compute updated totals
        totals = invoice.payments.aggregate(s=Sum('amount'))
        total_paid = float(totals.get('s') or 0)
        total_billed = float(getattr(invoice, 'amount', 0) or 0)
        balance = round(total_billed - total_paid, 2)

        amt = float(getattr(payment, 'amount', 0) or 0)
        method = getattr(payment, 'method', 'payment')
        ref = getattr(payment, 'reference', '')
        student_name = getattr(student, 'name', 'Student')
        body = (
            f"Payment received: {amt:.2f} via {method}" + (f" (Ref: {ref})" if ref else "") +
            f". Invoice #{invoice.id}. New balance: {balance:.2f}."
        )

        # In-app notification
        if getattr(student, 'user_id', None):
            try:
                Notification.objects.create(user_id=student.user_id, message=body, type='in_app')
            except Exception:
                pass

        # Mirror to chat
        sender_id = resolve_default_sender_id(school_id) if school_id else None
        if sender_id and getattr(student, 'user_id', None):
            try:
                create_messages_for_users(
                    school_id=school_id,
                    sender_id=sender_id,
                    body=body,
                    recipient_user_ids=[student.user_id],
                    system_tag='payment',
                )
            except Exception:
                pass

        # SMS -> guardian phone only
        phone = getattr(student, 'guardian_id', None)
        if phone:
            try:
                send_sms(phone, body)
            except Exception:
                pass

        # Email
        recipient = getattr(student, 'email', None) or getattr(getattr(student, 'user', None), 'email', None)
        if recipient:
            try:
                subj = f"Fee payment received - Invoice {invoice.id}"
                send_email_safe(subj, body, recipient)
            except Exception:
                pass
        return True
    except Exception:
        logger.exception("notify_payment_received failed for invoice %s payment %s", getattr(invoice, 'id', None), getattr(payment, 'id', None))
        return False


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
