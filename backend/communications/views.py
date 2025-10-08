from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from django.db.models import Sum, F, Value, DecimalField
from django.db.models.functions import Coalesce
from .models import Notification, Event
from .serializers import NotificationSerializer, EventSerializer, ArrearsMessageCampaignSerializer
from .models import ArrearsMessageCampaign, Message, MessageRecipient
from .serializers import MessageSerializer
from academics.models import Student
from .utils import render_template, send_sms, send_email_safe, process_arrears_campaign, queue_message_delivery
import threading
from django.utils import timezone
from django.conf import settings

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # user sees own notifications
        qs = super().get_queryset()
        return qs.filter(user=self.request.user)

class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.all()
        # Restrict to user's school
        if getattr(user, 'school_id', None):
            qs = qs.filter(school_id=user.school_id)
        else:
            # No school assigned -> empty set
            qs = qs.none()

        # Optional filtering by date overlap
        start_param = self.request.query_params.get('start')
        end_param = self.request.query_params.get('end')
        start_dt = parse_datetime(start_param) if start_param else None
        end_dt = parse_datetime(end_param) if end_param else None
        if start_dt and end_dt:
            # events that overlap [start_dt, end_dt]
            qs = qs.filter(~(Q(end__lt=start_dt) | Q(start__gt=end_dt)))
        elif start_dt:
            qs = qs.filter(end__gte=start_dt)
        elif end_dt:
            qs = qs.filter(start__lte=end_dt)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(school=getattr(user, 'school', None), created_by=user)

    @action(detail=True, methods=['patch'], url_path='update-fields')
    def update_fields(self, request, pk=None):
        """Convenience partial-update endpoint that ignores non-editable fields."""
        instance = self.get_object()
        data = request.data.copy()
        # Protect non-editable fields via this action
        for k in ['school', 'created_by', 'created_at', 'updated_at', 'id']:
            data.pop(k, None)
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class ArrearsMessageCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = ArrearsMessageCampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ArrearsMessageCampaign.objects.all()
        # Scope to user's school
        if getattr(user, 'school_id', None):
            qs = qs.filter(school_id=user.school_id)
        else:
            qs = qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(school=getattr(user, 'school', None), created_by=user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        campaign = self.get_object()
        # Mark queued/running and spawn background thread
        if campaign.status in [ArrearsMessageCampaign.Status.RUNNING]:
            return Response({'detail': 'Campaign already running.'}, status=status.HTTP_409_CONFLICT)
        campaign.status = ArrearsMessageCampaign.Status.QUEUED
        campaign.started_at = timezone.now()
        campaign.sent_count = 0
        campaign.error_message = ''
        campaign.save(update_fields=['status','started_at','sent_count','error_message'])

        t = threading.Thread(target=process_arrears_campaign, args=(campaign.id,), daemon=True)
        t.start()

        return Response({'status': 'queued', 'id': campaign.id}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        campaign = self.get_object()
        data = ArrearsMessageCampaignSerializer(campaign).data
        return Response(data)


class MessageViewSet(viewsets.ModelViewSet):
    """Inbox-focused messages. Default list() returns current user's inbox.
    Additional actions:
     - outbox: list messages sent by current user
     - mark-read: mark a message as read for current user
    Create enforces role-based targeting rules (also in serializer).
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Inbox: messages where user is a recipient
        return Message.objects.filter(
            recipients__user_id=user.id
        ).select_related('sender').prefetch_related('recipients').order_by('-created_at', 'id')

    def perform_create(self, serializer):
        # serializer handles school, sender, recipients
        msg = serializer.save()
        # Queue async delivery to email/SMS
        if getattr(settings, 'MESSAGES_QUEUE_DELIVERY', True):
            try:
                queue_message_delivery(msg.id)
            except Exception:
                pass

    @action(detail=False, methods=['get'], url_path='system')
    def system(self, request):
        """Return system-tagged messages for the current user's inbox (system_tag not null)."""
        user = request.user
        qs = Message.objects.filter(
            recipients__user_id=user.id,
            system_tag__isnull=False,
        ).select_related('sender').prefetch_related('recipients').order_by('-created_at','id')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=['get'])
    def outbox(self, request):
        user = request.user
        qs = Message.objects.filter(sender_id=user.id).select_related('sender').prefetch_related('recipients').order_by('-created_at', 'id')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        user = request.user
        try:
            mr = MessageRecipient.objects.get(message_id=pk, user_id=user.id)
        except MessageRecipient.DoesNotExist:
            return Response({'detail': 'Not a recipient'}, status=status.HTTP_404_NOT_FOUND)
        if not mr.read:
            mr.read = True
            mr.read_at = timezone.now()
            mr.save(update_fields=['read', 'read_at'])
        return Response({'detail': 'ok'})
