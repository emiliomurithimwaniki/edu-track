from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta
from academics.models import Exam, ExamResult, Student, Class, Subject
import random
from django.db import transaction

class Command(BaseCommand):
    help = 'Seed exactly 3 common exams (one per term) for all classes and results for all students'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, default=date.today().year)
        parser.add_argument('--total-marks', type=int, default=100)
        parser.add_argument('--publish', action='store_true')
        parser.add_argument('--unpublish', action='store_true')
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--school', type=str, default='', help='Limit to a specific school code')
        parser.add_argument('--max-classes', type=int, default=0, help='Limit number of classes processed (0 = no limit)')
        parser.add_argument('--max-students', type=int, default=0, help='Limit number of students per class (0 = no limit)')
        parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for bulk create of results')
        parser.add_argument('--skip-if-exists', action='store_true', help='Skip creating results if exam already has results')
        parser.add_argument('--exam-names', type=str, default='CAT 1,Mid-Term Exam,End of Term Exam', help='Comma-separated base names for Term 1..3 (e.g., "CAT 1,Mid-Term Exam,End of Term Exam")')
        parser.add_argument('--force-rename', action='store_true', help='Rename existing exams to the desired base names for consistency')
        parser.add_argument('--school-like', type=str, default='', help='Match school by code or name (icontains)')
        parser.add_argument('--verbose', action='store_true', help='Print detailed progress')
        parser.add_argument('--force-new', action='store_true', help='Always create a new exam with the desired base name even if another exam exists for the same term')
        parser.add_argument('--reseed', action='store_true', help='Delete existing results for the targeted exam before creating fresh ones')

    def handle(self, *args, **options):
        target_year = int(options['year'])
        total_marks = int(options['total_marks'])
        publish = True if options['publish'] else False if options['unpublish'] else True
        dry_run = bool(options['dry_run'])
        school_code = (options.get('school') or '').strip()
        school_like = (options.get('school_like') or '').strip()
        max_classes = int(options.get('max_classes') or 0)
        max_students = int(options.get('max_students') or 0)
        batch_size = max(1, int(options.get('batch_size') or 1000))
        skip_if_exists = bool(options.get('skip_if_exists'))
        verbose = bool(options.get('verbose'))
        force_new = bool(options.get('force_new'))
        reseed = bool(options.get('reseed'))

        qs_classes = Class.objects.all().select_related('stream', 'school').prefetch_related('subjects')
        if school_code:
            qs_classes = qs_classes.filter(school__code__iexact=school_code)
        elif school_like:
            from django.db.models import Q
            qs_classes = qs_classes.filter(Q(school__code__icontains=school_like) | Q(school__name__icontains=school_like))
        classes = list(qs_classes)
        if max_classes and len(classes) > max_classes:
            classes = classes[:max_classes]
        if not classes:
            scope = f" (school='{school_code}')" if school_code else (f" (school-like='{school_like}')" if school_like else '')
            self.stdout.write(self.style.ERROR(f'No classes found{scope}.'))
            return
        if verbose:
            self.stdout.write(self.style.WARNING(f"Selected classes: {len(classes)}"))

        terms = [1, 2, 3]
        # Parse exam names per term
        raw_names = [x.strip() for x in (options.get('exam_names') or '').split(',') if x.strip()]
        # Default to 3 standard names if not provided
        default_names = ['CAT 1', 'Mid-Term Exam', 'End of Term Exam']
        base_names = raw_names if raw_names else default_names
        # Ensure at least 3 entries by cycling defaults
        while len(base_names) < 3:
            base_names.append(default_names[len(base_names)])
        force_rename = bool(options.get('force_rename'))
        now = timezone.now()

        exams_created = 0
        results_created = 0

        for klass in classes:
            subjects = list(klass.subjects.filter(is_examinable=True).only('id'))
            stu_qs = Student.objects.filter(klass=klass).only('id')
            if max_students:
                stu_qs = stu_qs.order_by('id')[:max_students]
            students = list(stu_qs)

            if not subjects or not students:
                continue
            if verbose:
                self.stdout.write(f"Class {getattr(klass, 'name', klass.id)}: {len(students)} students, {len(subjects)} subjects")

            for term in terms:
                # Choose a recent date for the exam within the last 120 days
                exam_date = date.today() - timedelta(days=random.randint(7, 120))

                # Desired base name for this term (uniform across all classes)
                desired_base = base_names[(term - 1) % len(base_names)]

                # Ensure exam selection per (year, term, class). Prefer an existing with desired base name.
                qs = Exam.objects.filter(year=target_year, term=term, klass=klass)
                exam = qs.filter(name__istartswith=desired_base).order_by('id').first() or qs.order_by('id').first()
                created = False
                if (force_new and not dry_run) or (not exam and not dry_run):
                    # If forcing a new exam or none exists, create a fresh exam with desired base
                    exam = Exam(
                        name=desired_base,
                        year=target_year,
                        term=term,
                        klass=klass,
                        date=exam_date,
                        total_marks=total_marks,
                        published=publish,
                        published_at=now if publish else None,
                    )
                    exam.save()
                    created = True

                if created:
                    exams_created += 1
                    if verbose:
                        self.stdout.write(self.style.SUCCESS(f"  Created exam: {desired_base} T{term} {target_year} for {getattr(klass, 'name', klass.id)}"))
                else:
                    # Ensure properties align with chosen options
                    update_fields = []
                    # Optional: enforce the desired base name for consistency across classes
                    if force_rename:
                        # Set base name; Exam.save() will append formatted suffix
                        if (exam.name or '').strip().lower().startswith(desired_base.strip().lower()) is False:
                            exam.name = desired_base
                            update_fields.append('name')
                    if exam.total_marks != total_marks:
                        exam.total_marks = total_marks
                        update_fields.append('total_marks')
                    if publish and not exam.published:
                        exam.published = True
                        exam.published_at = now
                        update_fields += ['published', 'published_at']
                    if not publish and exam.published:
                        exam.published = False
                        exam.published_at = None
                        update_fields += ['published', 'published_at']
                    if update_fields and not dry_run and exam:
                        exam.save(update_fields=update_fields)
                        if verbose:
                            self.stdout.write(self.style.WARNING(f"  Updated exam fields: {', '.join(update_fields)} for {getattr(klass, 'name', klass.id)} T{term}"))

                # Create results per student per subject (skip if already exists)
                if dry_run:
                    continue

                # Optional reseed: delete existing results for the targeted exam
                if reseed:
                    cnt = ExamResult.objects.filter(exam=exam).count()
                    if cnt and not dry_run:
                        ExamResult.objects.filter(exam=exam).delete()
                        if verbose:
                            self.stdout.write(self.style.WARNING(f"  Deleted {cnt} existing results (reseed)"))

                # Optionally skip if exam already has results (fast path)
                if not reseed and skip_if_exists and ExamResult.objects.filter(exam=exam).only('id').exists():
                    if verbose:
                        self.stdout.write("  Skipping results: already exist")
                    continue

                # Build a set of existing (student_id, subject_id) pairs to avoid duplicates
                existing_pairs = set(
                    ExamResult.objects.filter(exam=exam)
                    .values_list('student_id', 'subject_id')
                )

                to_create = []
                for s in students:
                    for sub in subjects:
                        key = (s.id, sub.id)
                        if key in existing_pairs:
                            continue
                        mark = round(random.uniform(0.35 * total_marks, 0.95 * total_marks), 1)
                        to_create.append(ExamResult(
                            exam_id=exam.id,
                            student_id=s.id,
                            subject_id=sub.id,
                            component_id=None,
                            marks=mark,
                        ))

                        # Bulk insert in batches
                        if len(to_create) >= batch_size:
                            ExamResult.objects.bulk_create(to_create, ignore_conflicts=True)
                            results_created += len(to_create)
                            to_create.clear()

                if to_create:
                    ExamResult.objects.bulk_create(to_create, ignore_conflicts=True)
                    results_created += len(to_create)

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run complete. No changes were made.'))
        self.stdout.write(self.style.SUCCESS('Seeding complete.'))
        self.stdout.write(self.style.SUCCESS(f'  - Exams created: {exams_created}'))
        self.stdout.write(self.style.SUCCESS(f'  - Results created: {results_created}'))
