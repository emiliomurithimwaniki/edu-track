from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps

@receiver(post_save, sender='accounts.School')
def create_default_subjects_for_school(sender, instance, created, **kwargs):
    """Create default subjects when a School is created.
    Defaults as priority subjects: Mathematics, English, Kiswahili, P.P.I
    Codes are namespaced by school code to satisfy Subject.code uniqueness.
    """
    if not created:
        return

    Subject = apps.get_model('academics', 'Subject')
    # name, abbr, category, is_priority
    defaults = [
        ("Mathematics", "MAT", "science", True),
        ("English", "ENG", "language", True),
        ("Kiswahili", "KIS", "language", True),
        ("P.P.I", "PPI", "other", True),
    ]
    for name, abbr, category, is_priority in defaults:
        code = f"{instance.code}-{abbr}"
        Subject.objects.get_or_create(
            code=code,
            defaults={
                'category': category,
                'is_priority': is_priority,
                'school': instance,
            }
        )


@receiver(post_save, sender='academics.Student')
def notify_student_enrollment(sender, instance, created, **kwargs):
    """Send notifications after a student is created (enrolled)."""
    if not created:
        return
    try:
        from communications.utils import notify_enrollment
        notify_enrollment(instance)
    except Exception:
        # Avoid breaking save flow
        pass
