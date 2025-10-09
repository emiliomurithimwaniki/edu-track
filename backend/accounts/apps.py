from django.apps import AppConfig

class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        # This is a temporary solution to create a superuser on Render's free tier.
        # This code will run every time the app starts.
        # After you successfully log in, this should be removed.
        import os
        from django.contrib.auth import get_user_model

        User = get_user_model()
        username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if all([username, email, password]):
            if not User.objects.filter(username=username).exists():
                print(f'Creating superuser {username}...')
                User.objects.create_superuser(username=username, email=email, password=password)
                print('Superuser created.')
            else:
                # Optional: If you suspect the password is wrong, you can force-update it.
                # user = User.objects.get(username=username)
                # user.set_password(password)
                # user.save()
                # print(f'Superuser {username} password updated.')
                pass
