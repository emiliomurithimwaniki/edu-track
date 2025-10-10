from django.contrib import admin
from .models import Subject, SubjectComponent, Class, TeacherProfile, Student, Competency, Assessment, Attendance, AcademicYear, Term, Room, TimetableEntry, Exam, ExamResult

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "school")
    search_fields = ("code", "name")
    list_filter = ("school",)

@admin.register(SubjectComponent)
class SubjectComponentAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "code", "name", "max_marks", "weight", "order")
    list_filter = ("subject__school", "subject")
    search_fields = ("code", "name", "subject__code", "subject__name")

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "grade_level", "teacher", "school")
    list_filter = ("grade_level", "school")
    search_fields = ("name",)
    filter_horizontal = ("subjects",)

@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "subjects", "klass")
    search_fields = ("user__username", "user__first_name", "user__last_name", "subjects")

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("id", "admission_no", "name", "klass", "gender", "guardian_id", "is_graduated", "graduation_year")
    list_filter = ("gender", "klass__grade_level", "is_graduated", "graduation_year")
    search_fields = ("admission_no", "name", "guardian_id")

@admin.register(Competency)
class CompetencyAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "title")
    search_fields = ("code", "title")

@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "teacher", "competency", "level", "date")
    list_filter = ("date", "level")
    search_fields = ("student__name", "teacher__username", "competency__code")

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "date", "status")
    list_filter = ("date", "status")
    search_fields = ("student__name", "student__admission_no")


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("id", "label", "school", "start_date", "end_date", "is_current")
    list_filter = ("school", "is_current")
    search_fields = ("label",)


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = ("id", "academic_year", "number", "name", "start_date", "end_date", "is_current")
    list_filter = ("academic_year", "number", "is_current")
    search_fields = ("name",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school")
    list_filter = ("school",)
    search_fields = ("name",)


@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "term", "day_of_week", "start_time", "end_time", "klass", "subject", "teacher", "room")
    list_filter = ("term", "day_of_week", "klass__school", "klass", "subject", "teacher", "room")
    search_fields = ("klass__name", "subject__code", "subject__name", "teacher__username", "room__name")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "year", "term", "klass", "date", "total_marks", "published")
    list_filter = ("year", "term", "klass__school", "klass", "published")
    search_fields = ("name", "klass__name")

@admin.register(ExamResult)
class ExamResultAdmin(admin.ModelAdmin):
    list_display = ("id", "exam", "student", "subject", "component", "marks")
    list_filter = ("exam", "subject", "component", "exam__klass__school")
    search_fields = ("student__name", "subject__code", "subject__name", "exam__name")
