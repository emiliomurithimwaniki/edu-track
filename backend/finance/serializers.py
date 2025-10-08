from rest_framework import serializers
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig, ExpenseCategory, Expense, PocketMoneyWallet, PocketMoneyTransaction

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
        fields = ['id','student','amount','status','category','category_detail','year','term','mpesa_transaction_id','due_date','created_at','payments']

class MpesaConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaConfig
        fields = '__all__'


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'


class PocketMoneyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PocketMoneyTransaction
        fields = '__all__'


class PocketMoneyWalletSerializer(serializers.ModelSerializer):
    transactions = PocketMoneyTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = PocketMoneyWallet
        fields = '__all__'
