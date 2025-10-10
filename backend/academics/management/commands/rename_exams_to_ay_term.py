from django.core.management.base import BaseCommand
from django.utils import timezone
from academics.models import Exam, AcademicYear

class Command(BaseCommand):
    help = "Rename all exams to '<AcademicYear.label> - Term <term>' (fallback '<year> - Term <term>') based on exam.date and class school."

    def handle(self, *args, **options):
        updated = 0
        for e in Exam.objects.select_related('klass', 'klass__school').all():
            try:
                ay_label = None
                if e.date and e.klass and e.klass.school_id:
                    ay = AcademicYear.objects.filter(
                        school_id=e.klass.school_id,
                        start_date__lte=e.date,
                        end_date__gte=e.date,
                    ).first()
                    if ay:
                        ay_label = ay.label
                base_label = ay_label or (str(e.year).strip() if e.year else '')
                if base_label:
                    target = f"{base_label} - Term {e.term}"
                    if e.name != target:
                        e.name = target
                        e.save(update_fields=['name'])
                        updated += 1
            except Exception as ex:
                self.stderr.write(self.style.ERROR(f"Failed to rename exam {e.id}: {ex}"))
        self.stdout.write(self.style.SUCCESS(f"Done. Updated {updated} exams."))
