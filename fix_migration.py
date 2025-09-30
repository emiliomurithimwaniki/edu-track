import os
import sys
import django
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent / 'backend'
sys.path.insert(0, str(backend_dir))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')
django.setup()

from django.db import connection
from django.core.management import execute_from_command_line

def check_database_state():
    """Check the current state of the database"""
    print("Checking database state...")

    with connection.cursor() as cursor:
        # Check django_migrations table
        cursor.execute('SELECT app, name, applied FROM django_migrations WHERE app = "accounts" ORDER BY applied')
        migrations = cursor.fetchall()
        print("Applied migrations:")
        for migration in migrations:
            print(f"  {migration[0]}.{migration[1]} - {migration[2]}")

        # Check accounts_user table schema
        cursor.execute("PRAGMA table_info(accounts_user)")
        columns = cursor.fetchall()
        print("\naccounts_user table columns:")
        for column in columns:
            print(f"  {column[1]} ({column[2]}) - {'NULL' if column[3] else 'NOT NULL'}")

def fix_migration():
    """Fix the migration issue"""
    print("Attempting to fix migration issue...")

    # First, let's try to mark the migration as applied without running it
    with connection.cursor() as cursor:
        # Check if migration 0004 is already recorded
        cursor.execute('SELECT * FROM django_migrations WHERE app = "accounts" AND name = "0004_remove_user_profile_picture_user_school"')
        result = cursor.fetchone()

        if result:
            print("Migration 0004 is already recorded in django_migrations")
        else:
            print("Recording migration 0004 as applied...")
            cursor.execute('INSERT INTO django_migrations (app, name, applied) VALUES ("accounts", "0004_remove_user_profile_picture_user_school", datetime("now"))')
            print("Migration 0004 recorded successfully")

if __name__ == "__main__":
    check_database_state()
    fix_migration()
