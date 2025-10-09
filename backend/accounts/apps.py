from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        # Create superuser only AFTER migrations when DB is ready
        import os
        from django.contrib.auth import get_user_model
        from django.db.models.signals import post_migrate

        def ensure_superuser(sender, **kwargs):
            username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
            email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
            password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

            if not all([username, email, password]):
                return

            User = get_user_model()
            if User.objects.filter(username=username).exists():
                return
            try:
                User.objects.create_superuser(username=username, email=email, password=password)
                print(f"Superuser '{username}' created after migrations.")
            except Exception as e:
                print(f"Failed to create superuser '{username}': {e}")

        post_migrate.connect(ensure_superuser, sender=self)
