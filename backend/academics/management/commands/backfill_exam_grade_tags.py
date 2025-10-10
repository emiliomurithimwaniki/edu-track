from django.core.management.base import BaseCommand
from academics.models import Exam, Class

class Command(BaseCommand):
    help = "Backfill Exam.grade_level_tag for existing exams using the current class grade level (best-effort)."

    def handle(self, *args, **options):
        updated = 0
        skipped = 0
        for exam in Exam.objects.all().select_related('klass'):
            try:
                if not getattr(exam, 'grade_level_tag', ''):
                    gl = None
                    if getattr(exam, 'klass', None) and getattr(exam.klass, 'grade_level', None):
                        # Normalize using Class.format_grade_level
                        gl = Class.format_grade_level(exam.klass.grade_level)
                    if gl:
                        exam.grade_level_tag = gl
                        exam.save(update_fields=['grade_level_tag'])
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Failed to update exam {getattr(exam,'id',None)}: {e}"))
        self.stdout.write(self.style.SUCCESS(f"Backfill complete. Updated: {updated}, Skipped: {skipped}"))
