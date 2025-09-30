#!/usr/bin/env python
"""
Migration Reset Script for EDU-TRACK
This script will safely reset the migration state for conflicting apps.
"""

import os
import sys
import django
from django.db import connection
from django.core.management import execute_from_command_line

# Add the backend directory to Python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')

# Setup Django
django.setup()

def reset_migration_state():
    """Reset migration state for problematic apps."""
    with connection.cursor() as cursor:
        # Delete migration records for accounts and academics apps
        cursor.execute("DELETE FROM django_migrations WHERE app IN ('accounts', 'academics')")
        print("✓ Deleted migration records for accounts and academics apps")

def main():
    print("🔧 EDU-TRACK Migration Reset Tool")
    print("=" * 50)

    print("\nThis script will:")
    print("1. Reset migration state for accounts and academics apps")
    print("2. Delete existing migration files")
    print("3. Recreate migrations from scratch")
    print("4. Apply all migrations")

    confirm = input("\n⚠️  This will reset your database migrations. Continue? (yes/no): ")

    if confirm.lower() != 'yes':
        print("❌ Operation cancelled.")
        return

    try:
        print("\n📋 Step 1: Resetting migration state...")
        reset_migration_state()

        print("\n📋 Step 2: Deleting migration files...")
        import shutil

        # Delete migration directories
        migration_dirs = [
            os.path.join(backend_dir, 'accounts', 'migrations'),
            os.path.join(backend_dir, 'academics', 'migrations')
        ]

        for mig_dir in migration_dirs:
            if os.path.exists(mig_dir):
                # Keep only __init__.py
                for file in os.listdir(mig_dir):
                    if file != '__init__.py':
                        file_path = os.path.join(mig_dir, file)
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            print(f"  🗑️  Deleted: {file_path}")
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                            print(f"  🗑️  Deleted: {file_path}")

        print("\n📋 Step 3: Creating new migrations...")
        # Change to backend directory to run management commands
        os.chdir(backend_dir)

        print(f"\nChanged working directory to: {os.getcwd()}")

        # Make new migrations
        execute_from_command_line(['manage.py', 'makemigrations', 'accounts'])
        execute_from_command_line(['manage.py', 'makemigrations', 'academics'])

        print("\n📋 Step 4: Applying migrations...")
        # Apply all migrations
        execute_from_command_line(['manage.py', 'migrate'])

        print("\n✅ Migration reset completed successfully!")
        print("🎉 You can now run your seeding scripts.")

    except Exception as e:
        print(f"\n❌ Error during migration reset: {e}")
        import traceback
        traceback.print_exc()
        print("\n🔧 Manual steps to try:")
        print("1. Delete all files in accounts/migrations/ and academics/migrations/ except __init__.py")
        print("2. Run: python manage.py makemigrations accounts")
        print("3. Run: python manage.py makemigrations academics")
        print("4. Run: python manage.py migrate")

if __name__ == '__main__':
    main()
