import os
import django
from django.db import connection

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.edutrack.settings')
django.setup()

def delete_migrations(app_name):
    """Deletes migration records for a given app from the database."""
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM django_migrations WHERE app = %s", [app_name])
        print(f"Deleted migration history for app: {app_name}")

if __name__ == "__main__":
    print("This script will reset the migration history for 'academics' and 'accounts' apps.")
    confirm = input("Are you sure you want to continue? (yes/no): ")

    if confirm.lower() == 'yes':
        try:
            delete_migrations('academics')
            delete_migrations('accounts')
            print("\nMigration history reset successfully.")
            print("Please delete the migration files in 'academics/migrations' and 'accounts/migrations' (except for __init__.py).")
            print("Then run 'python manage.py makemigrations' and 'python manage.py migrate'.")
        except Exception as e:
            print(f"An error occurred: {e}")
    else:
        print("Operation cancelled.")
