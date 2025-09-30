from rest_framework import serializers
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id','invoice','amount','method','reference','attachment','invoice_id','created_at','recorded_by']

class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ['id','name','description','school']
        read_only_fields = ['school']

class ClassFeeSerializer(serializers.ModelSerializer):
    fee_category_detail = FeeCategorySerializer(source='fee_category', read_only=True)
    # Read-only textual representation of the class (uses __str__ of Class)
    klass_detail = serializers.CharField(source='klass.__str__', read_only=True)
    # Optional write-only field to support assigning the same fee to multiple classes at once
    klasses = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, allow_empty=False
    )
    class Meta:
        model = ClassFee
        fields = ['id','fee_category','fee_category_detail','klass','klass_detail','klasses','amount','year','term','due_date','created_at']

class InvoiceSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    category_detail = FeeCategorySerializer(source='category', read_only=True)
    class Meta:
        model = Invoice
        fields = ['id','student','amount','status','category','category_detail','year','term','mpesa_transaction_id','due_date','created_at','payments']

class MpesaConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaConfig
        fields = [
            'id', 'school', 'consumer_key', 'consumer_secret', 'short_code',
            'passkey', 'callback_url', 'environment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['school', 'created_at', 'updated_at']
        extra_kwargs = {
            'consumer_secret': {'write_only': True},
            'passkey': {'write_only': True},
        }
