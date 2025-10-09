import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Ensure .env takes precedence over any pre-set OS environment variables
load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = [h for h in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost').split(',') if h]

# Add ngrok domain for temporary public exposure
NGROK_HOST = "c714cb9ba36c.ngrok-free.app"
if NGROK_HOST not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(NGROK_HOST)

NGROK_ORIGIN = f"https://{NGROK_HOST}"
if NGROK_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(NGROK_ORIGIN)

# Also include HTTP in case the tunnel is accessed via http
NGROK_ORIGIN_HTTP = f"http://{NGROK_HOST}"
if NGROK_ORIGIN_HTTP not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(NGROK_ORIGIN_HTTP)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework.authtoken',
    'drf_spectacular',
    'django_filters',
    'corsheaders',
    'storages',

    'accounts',
    'academics',
    'finance',
    'communications',
    'reports',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'edutrack.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'edutrack.wsgi.application'

# Database configuration
# Allow a lightweight SQLite fallback for local development when USE_SQLITE=True
USE_SQLITE = os.getenv('USE_SQLITE', 'False') == 'True'
if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'db_sqlite_vlqp',
            'USER': 'db_sqlite_vlqp_user',
            'PASSWORD': 'ugcfHwgU2vfxy41xXF2zhneR2XkEDZkI',
            'HOST': 'dpg-d3imnjnfte5s7393kfc0-a.oregon-postgres.render.com',
            'PORT': '5432',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'EDU-TRACK API',
    'DESCRIPTION': 'CBC-ready School Management System API',
    'VERSION': '1.0.0',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('TIME_ZONE', 'Africa/Nairobi')
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# S3 storage (DigitalOcean Spaces or AWS S3)
USE_S3 = os.getenv('USE_S3', 'False') == 'True'
if USE_S3:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', None)  # For DO Spaces
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False

    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
    }

CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'
CORS_ALLOWED_ORIGINS = [o for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o]

# Ensure ngrok origin is allowed for CORS when not fully open
if not CORS_ALLOW_ALL_ORIGINS:
    if NGROK_ORIGIN not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN)
    if NGROK_ORIGIN_HTTP not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(NGROK_ORIGIN_HTTP)

# Email configuration (use environment variables; defaults are Gmail-friendly)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
SERVER_EMAIL = os.getenv('SERVER_EMAIL', DEFAULT_FROM_EMAIL)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Frontend base URL for welcome page login button
FRONTEND_URL = os.getenv('FRONTEND_URL', os.getenv('VITE_API_BASE_URL', 'http://localhost:5173'))

# Africa's Talking (SMS) configuration
AT_USERNAME = os.getenv('AT_USERNAME', 'sandbox')
AT_API_KEY = os.getenv('AT_API_KEY', '')
# Optional sender id or short code (leave empty for sandbox default)
AT_SENDER_ID = os.getenv('AT_SENDER_ID', '')
# When on sandbox, we typically use REST to avoid SDK WhatsApp sandbox issues.
AT_USE_REST_FOR_SANDBOX = os.getenv('AT_USE_REST_FOR_SANDBOX', 'True') == 'True'
# Optional: simulate SMS success in development when delivery fails (for demos/tests)
SMS_LOOPBACK = os.getenv('SMS_LOOPBACK', 'False') == 'True'

# Control whether creating chat messages queues email/SMS delivery
MESSAGES_QUEUE_DELIVERY = os.getenv('MESSAGES_QUEUE_DELIVERY', 'True') == 'True'
