from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import NotificationViewSet, EventViewSet, ArrearsMessageCampaignViewSet, MessageViewSet, ATSMSCallbackView

router = DefaultRouter()
router.register('notifications', NotificationViewSet, basename='notification')
router.register('events', EventViewSet, basename='event')
router.register('arrears-campaigns', ArrearsMessageCampaignViewSet, basename='arrears-campaign')
router.register('messages', MessageViewSet, basename='message')

urlpatterns = router.urls + [
    # Africa's Talking SMS delivery/inbound callbacks
    path('at/sms/callback/', ATSMSCallbackView.as_view(), name='at-sms-callback'),
]
