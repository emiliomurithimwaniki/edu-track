from django.core.management.base import BaseCommand
from django.db import transaction

from academics.models import Student
from finance.models import PocketMoneyWallet


class Command(BaseCommand):
    help = "Create PocketMoneyWallet (balance=0) for all students lacking one. Safe to run multiple times."

    def handle(self, *args, **options):
        created = 0
        with transaction.atomic():
            for s in Student.objects.all().only('id'):
                obj, was_created = PocketMoneyWallet.objects.get_or_create(student=s, defaults={'balance': 0})
                if was_created:
                    created += 1
        self.stdout.write(self.style.SUCCESS(f"Backfill complete. Created {created} wallets."))
