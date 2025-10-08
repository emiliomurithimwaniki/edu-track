from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.apps import apps

from academics.models import Class, Subject, ClassSubjectTeacher, TeacherProfile
from accounts.models import School

User = get_user_model()

class Command(BaseCommand):
    help = "Backfill: ensure every class has all school subjects assigned, and every (class, subject) has a teacher. P.P.I -> class teacher if available."

    def add_arguments(self, parser):
        parser.add_argument('--school-code', type=str, default=None, help='Limit to a specific school code')
        parser.add_argument('--dry-run', action='store_true', default=False, help='Print actions without writing changes')

    def handle(self, *args, **options):
        school_code = options['school_code']
        dry_run = options['dry_run']

        schools = School.objects.all()
        if school_code:
            schools = schools.filter(code=school_code)
        if not schools.exists():
            self.stdout.write(self.style.ERROR('No schools found for the given filter'))
            return

        total_assignments = 0
        total_links = 0

        for school in schools:
            self.stdout.write(self.style.NOTICE(f"Processing {school.name} ({school.code})"))
            school_subjects = list(Subject.objects.filter(school=school))
            if not school_subjects:
                self.stdout.write(self.style.WARNING('  - No subjects found; skipping'))
                continue

            classes = list(Class.objects.filter(school=school))
            teachers = list(User.objects.filter(school=school, role='teacher'))
            tprofiles = {tp.user_id: tp for tp in TeacherProfile.objects.filter(user__in=teachers)}

            with transaction.atomic():
                # 1) Ensure all classes have all subjects
                for klass in classes:
                    current = set(klass.subjects.values_list('id', flat=True))
                    wanted = set(s.id for s in school_subjects)
                    missing = wanted - current
                    if missing:
                        if dry_run:
                            self.stdout.write(f"  - Would add {len(missing)} subjects to {klass}")
                        else:
                            klass.subjects.add(*missing)
                            total_assignments += len(missing)

                # 2) Ensure every (class, subject) has a teacher
                for klass in classes:
                    for subject in klass.subjects.all():
                        exists = ClassSubjectTeacher.objects.filter(klass=klass, subject=subject).exists()
                        if exists:
                            continue
                        assigned_teacher = None
                        subj_name_norm = subject.name.replace('.', '').strip().lower()
                        # P.P.I -> class teacher where available
                        if subj_name_norm == 'ppi' and klass.teacher_id:
                            assigned_teacher = klass.teacher
                        else:
                            # Prefer expertise
                            preferred = []
                            for t in teachers:
                                tp = tprofiles.get(t.id)
                                subs = [s.strip().lower() for s in tp.subjects.split(',')] if tp and tp.subjects else []
                                if subject.name.lower() in subs:
                                    preferred.append(t)
                            if preferred:
                                from random import choice
                                assigned_teacher = choice(preferred)
                            elif teachers:
                                from random import choice
                                assigned_teacher = choice(teachers)
                        if assigned_teacher:
                            if dry_run:
                                self.stdout.write(f"  - Would link {klass} — {subject.name} -> {assigned_teacher.username}")
                            else:
                                ClassSubjectTeacher.objects.get_or_create(
                                    klass=klass,
                                    subject=subject,
                                    defaults={'teacher': assigned_teacher}
                                )
                                total_links += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run complete."))
        self.stdout.write(self.style.SUCCESS(f"Done. Subjects added to classes: {total_assignments}; ClassSubjectTeacher links created: {total_links}"))
