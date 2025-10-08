from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from faker import Faker
import random
from datetime import date, timedelta
from academics.models import Exam, ExamResult, Student, Class, Subject
from accounts.models import School

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed exam results data - creates exams and results for students'

    def add_arguments(self, parser):
        parser.add_argument(
            '--exams-per-class',
            type=int,
            default=3,
            help='Number of exams per class (default: 3)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing exam and result data before seeding'
        )
        # Optional: force the term sequence for exams, e.g. "2,2,3"
        parser.add_argument(
            '--force-terms',
            type=str,
            default='',
            help='Comma-separated list of term numbers to cycle through when creating exams (e.g., "2,2,3"). If omitted, terms are random.'
        )
        # Optional: exclude subject codes from result creation (e.g., PPI)
        parser.add_argument(
            '--exclude-subject-codes',
            type=str,
            default='',
            help='Comma-separated subject codes to exclude from results (e.g., "PPI,ART").'
        )
        # Optional: constrain marks to a percentage range of total marks
        parser.add_argument(
            '--marks-min',
            type=float,
            default=None,
            help='Minimum percentage for marks (e.g., 40 for 40%). If not set, random performance distribution is used.'
        )
        parser.add_argument(
            '--marks-max',
            type=float,
            default=None,
            help='Maximum percentage for marks (e.g., 96 for 96%). If not set, random performance distribution is used.'
        )
        # Optional: force total marks for created exams (default: random choice)
        parser.add_argument(
            '--total-marks',
            type=int,
            default=None,
            help='Set a fixed total_marks value for all created exams (e.g., 100).'
        )

    def handle(self, *args, **options):
        fake = Faker()
        Faker.seed(42)
        random.seed(42)

        exams_per_class = options['exams_per_class']
        clear_data = options['clear']
        force_terms_raw = options.get('force_terms') or ''
        exclude_codes_raw = options.get('exclude_subject_codes') or ''
        marks_min = options.get('marks_min')
        marks_max = options.get('marks_max')
        forced_total_marks = options.get('total_marks')

        # Normalize optional args
        force_terms = []
        if force_terms_raw.strip():
            try:
                force_terms = [int(x.strip()) for x in force_terms_raw.split(',') if x.strip()]
                # Keep only valid terms 1..3
                force_terms = [t for t in force_terms if t in (1, 2, 3)]
            except Exception:
                force_terms = []
        exclude_codes = set([c.strip().upper() for c in exclude_codes_raw.split(',') if c.strip()]) if exclude_codes_raw else set()

        # Validate marks bounds
        if (marks_min is not None and marks_max is None) or (marks_max is not None and marks_min is None):
            raise SystemExit('--marks-min and --marks-max must be provided together')
        if marks_min is not None and marks_max is not None:
            if marks_min < 0 or marks_max > 100 or marks_min > marks_max:
                raise SystemExit('--marks-min/max must satisfy 0 <= min <= max <= 100')

        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing exam and result data...'))
            ExamResult.objects.all().delete()
            Exam.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('✓ Data cleared.'))

        # Get all schools
        schools = list(School.objects.all())
        if not schools:
            self.stdout.write(self.style.ERROR('No schools found. Please run seed_data first.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {len(schools)} schools'))

        # Exam types/names
        exam_types = [
            'Mid-Term Exam',
            'End of Term Exam',
            'CAT 1',
            'CAT 2',
            'Mock Exam',
            'Final Exam',
            'Monthly Test',
            'Weekly Quiz',
        ]

        current_year = date.today().year
        terms = [1, 2, 3]

        total_exams_created = 0
        total_results_created = 0

        self.stdout.write(self.style.SUCCESS('Creating exams and results...'))

        for school in schools:
            # Get all classes for this school
            classes = list(Class.objects.filter(school=school).prefetch_related('subjects'))
            
            if not classes:
                self.stdout.write(self.style.WARNING(f'No classes found for {school.name}'))
                continue

            self.stdout.write(f'\nProcessing {school.name}...')

            for klass in classes:
                # Get subjects for this class
                subjects = list(klass.subjects.all())
                
                if not subjects:
                    self.stdout.write(self.style.WARNING(f'  No subjects for {klass.name}'))
                    continue

                # Get students in this class
                students = list(Student.objects.filter(klass=klass))
                
                if not students:
                    self.stdout.write(self.style.WARNING(f'  No students in {klass.name}'))

                # Create exams for this class
                for i in range(exams_per_class):
                    # Random exam type
                    exam_name = random.choice(exam_types)

                    # Term selection: force sequence when provided, else random
                    if force_terms:
                        term = force_terms[i % len(force_terms)]
                    else:
                        term = random.choice(terms)
                    year = random.choice([current_year - 1, current_year])

                    # Random date within the term (past dates)
                    days_ago = random.randint(1, 180)
                    exam_date = date.today() - timedelta(days=days_ago)

                    # Total marks (usually 100, but can vary) or forced
                    total_marks = forced_total_marks if forced_total_marks is not None else random.choice([50, 100, 150, 200])
                    
                    # Randomly decide if exam is published
                    published = random.choice([True, True, True, False])  # 75% published
                    published_at = timezone.now() if published else None

                    try:
                        # Create exam
                        exam = Exam.objects.create(
                            name=exam_name,
                            year=year,
                            term=term,
                            klass=klass,
                            date=exam_date,
                            total_marks=total_marks,
                            published=published,
                            published_at=published_at,
                        )
                        total_exams_created += 1

                        # Create results for each student in each subject
                        for student in students:
                            for subject in subjects:
                                # Skip excluded subjects by code (e.g., PPI)
                                if exclude_codes and str(getattr(subject, 'code', '')).upper() in exclude_codes:
                                    continue
                                # Generate realistic marks based on different performance levels
                                if marks_min is not None and marks_max is not None:
                                    # Constrain to percentage window
                                    lo = (marks_min / 100.0) * float(total_marks)
                                    hi = (marks_max / 100.0) * float(total_marks)
                                    marks = random.uniform(lo, hi)
                                else:
                                    performance_level = random.choices(
                                        ['excellent', 'good', 'average', 'below_average', 'poor'],
                                        weights=[0.15, 0.25, 0.35, 0.15, 0.10]
                                    )[0]
                                    if performance_level == 'excellent':
                                        # 80-100% of total marks
                                        marks = random.uniform(0.80 * total_marks, total_marks)
                                    elif performance_level == 'good':
                                        # 65-79% of total marks
                                        marks = random.uniform(0.65 * total_marks, 0.79 * total_marks)
                                    elif performance_level == 'average':
                                        # 50-64% of total marks
                                        marks = random.uniform(0.50 * total_marks, 0.64 * total_marks)
                                    elif performance_level == 'below_average':
                                        # 35-49% of total marks
                                        marks = random.uniform(0.35 * total_marks, 0.49 * total_marks)
                                    else:  # poor
                                        # 0-34% of total marks
                                        marks = random.uniform(0, 0.34 * total_marks)
                                # Round to 1 decimal place
                                marks = round(marks, 1)

                                # Some students might be absent (no result)
                                if random.random() > 0.95:  # 5% absence rate
                                    continue

                                # Create result
                                ExamResult.objects.create(
                                    exam=exam,
                                    student=student,
                                    subject=subject,
                                    marks=marks,
                                )
                                total_results_created += 1

                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  ✓ Created {exam_name} for {klass.name} '
                                f'({len(students)} students × {len(subjects)} subjects)'
                            )
                        )

                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f'  ✗ Error creating exam for {klass.name}: {str(e)}')
                        )

        self.stdout.write(self.style.SUCCESS('\n✓ Results seeding completed successfully!'))
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(self.style.SUCCESS(f'  - Exams Created: {total_exams_created}'))
        self.stdout.write(self.style.SUCCESS(f'  - Results Created: {total_results_created}'))
        
        # Calculate statistics
        published_count = Exam.objects.filter(published=True).count()
        unpublished_count = Exam.objects.filter(published=False).count()
        
        self.stdout.write(self.style.SUCCESS(f'\nExam Status Breakdown:'))
        self.stdout.write(self.style.SUCCESS(f'  - Published: {published_count}'))
        self.stdout.write(self.style.SUCCESS(f'  - Unpublished: {unpublished_count}'))
        
        # Average marks statistics
        from django.db.models import Avg
        avg_marks = ExamResult.objects.aggregate(Avg('marks'))['marks__avg']
        if avg_marks:
            self.stdout.write(self.style.SUCCESS(f'\nPerformance Statistics:'))
            self.stdout.write(self.style.SUCCESS(f'  - Average Marks: {avg_marks:.2f}'))
