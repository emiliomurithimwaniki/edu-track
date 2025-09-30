from django.contrib import admin
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "amount", "status", "due_date", "created_at")
    list_filter = ("status", "due_date")
    search_fields = ("student__name", "student__admission_no", "mpesa_transaction_id")

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "amount", "method", "reference", "created_at", "recorded_by")
    list_filter = ("method", "created_at")
    search_fields = ("invoice__student__name", "reference")

@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school")
    search_fields = ("name",)
    list_filter = ("school",)

@admin.register(ClassFee)
class ClassFeeAdmin(admin.ModelAdmin):
    list_display = ("id", "fee_category", "klass", "year", "term", "amount", "due_date")
    list_filter = ("year", "term", "fee_category", "klass")

@admin.register(MpesaConfig)
class MpesaConfigAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "short_code", "environment", "updated_at")
    list_filter = ("environment", "school")
    search_fields = ("school__name", "short_code")
