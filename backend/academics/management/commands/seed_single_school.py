from django.core.management.base import BaseCommand
from django.core.management import call_command

class Command(BaseCommand):
    help = "Fresh seed for exactly ONE school with all entities (streams, classes, subjects, teachers, students). This will clear existing data created by the seeder."

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, default='Riverside Academy', help='School display name')
        parser.add_argument('--code', type=str, default='SCH001', help='Unique school code')
        parser.add_argument('--streams', type=int, default=2, help='Streams per school (e.g., 2 -> A, B)')
        parser.add_argument('--teachers', type=int, default=30, help='Teachers per school')
        parser.add_argument('--students', type=int, default=400, help='Students per school (distributed across classes)')

    def handle(self, *args, **opts):
        # Reuse seed_data but constrain to 1 school and override first school name/code afterwards
        # seed_data creates schools with default list; we'll immediately rename the first one.
        self.stdout.write(self.style.WARNING('This will clear existing seeded data (schools/classes/teachers/students/subjects)'))
        # Run base seeder for exactly one school
        call_command('seed_data', schools=1, teachers_per_school=opts['teachers'], students_per_school=opts['students'], streams_per_school=opts['streams'])

        # Rename/normalize the single school to requested name/code
        from accounts.models import School
        from academics.models import Subject
        s = School.objects.order_by('id').first()
        if s:
            # If code already in use and different, keep existing to preserve uniqueness
            s.name = opts['name'] or s.name
            if not School.objects.exclude(pk=s.pk).filter(code=opts['code']).exists():
                s.code = opts['code']
            s.save(update_fields=['name','code'])
            # Also rename subject codes to use the final school code prefix
            for subj in Subject.objects.filter(school=s):
                try:
                    suffix = subj.code.split('-', 1)[-1]
                    new_code = f"{s.code}-{suffix}"
                    if subj.code != new_code:
                        # ensure uniqueness
                        if not Subject.objects.exclude(pk=subj.pk).filter(code=new_code).exists():
                            subj.code = new_code
                            subj.save(update_fields=['code'])
                except Exception:
                    continue
        self.stdout.write(self.style.SUCCESS('Single-school seed completed.'))
