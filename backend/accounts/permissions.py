from rest_framework.permissions import BasePermission

class IsRole(BasePermission):
    def __init__(self, role: str):
        self.role = role
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == self.role)

class IsAnyRole(BasePermission):
    def __init__(self, roles):
        self.roles = set(roles)
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in self.roles)

class IsAdminOrStaff(BasePermission):
    """Allow if custom role is admin or Django staff/superuser"""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (getattr(u, 'role', None) == 'admin' or u.is_staff or u.is_superuser))
