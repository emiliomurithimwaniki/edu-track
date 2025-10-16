from __future__ import annotations
from typing import Dict, List, Tuple
from django.db import transaction
from django.utils import timezone

# Lazy imports to avoid circulars when Django initializes

def _get_models():
    from academics.models import (
        TimetablePlan, TimetableVersion, TimetableEntry,
        TimetableTemplate, PeriodSlotTemplate,
        TimetableClassConfig, ClassSubjectQuota, ClassSubjectTeacher, Subject,
    )
    return {
        'TimetablePlan': TimetablePlan,
        'TimetableVersion': TimetableVersion,
        'TimetableEntry': TimetableEntry,
        'TimetableTemplate': TimetableTemplate,
        'PeriodSlotTemplate': PeriodSlotTemplate,
        'TimetableClassConfig': TimetableClassConfig,
        'ClassSubjectQuota': ClassSubjectQuota,
        'ClassSubjectTeacher': ClassSubjectTeacher,
        'Subject': Subject,
    }


def _resolve_teacher_map(klass_ids: List[int]) -> Dict[Tuple[int, int], int]:
    """Map (klass_id, subject_id) -> teacher_id using ClassSubjectTeacher.
    If multiple teachers per subject/class exist, skip (return None) to avoid conflicts.
    """
    models = _get_models()
    cst = models['ClassSubjectTeacher']
    teacher_map: Dict[Tuple[int, int], int] = {}
    rows = (
        cst.objects
        .filter(klass_id__in=klass_ids)
        .values('klass_id', 'subject_id')
        .annotate(cnt=models['ClassSubjectTeacher'].objects.model._meta.default_manager.count())
    )
    # We cannot use annotate(cnt=Count('id')) without importing Count; keep it simple via iteration
    rows_all = list(cst.objects.filter(klass_id__in=klass_ids).values('klass_id','subject_id','teacher_id'))
    seen_counts: Dict[Tuple[int,int], int] = {}
    for r in rows_all:
        key = (r['klass_id'], r['subject_id'])
        seen_counts[key] = seen_counts.get(key, 0) + 1
        teacher_map.setdefault(key, r['teacher_id'])
    # Remove ambiguous
    for key, cnt in list(seen_counts.items()):
        if cnt != 1:
            teacher_map.pop(key, None)
    return teacher_map


def generate(plan, max_teacher_lessons_per_day: int | None = None) -> dict:
    """Greedy basic generator.
    Rules implemented (MVP):
    - Use plan.template periods and days_active to form weekly slots.
    - Use classes defined in plan.class_configs. If none, do nothing.
    - Fill subjects according to ClassSubjectQuota.weekly_periods per class.
    - Assign teacher if a unique ClassSubjectTeacher exists for (class, subject), else leave null.
    - Use TimetableClassConfig.room_preference when present.
    - Ignore TeacherAvailability and cross-class teacher conflicts for MVP.
    Returns: {version_id, placed_count, unplaced: [{klass, subject, remaining}], detail}
    """
    models = _get_models()

    # Re-fetch plan with relations to ensure consistency
    plan = models['TimetablePlan'].objects.select_related('term','template').get(pk=plan.pk)

    # Collect classes in scope
    configs = list(models['TimetableClassConfig'].objects.select_related('klass','room_preference').filter(plan=plan))
    if not configs:
        return {
            'version_id': None,
            'placed_count': 0,
            'unplaced': [],
            'detail': 'No class configurations found for plan. Add items in timetable/class_configs.'
        }

    klass_ids = [c.klass_id for c in configs]
    cfg_by_class: Dict[int, models['TimetableClassConfig']] = {c.klass_id: c for c in configs}

    # Quotas
    quotas_qs = models['ClassSubjectQuota'].objects.select_related('subject').filter(plan=plan, klass_id__in=klass_ids)
    quotas_by_class: Dict[int, List[dict]] = {}
    for q in quotas_qs:
        quotas_by_class.setdefault(q.klass_id, []).append({'subject_id': q.subject_id, 'weekly_periods': int(q.weekly_periods or 0)})

    # Priority subjects map: subject_id -> bool
    subj_ids = list({q.subject_id for q in quotas_qs})
    is_priority_map: Dict[int, bool] = {}
    if subj_ids:
        for s in models['Subject'].objects.filter(id__in=subj_ids).values('id','is_priority'):
            is_priority_map[int(s['id'])] = bool(s['is_priority'])

    # Period structure
    template = plan.template
    days_active = list(template.days_active or [])
    if not days_active:
        days_active = [1,2,3,4,5]  # Mon-Fri default
    periods = list(models['PeriodSlotTemplate'].objects.filter(template=template, kind='lesson').order_by('period_index'))
    if not periods:
        return {
            'version_id': None,
            'placed_count': 0,
            'unplaced': [],
            'detail': 'No lesson periods defined on the template.'
        }

    # Prepare teacher map
    teacher_map = _resolve_teacher_map(klass_ids)

    # Create a new version label auto-increment
    base_label = timezone.now().strftime('Auto %Y-%m-%d %H:%M')
    with transaction.atomic():
        version = models['TimetableVersion'](plan=plan, label=base_label, is_current=False)
        version.save()

        placed = 0
        unplaced: List[dict] = []

        # Track remaining per class
        remaining_by_class: Dict[int, Dict[int,int]] = {}
        for cid in klass_ids:
            rem = {}
            for q in quotas_by_class.get(cid, []):
                if q['weekly_periods'] > 0:
                    rem[q['subject_id']] = q['weekly_periods']
            remaining_by_class[cid] = rem

        # For each day and each period, place for each class (prefer priority subjects first)
        # Track teacher daily loads: (day, teacher_id) -> count
        teacher_daily_count: Dict[Tuple[int,int], int] = {}
        for day in days_active:
            for p in periods:
                for cid in klass_ids:
                    rem = remaining_by_class.get(cid, {})
                    if not rem:
                        continue
                    # pick subjects preferring priority, then highest remaining
                    ordered = sorted(rem.items(), key=lambda kv: (
                        0 if not is_priority_map.get(int(kv[0]), False) else -1,
                        -int(kv[1] or 0)
                    ))
                    placed_this_slot = False
                    for subject_id, _cnt in ordered:
                        # assign teacher if uniquely mapped
                        teacher_id = teacher_map.get((cid, subject_id))
                        # If a limit is set and teacher exists, enforce per-day cap
                        if max_teacher_lessons_per_day and teacher_id:
                            key = (int(day), int(teacher_id))
                            if teacher_daily_count.get(key, 0) >= int(max_teacher_lessons_per_day):
                                continue

                        room_id = getattr(cfg_by_class.get(cid), 'room_preference_id', None)
                        entry = models['TimetableEntry'](
                            term=plan.term,
                            day_of_week=day,
                            start_time=p.start_time,
                            end_time=p.end_time,
                            klass_id=cid,
                            subject_id=subject_id,
                            teacher_id=teacher_id,
                            room_id=room_id,
                            plan=plan,
                            version=version,
                        )
                        try:
                            entry.full_clean()
                            entry.save()
                            placed += 1
                            # decrement
                            rem[subject_id] -= 1
                            if rem[subject_id] <= 0:
                                rem.pop(subject_id, None)
                            # bump teacher load count if teacher assigned
                            if teacher_id:
                                key = (int(day), int(teacher_id))
                                teacher_daily_count[key] = teacher_daily_count.get(key, 0) + 1
                            placed_this_slot = True
                            break
                        except Exception:
                            # try next subject candidate
                            continue
                    # If no subject fitted constraints for this class/slot, we skip it

        # Compute unplaced (remaining quotas)
        for cid, rem in remaining_by_class.items():
            for sid, count in rem.items():
                if count > 0:
                    unplaced.append({'klass': cid, 'subject': sid, 'remaining': count})

        # Update plan status
        models['TimetablePlan'].objects.filter(pk=plan.pk).update(status='generated')

    return {
        'version_id': version.id,
        'placed_count': placed,
        'unplaced': unplaced,
        'detail': 'Generated using basic greedy algorithm.'
    }
