from django.db import models
from django.contrib.auth.models import AbstractUser

class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    motto = models.CharField(max_length=255, blank=True)
    aim = models.TextField(blank=True)
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    social_links = models.JSONField(default=dict, blank=True)  # {"facebook":"","twitter":"","instagram":"","youtube":"","website":""}

    def __str__(self):
        return self.name

class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        TEACHER = 'teacher', 'Teacher'
        STUDENT = 'student', 'Student'
        FINANCE = 'finance', 'Finance'

    role = models.CharField(max_length=20, choices=Roles.choices)
    phone = models.CharField(max_length=20, blank=True)
    school = models.ForeignKey(School, null=True, blank=True, on_delete=models.SET_NULL)
