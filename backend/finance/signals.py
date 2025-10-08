from django.db.models.signals import post_save
from django.dispatch import receiver

from academics.models import Student
from .models import PocketMoneyWallet


@receiver(post_save, sender=Student)
def ensure_wallet_for_student(sender, instance: Student, created, **kwargs):
    """Always ensure a PocketMoneyWallet exists for each student.
    - On creation: create with 0 balance if missing.
    - On updates: also ensure it exists in case of historical data.
    """
    try:
        PocketMoneyWallet.objects.get_or_create(student=instance, defaults={"balance": 0})
    except Exception:
        # Best-effort; avoid breaking student save
        pass
