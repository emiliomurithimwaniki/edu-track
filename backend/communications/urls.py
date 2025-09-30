from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, EventViewSet, ArrearsMessageCampaignViewSet, MessageViewSet

router = DefaultRouter()
router.register('notifications', NotificationViewSet, basename='notification')
router.register('events', EventViewSet, basename='event')
router.register('arrears-campaigns', ArrearsMessageCampaignViewSet, basename='arrears-campaign')
router.register('messages', MessageViewSet, basename='message')

urlpatterns = router.urls
