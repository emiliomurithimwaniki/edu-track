from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import me, users, create_user, update_user_status, reset_password, school_me, update_user, change_password, school_info

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', me, name='me'),
    path('users/', users, name='users'),
    path('users/create/', create_user, name='users-create'),
    path('users/update/', update_user, name='users-update'),
    path('users/status/', update_user_status, name='users-status'),
    path('users/reset_password/', reset_password, name='users-reset-password'),
    path('users/change_password/', change_password, name='users-change-password'),
    path('school/me/', school_me, name='school-me'),
    path('school/info/', school_info, name='school-info'),
]
