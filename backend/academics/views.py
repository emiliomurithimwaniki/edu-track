from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes, action
from rest_framework.parsers import MultiPartParser, JSONParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from django.db.models import Sum, Avg
from django.http import HttpResponse
from io import BytesIO, StringIO
from django.utils import timezone
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Image, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except Exception:
    REPORTLAB_AVAILABLE = False
import csv, io
from django_filters.rest_framework import DjangoFilterBackend
from .models import Class, Student, Competency, Assessment, Attendance, TeacherProfile, Subject, Exam, ExamResult, AcademicYear, Term, Stream, LessonPlan, ClassSubjectTeacher, SubjectGradingBand, Room, TimetableEntry
from .serializers import (
    ClassSerializer, StudentSerializer, CompetencySerializer,
    AssessmentSerializer, AttendanceSerializer, LessonPlanSerializer, TeacherProfileSerializer, SubjectSerializer,
    ExamSerializer, ExamResultSerializer, AcademicYearSerializer, TermSerializer, StreamSerializer, ClassSubjectTeacherSerializer, SubjectGradingBandSerializer, RoomSerializer, TimetableEntrySerializer
)

class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ('teacher','admin')

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.role == 'admin' or request.user.is_staff or request.user.is_superuser
        )

class StreamViewSet(viewsets.ModelViewSet):
    queryset = Stream.objects.all()
    serializer_class = StreamSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if not school:
            raise ValidationError({'school': 'School is required. Set your user.school in Django admin.'})
        serializer.save(school=school)

    @action(detail=True, methods=['post'], url_path='resync-classes')
    def resync_classes(self, request, pk=None):
        """Force-refresh names of classes under this stream to match the current stream name.
        Useful after renaming a stream when some classes may be stale.
        """
        stream = self.get_object()
        from .models import Class as ClassModel
        updated = 0
        for c in ClassModel.objects.filter(stream=stream).only('id','grade_level','stream'):
            # Trigger Class.save() name regeneration
            c.save(update_fields=['name'])
            updated += 1
        return Response({'detail': 'ok', 'updated': updated})


class ClassSubjectTeacherViewSet(viewsets.ModelViewSet):
    queryset = ClassSubjectTeacher.objects.all()
    serializer_class = ClassSubjectTeacherSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset().select_related('klass','subject','teacher')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(klass__school=school)
        # Optional filters
        klass = self.request.query_params.get('klass')
        if klass:
            qs = qs.filter(klass_id=klass)
        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject_id=subject)
        return qs

    def perform_create(self, serializer):
        # Validate the chosen class is in admin's school
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        klass = serializer.validated_data.get('klass')
        if school and klass and klass.school_id != school.id:
            raise ValidationError({'klass': 'Class must belong to your school'})
        serializer.save()

class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school']
    def perform_create(self, serializer):
        # Resolve school: prefer payload, else user's school
        school = serializer.validated_data.get('school') or getattr(self.request.user, 'school', None)
        if not school:
            raise ValidationError({'school': 'School is required. Set your user.school in Django admin or include "school" in the request.'})
        serializer.save(school=school)
    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    @action(detail=False, methods=['get'], permission_classes=[IsTeacherOrAdmin], url_path='mine')
    def mine(self, request):
        """Return classes relevant to the authenticated teacher.
        - If the requester is a teacher (non-staff), include classes where they are either:
          1) the class teacher (Class.teacher = user), OR
          2) assigned to teach any subject in the class via ClassSubjectTeacher.
        - Admins/staff get all classes in their school.
        """
        qs = self.get_queryset()
        user = request.user
        if getattr(user, 'role', None) == 'teacher' and not (user.is_staff or user.is_superuser):
            qs = qs.filter(Q(teacher=user) | Q(subject_teachers__teacher=user)).distinct()
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    # Allow teachers to read, admins to manage
    permission_classes = [IsTeacherOrAdmin]

    def _is_admin(self, request):
        u = getattr(request, 'user', None)
        return bool(u and (u.role == 'admin' or u.is_staff or u.is_superuser))

    def get_queryset(self):
        qs = super().get_queryset().select_related('klass')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(klass__school=school)

        # If requester is a teacher, restrict to classes they teach (class teacher or subject teacher)
        user = getattr(self.request, 'user', None)
        if user and getattr(user, 'role', None) == 'teacher' and not (user.is_staff or user.is_superuser):
            qs = qs.filter(Q(klass__teacher=user) | Q(klass__subject_teachers__teacher=user)).distinct()

        grade = self.request.query_params.get('grade')
        if grade:
            qs = qs.filter(klass__grade_level=grade)
        return qs

    def perform_create(self, serializer):
        # Only admins can create exams
        if not self._is_admin(self.request):
            raise ValidationError({'detail': 'Only admins can create exams'})
        # enforce school scoping by validating klass belongs to user's school
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        klass = serializer.validated_data.get('klass')
        if school and klass and klass.school_id != school.id:
            raise ValidationError({'klass': 'Class must belong to your school'})
        serializer.save()

    # Block non-admin updates/deletes
    def update(self, request, *args, **kwargs):
        if not self._is_admin(request):
            return Response({'detail': 'Only admins can modify exams'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin(request):
            return Response({'detail': 'Only admins can modify exams'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request):
            return Response({'detail': 'Only admins can delete exams'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def _build_summary(self, exam):
        # Limit subjects to class subjects for column ordering
        class_subjects = list(exam.klass.subjects.all().values('id','code','name'))
        res = ExamResult.objects.filter(exam=exam).select_related('student','subject')
        students_map = {}
        for r in res:
            s = r.student
            entry = students_map.setdefault(s.id, {
                'id': s.id,
                'name': getattr(s, 'name', str(s)),
                'total': 0.0,
                'count': 0,
                'marks': {}
            })
            entry['marks'][str(r.subject_id)] = float(r.marks)
            entry['total'] += float(r.marks)
            entry['count'] += 1
        students = []
        for sid, e in students_map.items():
            avg = (e['total'] / e['count']) if e['count'] else 0.0
            students.append({ 'id': e['id'], 'name': e['name'], 'total': round(e['total'],2), 'average': round(avg,2), 'marks': e['marks'] })
        # sort by total desc
        students.sort(key=lambda x: x['total'], reverse=True)
        # assign positions
        position = 1
        last_total = None
        same_rank_count = 0
        for idx, st in enumerate(students):
            if last_total is None or st['total'] < last_total:
                position = idx + 1
                last_total = st['total']
                same_rank_count = 1
            else:
                same_rank_count += 1
            st['position'] = position
        # class mean (average of student averages)
        class_mean = round(sum(s['average'] for s in students) / len(students), 2) if students else 0.0
        # subject means
        subj_means = []
        subj_ids = [s['id'] for s in class_subjects]
        for sid in subj_ids:
            vals = [st['marks'].get(str(sid)) for st in students if st['marks'].get(str(sid)) is not None]
            mean = round(sum(vals)/len(vals), 2) if vals else 0.0
            subj_means.append({'subject': sid, 'mean': mean})
        return {
            'subjects': class_subjects,
            'students': students,
            'class_mean': class_mean,
            'subject_means': subj_means,
        }

    @action(detail=True, methods=['get'], permission_classes=[IsAdmin])
    def summary(self, request, pk=None):
        exam = self.get_object()
        return Response(self._build_summary(exam))

    @action(detail=True, methods=['get'], permission_classes=[IsAdmin], url_path='summary-csv')
    def summary_csv(self, request, pk=None):
        exam = self.get_object()
        school = getattr(request.user, 'school', None)
        data = self._build_summary(exam)
        # Build CSV
        import csv
        sio = StringIO()
        writer = csv.writer(sio)
        # Header section
        writer.writerow([school.name if school else '', exam.name, f"Year {exam.year}", f"Term {exam.term}"])
        if school and getattr(school, 'motto', ''):
            writer.writerow([school.motto])
        writer.writerow([])
        # Table header
        head = ['Position','Student'] + [s['code'] for s in data['subjects']] + ['Total','Average']
        writer.writerow(head)
        for st in data['students']:
            row = [st['position'], st['name']]
            for s in data['subjects']:
                row.append(st['marks'].get(str(s['id']), ''))
            row += [st['total'], st['average']]
            writer.writerow(row)
        writer.writerow([])
        writer.writerow(['Class Mean', data['class_mean']])
        writer.writerow(['Subject Means'] + [f"{s['code']}:{next((m['mean'] for m in data['subject_means'] if m['subject']==s['id']),0)}" for s in data['subjects']])
        csv_text = sio.getvalue()
        resp = HttpResponse(csv_text, content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="exam_{exam.id}_summary.csv"'
        return resp

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin], url_path='publish')
    def publish(self, request, pk=None):
        """Mark exam as published and notify students via email/SMS with per-student PDF if available.
        The student's dashboard will then show results.
        """
        exam = self.get_object()
        if getattr(exam, 'published', False):
            return Response({'detail': 'Exam already published', 'published_at': getattr(exam, 'published_at', None)}, status=200)

        # Import here to avoid hard deps if communications app changes
        from communications.utils import send_sms, send_email_with_attachment, send_email_safe, create_messages_for_users

        # Gather results grouped by student
        res = ExamResult.objects.filter(exam=exam).select_related('student','subject')
        by_student = {}
        for r in res:
            s = r.student
            entry = by_student.setdefault(s.id, {
                'student': s,
                'marks': {},
                'total': 0.0,
                'count': 0,
            })
            entry['marks'][r.subject_id] = float(r.marks)
            entry['total'] += float(r.marks)
            entry['count'] += 1

        # Build a simple subject list for column order
        subjects = list(exam.klass.subjects.all())

        # Send messages per student
        chat_user_ids = []
        for sid, data in by_student.items():
            s = data['student']
            total = data['total']
            avg = round(total / data['count'], 2) if data['count'] else 0.0
            # SMS
            sms = f"Hi {getattr(s,'name','Student')}, your results for {exam.name} (Year {exam.year}, Term {exam.term}) are out. Total: {round(total,2)}, Average: {avg}. Login to the portal to view details."
            try:
                phone = getattr(s, 'phone', None) or getattr(getattr(s, 'user', None), 'phone', None) or getattr(s, 'guardian_id', None)
                if phone:
                    send_sms(phone, sms)
            except Exception:
                pass

            # Collect for chat mirror
            if getattr(s, 'user_id', None):
                chat_user_ids.append(s.user_id)

            # Email with optional PDF attachment
            recipient = getattr(s, 'email', None) or getattr(getattr(s, 'user', None), 'email', None)
            body = (
                f"Dear {getattr(s,'name','Student')},\n\n"
                f"Your exam results for {exam.name} (Year {exam.year}, Term {exam.term}, Class {exam.klass.name}) are now available. "
                f"Total: {round(total,2)}  Average: {avg}.\n\n"
                "You can also log into the student portal to view full details.\n\n"
                "Regards, School Administration"
            )

            attachment_bytes = None
            filename = f"results_{exam.id}_{s.id}.pdf"
            if REPORTLAB_AVAILABLE:
                try:
                    buf = BytesIO()
                    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
                    elements = []
                    styles = getSampleStyleSheet()
                    elements.append(Paragraph(f"<b>{exam.klass.school.name if getattr(exam.klass,'school',None) else 'School'}</b>", styles['Title']))
                    elements.append(Paragraph(f"{exam.name} — Year {exam.year} — Term {exam.term}", styles['Normal']))
                    elements.append(Paragraph(f"Student: {s.name}", styles['Normal']))
                    elements.append(Spacer(1, 12))
                    # Table header: Subject, Marks
                    rows = [["Subject", "Marks"]]
                    for subj in subjects:
                        rows.append([subj.code, str(data['marks'].get(subj.id, ''))])
                    rows.append(["Total", str(round(total,2))])
                    rows.append(["Average", str(avg)])
                    tbl = Table(rows, repeatRows=1)
                    tbl.setStyle(TableStyle([
                        ('BACKGROUND',(0,0),(-1,0), colors.HexColor('#f3f4f6')),
                        ('GRID',(0,0),(-1,-1), 0.25, colors.HexColor('#d1d5db')),
                        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
                    ]))
                    elements.append(tbl)
                    doc.build(elements)
                    attachment_bytes = buf.getvalue()
                except Exception:
                    attachment_bytes = None
            # Send
            try:
                if recipient:
                    if attachment_bytes:
                        send_email_with_attachment(
                            subject=f"{exam.name} Results",
                            message=body,
                            recipient=recipient,
                            filename=filename,
                            content=attachment_bytes,
                            mimetype='application/pdf'
                        )
                    else:
                        send_email_safe(f"{exam.name} Results", body, recipient)
            except Exception:
                pass

        # Mirror to chat so students see it in Messages UI
        try:
            if chat_user_ids:
                body = f"Your exam results for {exam.name} (Year {exam.year}, Term {exam.term}) are now available."
                create_messages_for_users(
                    school_id=getattr(exam.klass, 'school_id', None),
                    sender_id=getattr(request.user, 'id', None),
                    body=body,
                    recipient_user_ids=chat_user_ids,
                    system_tag='results',
                )
        except Exception:
            pass

        # Mark published
        exam.published = True
        exam.published_at = timezone.now()
        exam.save(update_fields=['published','published_at'])
        return Response({'detail': 'Published', 'published_at': exam.published_at})

    @action(detail=True, methods=['get'], permission_classes=[IsAdmin], url_path='summary-pdf')
    def summary_pdf(self, request, pk=None):
        exam = self.get_object()
        school = getattr(request.user, 'school', None)
        data = self._build_summary(exam)
        if not REPORTLAB_AVAILABLE:
            return Response({'detail': 'PDF generation library not installed. Please install reportlab.'}, status=500)

        buffer = BytesIO()
        
        # Use landscape for exams with many subjects (>6)
        num_subjects = len(data['subjects'])
        if num_subjects > 6:
            from reportlab.lib.pagesizes import landscape
            pagesize = landscape(A4)
        else:
            pagesize = A4
        
        width, height = pagesize
        doc = SimpleDocTemplate(buffer, pagesize=pagesize, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        styles = getSampleStyleSheet()

        # Header with logo and school name
        header_parts = []
        logo_img = None
        try:
            if school and getattr(school, 'logo', None) and getattr(school.logo, 'path', None):
                logo_img = Image(school.logo.path, width=50, height=50)
        except Exception:
            logo_img = None

        title_text = f"{school.name if school else 'School'} — {exam.name}"
        title_para = Paragraph(f"<b>{title_text}</b>", styles['Title'])
        motto_para = Paragraph(f"<font size=9>{getattr(school, 'motto', '') or ''}</font>", styles['Normal'])
        meta_para = Paragraph(f"<font size=9>Year: {exam.year} &nbsp;&nbsp; Term: {exam.term} &nbsp;&nbsp; Class: {exam.klass.name}</font>", styles['Normal'])

        # Build a two-column header row
        if logo_img:
            header_table = Table([[logo_img, [title_para, motto_para, meta_para]]], colWidths=[60, width-60-72])
        else:
            header_table = Table([[[title_para, motto_para, meta_para]]], colWidths=[width-72])
        header_table.setStyle(TableStyle([
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1),0),
            ('RIGHTPADDING',(0,0),(-1,-1),0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 12))

        # Build results table with calculated column widths
        table_head = ['Pos','Student'] + [s['code'] for s in data['subjects']] + ['Total','Avg']
        table_rows = [table_head]
        for st in data['students']:
            row = [st['position'], st['name']]
            for s in data['subjects']:
                row.append(st['marks'].get(str(s['id']), ''))
            row += [st['total'], st['average']]
            table_rows.append(row)

        # Calculate column widths to fit page
        available_width = width - 72  # Account for margins
        pos_width = 30  # Position column
        total_width = 40  # Total column
        avg_width = 40  # Average column
        
        # Remaining width for student name and subject columns
        remaining_width = available_width - pos_width - total_width - avg_width
        
        # Allocate widths
        if num_subjects > 0:
            # Student name gets 25% of remaining, subjects share the rest
            student_width = min(120, remaining_width * 0.25)
            subject_total_width = remaining_width - student_width
            subject_width = subject_total_width / num_subjects
        else:
            student_width = remaining_width
            subject_width = 0
        
        # Build column widths list
        col_widths = [pos_width, student_width]
        col_widths.extend([subject_width] * num_subjects)
        col_widths.extend([total_width, avg_width])
        
        # Adjust font size based on number of subjects
        if num_subjects > 10:
            font_size = 7
        elif num_subjects > 6:
            font_size = 8
        else:
            font_size = 9

        tbl = Table(table_rows, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR',(0,0),(-1,0), colors.HexColor('#111827')),
            ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
            ('ALIGN',(0,0),(-1,0),'CENTER'),
            ('ALIGN',(1,1),(1,-1),'LEFT'),  # Student names left-aligned
            ('GRID',(0,0),(-1,-1), 0.25, colors.HexColor('#d1d5db')),
            ('ROWBACKGROUNDS',(0,1),(-1,-1), [colors.white, colors.HexColor('#fafafa')]),
            ('FONTSIZE',(0,0),(-1,-1), font_size),
            ('ALIGN',(2,1),(-1,-1),'CENTER'),  # Center all marks
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1), 3),
            ('RIGHTPADDING',(0,0),(-1,-1), 3),
            ('TOPPADDING',(0,0),(-1,-1), 4),
            ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ]))
        elements.append(tbl)
        elements.append(Spacer(1, 10))

        # Class mean and subject means
        elements.append(Paragraph(f"<b>Class Mean:</b> {data['class_mean']}", styles['Normal']))
        subj_text = ' &nbsp; '.join([f"{s['code']}: {next((m['mean'] for m in data['subject_means'] if m['subject']==s['id']),0)}" for s in data['subjects']])
        elements.append(Paragraph(f"<font size=8>{subj_text}</font>", styles['Normal']))

        # Footer with page numbers and timestamp
        def footer(canv, doc_):
            canv.saveState()
            page_num = canv.getPageNumber()
            ts = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M')
            footer_text_left = f"Generated: {ts}"
            footer_text_right = f"Page {page_num}"
            powered = "Powered by EDU-TRACK"
            canv.setFont('Helvetica', 8)
            # Left
            canv.drawString(36, 20, footer_text_left)
            # Right
            w = canv.stringWidth(footer_text_right, 'Helvetica', 8)
            canv.drawString(pagesize[0]-36-w, 20, footer_text_right)
            # Center tag
            pw = canv.stringWidth(powered, 'Helvetica', 8)
            canv.drawString((pagesize[0]-pw)/2, 20, powered)
            canv.restoreState()

        doc.build(elements, onFirstPage=footer, onLaterPages=footer)
        pdf = buffer.getvalue()
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="exam_{exam.id}_summary.pdf"'
        return resp


class ExamResultViewSet(viewsets.ModelViewSet):
    queryset = ExamResult.objects.all()
    serializer_class = ExamResultSerializer
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset().select_related('exam','student','subject')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(exam__klass__school=school)
        # optional filters
        exam_id = self.request.query_params.get('exam')
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        # Scope for non-admins
        user = getattr(self.request, 'user', None)
        if user and getattr(user, 'role', None) == 'teacher' and not (user.is_staff or user.is_superuser):
            qs = qs.filter(Q(exam__klass__teacher=user) | Q(exam__klass__subject_teachers__teacher=user)).distinct()
        # If requester is a student (not staff), only show published exams and their own results
        if getattr(user, 'role', None) == 'student' and not (user.is_staff or user.is_superuser):
            qs = qs.filter(exam__published=True, student__user=user)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        exam = serializer.validated_data.get('exam')
        subject = serializer.validated_data.get('subject')
        user = getattr(self.request, 'user', None)
        if school and exam and exam.klass.school_id != school.id:
            raise ValidationError({'exam': 'Exam must belong to your school'})
        # If teacher, ensure they are allowed to submit for this class/subject
        if user and getattr(user, 'role', None) == 'teacher' and not (user.is_staff or user.is_superuser):
            allowed = False
            if exam and exam.klass and exam.klass.teacher_id == user.id:
                allowed = True
            if not allowed and exam and subject:
                allowed = ClassSubjectTeacher.objects.filter(klass=exam.klass, teacher=user, subject=subject).exists()
            if not allowed:
                raise ValidationError({'detail': 'You are not assigned to this class/subject for this exam'})
        serializer.save()

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    filter_backends = [DjangoFilterBackend]
    # Allow simple server-side filtering by class and gender
    filterset_fields = ['klass', 'gender']
    # Support JSON (default axios), form, and multipart (for photo uploads)
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        school = getattr(user, 'school', None)
        if school:
            qs = qs.filter(klass__school=school)
        # Optional grade filter via related class grade_level
        grade = self.request.query_params.get('grade')
        if grade:
            qs = qs.filter(klass__grade_level=grade)
        return qs

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='my')
    def my(self, request):
        """Return the student record linked to the authenticated user, if any."""
        user = request.user
        qs = self.get_queryset().filter(user=user)
        student = qs.first()
        if not student:
            return Response({'detail': 'Student record not found for this user'}, status=404)
        ser = self.get_serializer(student)
        return Response(ser.data)

class CompetencyViewSet(viewsets.ModelViewSet):
    queryset = Competency.objects.all()
    serializer_class = CompetencySerializer

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdmin]
    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        serializer.save(school=serializer.validated_data.get('school', school))
    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(Q(school=school) | Q(school__isnull=True))
        return qs

    @action(detail=True, methods=['get'], permission_classes=[IsAdmin], url_path='stats')
    def stats(self, request, pk=None):
        subject = self.get_object()
        school = getattr(request.user, 'school', None)
        classes_qs = Class.objects.all()
        if school:
            classes_qs = classes_qs.filter(school=school)
        classes_qs = classes_qs.filter(subjects=subject)

        # Latest exam per class
        latest_exams = []
        for c in classes_qs:
            e = Exam.objects.filter(klass=c).order_by('-date','-id').first()
            if e:
                latest_exams.append((c, e))

        # Compute avg per class for this subject
        by_grade = {}
        for c, e in latest_exams:
            res = ExamResult.objects.filter(exam=e, subject=subject)
            if res.exists():
                avg = res.aggregate(m=Avg('marks'))['m'] or 0
                g = c.grade_level
                agg = by_grade.setdefault(g, {'grade_level': g, 'sum': 0.0, 'count': 0})
                agg['sum'] += float(avg)
                agg['count'] += 1

        avg_by_grade = [
            { 'grade_level': g, 'average': round(v['sum']/v['count'], 2) if v['count'] else 0.0, 'classes': v['count'] }
            for g, v in by_grade.items()
        ]
        try:
            avg_by_grade.sort(key=lambda x: float(x['grade_level']))
        except Exception:
            avg_by_grade.sort(key=lambda x: str(x['grade_level']))

        # Teachers
        teachers = TeacherProfile.objects.all()
        if school:
            teachers = teachers.filter(Q(user__school=school) | Q(klass__school=school))
        teachers = teachers.filter(Q(subjects__icontains=subject.code) | Q(subjects__icontains=subject.name))
        tser = TeacherProfileSerializer(teachers, many=True)

        grading = [
            {'grade':'A','min':80,'max':100},
            {'grade':'B','min':70,'max':79},
            {'grade':'C','min':60,'max':69},
            {'grade':'D','min':50,'max':59},
            {'grade':'E','min':0,'max':49},
        ]

        return Response({
            'subject': {'id': subject.id, 'code': subject.code, 'name': subject.name},
            'avg_by_grade': avg_by_grade,
            'teachers': tser.data,
            'grading': grading,
        })

class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.all()
    serializer_class = AssessmentSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student']

class LessonPlanViewSet(viewsets.ModelViewSet):
    queryset = LessonPlan.objects.all()
    serializer_class = LessonPlanSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['klass','subject','date']

    def get_queryset(self):
        qs = super().get_queryset().select_related('klass','subject','teacher')
        user = getattr(self.request, 'user', None)
        # Teachers only see their plans; admins see all within school
        if user and getattr(user, 'role', None) == 'teacher' and not (user.is_staff or user.is_superuser):
            qs = qs.filter(teacher=user)
        else:
            school = getattr(user, 'school', None)
            if school:
                qs = qs.filter(klass__school=school)
        return qs

    def perform_create(self, serializer):
        # Default teacher to the requester; validate class belongs to their school
        user = self.request.user
        klass = serializer.validated_data.get('klass')
        school = getattr(user, 'school', None)
        if school and klass and klass.school_id != school.id and not (user.is_staff or user.is_superuser):
            raise ValidationError({'klass': 'Class must belong to your school'})
        serializer.save(teacher=user)


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        if not school:
            raise ValidationError({'school': 'School is required. Set your user.school in Django admin.'})
        serializer.save(school=school)


class TimetableEntryViewSet(viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['term','klass','subject','teacher','day_of_week','room']

    def get_queryset(self):
        qs = super().get_queryset().select_related('klass','subject','teacher','room','term','klass__stream')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(klass__school=school)
        return qs

    def perform_create(self, serializer):
        # Validate school scoping for klass/room consistency
        school = getattr(self.request.user, 'school', None)
        klass = serializer.validated_data.get('klass')
        room = serializer.validated_data.get('room')
        if school and klass and klass.school_id != school.id:
            raise ValidationError({'klass': 'Class must belong to your school'})
        if school and room and room.school_id != school.id:
            raise ValidationError({'room': 'Room must belong to your school'})
        serializer.save()

class SubjectGradingBandViewSet(viewsets.ModelViewSet):
    queryset = SubjectGradingBand.objects.all()
    serializer_class = SubjectGradingBandSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['subject']

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student']

class TeacherProfileViewSet(viewsets.ModelViewSet):
    queryset = TeacherProfile.objects.all()
    serializer_class = TeacherProfileSerializer
    permission_classes = [IsAdmin]
    def get_queryset(self):
        qs = super().get_queryset().select_related('user', 'klass')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            # TeacherProfile does not have a direct school field; scope by either the user's school
            # or the assigned class's school
            qs = qs.filter(Q(user__school=school) | Q(klass__school=school))
        # Optional filter: subject (id or code), matches teacher's subjects string by code or name
        subj_param = self.request.query_params.get('subject')
        if subj_param:
            try:
                # Try as ID
                subj = Subject.objects.filter(id=int(subj_param)).first()
            except (ValueError, TypeError):
                subj = Subject.objects.filter(Q(code__iexact=subj_param) | Q(name__iexact=subj_param)).first()
            if subj:
                qs = qs.filter(Q(subjects__icontains=subj.code) | Q(subjects__icontains=subj.name))
            else:
                # Fallback: plain contains search
                qs = qs.filter(subjects__icontains=subj_param)
        return qs


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        if not school:
            raise ValidationError({'school': 'No school associated with your account.'})
        serializer.save(school=school)

    @action(detail=False, methods=['get'], permission_classes=[IsTeacherOrAdmin], url_path='current')
    def current(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'No school associated with user'}, status=400)
        today = timezone.localdate()
        # Prefer calendar-based detection
        obj = AcademicYear.objects.filter(school=school, start_date__lte=today, end_date__gte=today).first()
        # Fallback to flag if date-based not found
        if not obj:
            obj = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not obj:
            return Response({'detail': 'Current academic year not found for today and no fallback set'}, status=404)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], permission_classes=[IsTeacherOrAdmin], url_path='mine')
    def mine(self, request):
        """List all academic years for the authenticated user's school (most recent first)."""
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'No school associated with user'}, status=400)
        qs = AcademicYear.objects.filter(school=school).order_by('-start_date')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin], url_path='set-current')
    def set_current(self, request, pk=None):
        ay = self.get_object()
        ay.is_current = True
        ay.save()
        return Response({'detail': 'Current academic year updated'})


class TermViewSet(viewsets.ModelViewSet):
    queryset = Term.objects.all()
    serializer_class = TermSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['academic_year', 'number']

    def get_queryset(self):
        qs = super().get_queryset().select_related('academic_year')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(academic_year__school=school)
        return qs

    @action(detail=False, methods=['get'], permission_classes=[IsTeacherOrAdmin], url_path='current')
    def current(self, request):
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'No school associated with user'}, status=400)
        today = timezone.localdate()
        # Determine current AY by date, fallback to is_current
        ay = AcademicYear.objects.filter(school=school, start_date__lte=today, end_date__gte=today).first()
        if not ay:
            ay = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not ay:
            return Response({'detail': 'Current academic year not found for today and no fallback set'}, status=404)
        # Determine current term by date, fallback to is_current
        term = Term.objects.filter(academic_year=ay, start_date__lte=today, end_date__gte=today).first()
        if not term:
            term = Term.objects.filter(academic_year=ay, is_current=True).first()
        if not term:
            return Response({'detail': 'Current term not found for today and no fallback set'}, status=404)
        return Response(self.get_serializer(term).data)

    @action(detail=False, methods=['get'], permission_classes=[IsTeacherOrAdmin], url_path='of-current-year')
    def of_current_year(self, request):
        """List all terms for the current academic year for the user's school."""
        school = getattr(request.user, 'school', None)
        if not school:
            return Response({'detail': 'No school associated with user'}, status=400)
        today = timezone.localdate()
        ay = AcademicYear.objects.filter(school=school, start_date__lte=today, end_date__gte=today).first()
        if not ay:
            ay = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not ay:
            return Response({'detail': 'Current academic year not found for today and no fallback set'}, status=404)
        qs = Term.objects.filter(academic_year=ay).order_by('number')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin], url_path='set-current')
    def set_current(self, request, pk=None):
        term = self.get_object()
        term.is_current = True
        term.save()
        return Response({'detail': 'Current term updated'})

# ===== Bulk import endpoints =====
@api_view(["POST"])
@permission_classes([IsAdmin])
@parser_classes([MultiPartParser])
def import_students(request):
    """CSV columns: admission_no,name,dob(YYYY-MM-DD),gender,guardian_id,class_id(optional)
    Uses request.user.school for scoping and allows linking to class by ID.
    """
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'file is required'}, status=400)
    text = io.StringIO(file.read().decode('utf-8'))
    reader = csv.DictReader(text)
    created = 0
    errors = []
    for i, row in enumerate(reader, start=1):
        try:
            klass_id = row.get('class_id') or None
            klass = Class.objects.filter(id=klass_id).first() if klass_id else None
            Student.objects.create(
                admission_no=row['admission_no'],
                name=row['name'],
                dob=row['dob'],
                gender=row.get('gender',''),
                guardian_id=row.get('guardian_id',''),
                klass=klass,
            )
            created += 1
        except Exception as e:
            errors.append({'row': i, 'error': str(e)})
    return Response({'created': created, 'errors': errors}, status=201)


@api_view(["POST"])
@permission_classes([IsAdmin])
@parser_classes([MultiPartParser])
def import_competencies(request):
    """CSV columns: code,title,description,levels (comma-separated)"""
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'file is required'}, status=400)
    text = io.StringIO(file.read().decode('utf-8'))
    reader = csv.DictReader(text)
    created = 0
    updated = 0
    for row in reader:
        levels = [s.strip() for s in (row.get('levels') or '').split(',') if s.strip()]
        obj, is_created = Competency.objects.update_or_create(
            code=row['code'],
            defaults={
                'title': row.get('title',''),
                'description': row.get('description',''),
                'level_scale': levels or ["Emerging","Developing","Proficient","Mastered"],
            }
        )
        created += 1 if is_created else 0
        updated += 0 if is_created else 1
    return Response({'created': created, 'updated': updated}, status=201)
