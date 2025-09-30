from django.contrib import admin
from .models import Notification, Event, ArrearsMessageCampaign, Message, MessageRecipient

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "date", "read")
    list_filter = ("type", "read", "date")
    search_fields = ("user__username", "message")

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "school", "start", "end", "all_day", "audience", "visibility")
    list_filter = ("school", "audience", "visibility", "all_day", "start")
    search_fields = ("title", "description", "location", "school__name")
    ordering = ("start",)

@admin.register(ArrearsMessageCampaign)
class ArrearsMessageCampaignAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "klass", "min_balance", "sent_count", "created_by", "created_at")
    list_filter = ("school", "klass")
    search_fields = ("message", "school__name")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "sender", "audience", "recipient_role", "created_at")
    list_filter = ("school", "audience", "recipient_role")
    search_fields = ("body", "sender__username", "school__name")
    date_hierarchy = "created_at"


@admin.register(MessageRecipient)
class MessageRecipientAdmin(admin.ModelAdmin):
    list_display = ("id", "message", "user", "read", "read_at")
    list_filter = ("read",)
    search_fields = ("message__body", "user__username")
