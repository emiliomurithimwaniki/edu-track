from rest_framework import serializers
from .models import Class, Student, Competency, Assessment, Attendance, TeacherProfile, Subject, Exam, ExamResult, AcademicYear, Term, Stream, LessonPlan, ClassSubjectTeacher, SubjectGradingBand, Room, TimetableEntry
from django.contrib.auth import get_user_model

User = get_user_model()

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id','code','name','school']

class StreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stream
        fields = ['id', 'name', 'school']
        extra_kwargs = {
            'school': {'read_only': True}
        }

class SubjectGradingBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectGradingBand
        fields = ['id','subject','grade','min','max','order']

class TeacherUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id','username','first_name','last_name','email','role']

class ClassSubjectTeacherSerializer(serializers.ModelSerializer):
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)
    class Meta:
        model = ClassSubjectTeacher
        fields = ['id','klass','subject','teacher','teacher_detail','assigned_at']

class ClassSerializer(serializers.ModelSerializer):
    subjects = SubjectSerializer(many=True, read_only=True)
    subject_ids = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), many=True, write_only=True, required=False, source='subjects')
    stream_detail = StreamSerializer(source='stream', read_only=True)
    subject_teachers = ClassSubjectTeacherSerializer(many=True, read_only=True)
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)

    class Meta:
        model = Class
        fields = ['id', 'name', 'grade_level', 'stream', 'stream_detail', 'teacher', 'teacher_detail', 'school', 'subjects', 'subject_ids', 'subject_teachers']
        extra_kwargs = {
            'school': {'read_only': True},
            'name': {'read_only': True}
        }

class StudentSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True, required=False, allow_null=True)
    # Include class details for better display on dashboards
    klass_detail = ClassSerializer(source='klass', read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Student
        fields = [
            'id','admission_no','name','dob','gender','guardian_id','klass','klass_detail','user','user_id',
            'passport_no','phone','email','address','photo','photo_url'
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if getattr(obj, 'photo', None):
            try:
                url = obj.photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return None
        return None

class CompetencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Competency
        fields = ['id','code','title','description','level_scale']

class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = ['id','student','teacher','competency','level','comment','evidence','date']

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['id','student','date','status','recorded_by']

class LessonPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonPlan
        fields = ['id','teacher','klass','subject','date','topic','objectives','activities','resources','assessment','created_at']


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id','name','school']
        extra_kwargs = {
            'school': {'read_only': True}
        }


class TimetableEntrySerializer(serializers.ModelSerializer):
    klass_detail = ClassSerializer(source='klass', read_only=True)
    subject_detail = SubjectSerializer(source='subject', read_only=True)
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)
    room_detail = RoomSerializer(source='room', read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            'id','term','day_of_week','start_time','end_time',
            'klass','klass_detail','subject','subject_detail','teacher','teacher_detail','room','room_detail',
            'notes','created_at','updated_at'
        ]


class TeacherProfileSerializer(serializers.ModelSerializer):
    user = TeacherUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True)
    # Include class details so the frontend can show the actual class name (e.g., "Grade 6 C")
    klass_detail = ClassSerializer(source='klass', read_only=True)
    class Meta:
        model = TeacherProfile
        fields = ['id','user','user_id','subjects','klass','klass_detail']


class ExamSerializer(serializers.ModelSerializer):
    inferred_academic_year = serializers.SerializerMethodField(read_only=True)
    inferred_term = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Exam
        fields = ['id','name','year','term','klass','date','total_marks','published','published_at','inferred_academic_year','inferred_term']

    def _infer_year_and_term(self, exam):
        school = getattr(getattr(exam.klass, 'school', None), 'id', None)
        if not school or not exam.date:
            return None, None
        ay = AcademicYear.objects.filter(school_id=school, start_date__lte=exam.date, end_date__gte=exam.date).first()
        if not ay:
            return None, None
        term = Term.objects.filter(academic_year=ay, start_date__lte=exam.date, end_date__gte=exam.date).first()
        return ay, term

    def get_inferred_academic_year(self, obj):
        ay, _ = self._infer_year_and_term(obj)
        if not ay:
            return None
        return { 'id': ay.id, 'label': ay.label, 'start_date': ay.start_date, 'end_date': ay.end_date }

    def get_inferred_term(self, obj):
        ay, term = self._infer_year_and_term(obj)
        if not (ay and term):
            return None
        return { 'id': term.id, 'number': term.number, 'name': term.name, 'start_date': term.start_date, 'end_date': term.end_date, 'academic_year': ay.id }


class ExamResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamResult
        fields = ['id','exam','student','subject','marks']


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ['id','academic_year','number','name','start_date','end_date','is_current']


class AcademicYearSerializer(serializers.ModelSerializer):
    terms = TermSerializer(many=True, read_only=True)
    class Meta:
        model = AcademicYear
        fields = ['id','school','label','start_date','end_date','is_current','terms']
        extra_kwargs = {
            'school': {'read_only': True}
        }
