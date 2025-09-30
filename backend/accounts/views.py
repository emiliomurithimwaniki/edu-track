from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
import json
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, SchoolSerializer
from .permissions import IsAdminOrStaff
from django.db import IntegrityError
from django.db.models import Q

User = get_user_model()

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users(request):
    """List users scoped to the current user's school by default (including staff/superusers).
    Supports filtering by `?role=teacher|admin|student|finance`.
    Staff/Superusers may explicitly override with `?school=<id>` to view another school.
    """
    role = request.query_params.get('role')
    q = request.query_params.get('q')
    param_school_id = request.query_params.get('school')
    qs = User.objects.all()
    # Scope by school: default to the request user's school for all roles
    user_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
    if param_school_id:
        # Explicit override only for staff/superusers
        if request.user.is_superuser or request.user.is_staff:
            qs = qs.filter(school_id=param_school_id)
        else:
            # Non-staff cannot override; keep to their school
            if user_school_id:
                qs = qs.filter(school_id=user_school_id)
            else:
                qs = qs.none()
    else:
        # No override provided: if the requester has a school, scope to it
        if user_school_id:
            qs = qs.filter(school_id=user_school_id)
        elif not (request.user.is_superuser or request.user.is_staff):
            # Regular users without a school should see nothing
            qs = qs.none()
    if role:
        qs = qs.filter(role=role)
    if q:
        q = q.strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
            )
    qs = qs.order_by('id')
    return Response(UserSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def create_user(request):
    """Admin creates a user. Body: username, password, role, first_name, last_name, email, phone, school(optional id)
    Returns created user profile.
    """
    data = request.data
    username = data.get('username')
    password = data.get('password') or User.objects.make_random_password()
    role = data.get('role')
    if not username or not role:
        return Response({"detail": "username and role are required"}, status=400)
    school_id = data.get('school') or getattr(request.user.school, 'id', None)
    try:
        user = User.objects.create_user(
            username=username,
            password=password,
            role=role,
            email=data.get('email',''),
            first_name=data.get('first_name',''),
            last_name=data.get('last_name',''),
            phone=data.get('phone',''),
            school_id=school_id,
        )
    except IntegrityError as e:
        # Most likely a duplicate username or school constraint
        return Response({"detail": "Username already exists or violates a constraint", "error": str(e)}, status=400)
    return Response(UserSerializer(user).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def update_user_status(request):
    """Activate/deactivate user: body {user_id, is_active} """
    user_id = request.data.get('user_id')
    is_active = request.data.get('is_active')
    if user_id is None or is_active is None:
        return Response({"detail": "user_id and is_active required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)
    # Scope: only modify users within your school unless staff/superuser
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        # Also prevent modifying staff/superusers
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)
    u.is_active = bool(is_active)
    u.save(update_fields=['is_active'])
    return Response(UserSerializer(u).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def reset_password(request):
    """Reset a user's password: body {user_id, new_password} """
    user_id = request.data.get('user_id')
    new_password = request.data.get('new_password')
    if not user_id or not new_password:
        return Response({"detail": "user_id and new_password required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)
    # Scope: only modify users within your school unless staff/superuser
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        # Prevent resetting staff/superuser accounts
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to reset staff/superuser passwords"}, status=403)
    u.set_password(new_password)
    u.save(update_fields=['password'])
    return Response({"detail": "Password reset"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Authenticated user changes their own password.
    Body: {old_password, new_password}
    """
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    if not old_password or not new_password:
        return Response({"detail": "old_password and new_password required"}, status=400)
    user = request.user
    if not user.check_password(old_password):
        return Response({"detail": "Old password is incorrect"}, status=400)
    if len(new_password) < 6:
        return Response({"detail": "New password must be at least 6 characters"}, status=400)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    return Response({"detail": "Password changed"})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def update_user(request):
    """Update a user's profile (no password updates here).
    Body can include: user_id (required), first_name, last_name, email, phone, username, role.
    Role changes are allowed but only for non-staff/superuser targets and subject to school scoping.
    """
    user_id = request.data.get('user_id')
    if not user_id:
        return Response({"detail": "user_id is required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)

    # School scoping and protections
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)

    # Apply allowed fields only (explicit allowlist)
    allowed_fields = ['first_name','last_name','email','phone','username']
    requested_role = request.data.get('role', None)
    for field in allowed_fields:
        if field in request.data and request.data.get(field) is not None:
            setattr(u, field, request.data.get(field))
    # Handle role update with strict checks
    if requested_role is not None:
        # Only allow valid roles defined on the model
        valid_roles = {c[0] for c in User._meta.get_field('role').choices}
        if requested_role not in valid_roles:
            return Response({"detail": "Invalid role"}, status=400)
        # Prevent modifying staff/superuser roles via this endpoint
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)
        # Non-staff requesters are limited to their school (already enforced above) and cannot set privileged Django flags here
        u.role = requested_role
        allowed_fields.append('role')

    # Explicitly ignore any 'password' in payload
    u.save(update_fields=[f for f in allowed_fields if f in request.data or f == 'role' and requested_role is not None])
    return Response(UserSerializer(u).data)


@api_view(["GET","PUT","PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def school_me(request):
    """Get or update the current admin's School. PUT/PATCH accepts name, code, address."""
    school = getattr(request.user, 'school', None)
    if request.method == 'GET':
        if not school:
            return Response({"detail": "No school linked to this admin"}, status=404)
        return Response(SchoolSerializer(school, context={"request": request}).data)
    # update
    if not school:
        return Response({"detail": "No school linked. Create a School and link the user via Django Admin first."}, status=400)
    # Build a plain payload dict (avoid QueryDict string coercion) and coerce social_links
    data = request.data
    social_raw = data.get('social_links')
    parsed_social = {}
    if isinstance(social_raw, (dict, list)):
        parsed_social = social_raw
    elif social_raw in (None, '', b''):
        parsed_social = {}
    elif isinstance(social_raw, (bytes, bytearray)):
        try:
            parsed_social = json.loads(social_raw.decode('utf-8'))
        except Exception:
            parsed_social = {}
    elif isinstance(social_raw, str):
        try:
            parsed_social = json.loads(social_raw)
        except Exception:
            parsed_social = {}

    payload = {
        'name': data.get('name', school.name),
        'code': data.get('code', school.code),
        'address': data.get('address', school.address),
        'motto': data.get('motto', getattr(school, 'motto', '')),
        'aim': data.get('aim', getattr(school, 'aim', '')),
        'social_links': parsed_social,
    }
    if 'logo' in request.FILES:
        payload['logo'] = request.FILES['logo']

    serializer = SchoolSerializer(school, data=payload, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(SchoolSerializer(school, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def school_info(request):
    """Return the School object linked to the authenticated user's account (read-only)."""
    school = getattr(request.user, 'school', None)
    if not school:
        return Response({"detail": "No school linked to this user"}, status=404)
    return Response(SchoolSerializer(school, context={"request": request}).data)
