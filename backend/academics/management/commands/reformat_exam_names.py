from django.core.management.base import BaseCommand
from academics.models import Exam

class Command(BaseCommand):
    help = "Reformat all exam names to '<BaseName> Term <term> <year>' preserving the base name (e.g., 'Opener Term 3 2025')."

    def handle(self, *args, **options):
        updated = 0
        for e in Exam.objects.all():
            try:
                # Trigger model save() logic which formats the name accordingly
                e.save(update_fields=['name'])
                updated += 1
            except Exception as ex:
                self.stderr.write(self.style.ERROR(f"Failed to reformat exam {e.id}: {ex}"))
        self.stdout.write(self.style.SUCCESS(f"Done. Reformatted {updated} exams."))
