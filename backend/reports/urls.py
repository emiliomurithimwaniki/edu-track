from django.urls import path
from .views import summary, clear_cache

urlpatterns = [
    path('summary/', summary, name='reports-summary'),
    path('clear-cache/', clear_cache, name='reports-clear-cache'),
]
