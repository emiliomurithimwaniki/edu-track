# EDU-TRACK Data Seeding Guide

This guide explains how to seed your EDU-TRACK database with realistic test data.

## Quick Start

### Seed Everything at Once
```bash
python seed_all_data.py
```
This will seed schools, classes, teachers, students, payments, and exam results in one go.

---

## Individual Seeding Commands

### 1. Seed Basic Data (Schools, Classes, Teachers, Students)

```bash
python manage.py seed_data
```

**Options:**
- `--schools <number>` - Number of schools to create (default: 5)
- `--teachers-per-school <number>` - Teachers per school (default: 30)
- `--students-per-school <number>` - Students per school (default: 900)
- `--streams-per-school <number>` - Streams per school (default: 2)

**Example:**
```bash
python manage.py seed_data --schools 3 --teachers-per-school 20 --students-per-school 200
```

**What it creates:**
- Schools with realistic names and details
- Streams (A, B, C, etc.)
- Subjects (Mathematics, English, Science, etc.)
- Classes (Grade 1-9 with streams)
- Teacher accounts and profiles
- Student accounts and profiles
- Class-subject-teacher assignments

---

### 2. Seed Payment Data (Invoices & Payments)

```bash
python manage.py seed_payments
```

**Options:**
- `--invoices-per-student <number>` - Invoices per student (default: 3)
- `--payments-per-invoice <number>` - Average payments per invoice (default: 2)
- `--clear` - Clear existing payment data before seeding

**Example:**
```bash
python manage.py seed_payments --invoices-per-student 5 --payments-per-invoice 2
```

**What it creates:**
- Fee categories (Tuition, Transport, Lunch, etc.)
- Class fees for each term
- Student invoices with various statuses
- Payment records with different methods (M-Pesa, Bank, Cash, Cheque)
- Realistic payment scenarios:
  - Full payments
  - Partial payments
  - Overpayments
  - Unpaid invoices

**Key Feature:** Creates payments WITHOUT validating fee assignments or balances - just records the transactions!

---

### 3. Seed Exam Results

```bash
python manage.py seed_results
```

**Options:**
- `--exams-per-class <number>` - Number of exams per class (default: 3)
- `--clear` - Clear existing exam and result data before seeding

**Example:**
```bash
python manage.py seed_results --exams-per-class 5
```

**What it creates:**
- Exams for each class with various types:
  - Mid-Term Exam
  - End of Term Exam
  - CAT 1, CAT 2
  - Mock Exam
  - Final Exam
  - Monthly Test
  - Weekly Quiz
- Exam results for all students in each subject
- Realistic mark distributions:
  - Excellent: 80-100%
  - Good: 65-79%
  - Average: 50-64%
  - Below Average: 35-49%
  - Poor: 0-34%
- Published and unpublished exams
- 5% absence rate (some students missing results)

---

## Clearing Data

To clear specific data before re-seeding:

### Clear All Data
```bash
python manage.py seed_data --schools 0
```
This will clear students, teachers, classes, streams, subjects, and schools.

### Clear Payment Data Only
```bash
python manage.py seed_payments --clear
```

### Clear Exam Results Only
```bash
python manage.py seed_results --clear
```

---

## Typical Workflow

### For Development
```bash
# Quick test with minimal data
python manage.py seed_data --schools 1 --teachers-per-school 5 --students-per-school 20
python manage.py seed_payments --invoices-per-student 2
python manage.py seed_results --exams-per-class 2
```

### For Demo/Testing
```bash
# Realistic data volumes
python manage.py seed_data --schools 3 --teachers-per-school 20 --students-per-school 300
python manage.py seed_payments --invoices-per-student 4 --payments-per-invoice 2
python manage.py seed_results --exams-per-class 4
```

### For Load Testing
```bash
# Large data volumes
python manage.py seed_data --schools 10 --teachers-per-school 50 --students-per-school 1000
python manage.py seed_payments --invoices-per-student 10
python manage.py seed_results --exams-per-class 6
```

---

## Default Credentials

All seeded users have the default password: **`password123`**

### Username Format

**Teachers:**
```
{firstname}.{lastname}.{counter}.{schoolcode}
Example: john.smith.001.sch001
```

**Students:**
```
{firstname}.{lastname}.{counter}.{schoolcode}
Example: emma.johnson.001.sch001
```

---

## Data Statistics

After seeding, you'll see summaries like:

```
Summary:
  - Schools: 2
  - Classes: 36
  - Teachers: 30
  - Students: 200
  - Fee Categories: 16
  - Invoices Created: 400
  - Payments Created: 320
  - Exams Created: 72
  - Results Created: 14400

Invoice Status Breakdown:
  - Paid: 120
  - Partial: 180
  - Unpaid: 100

Exam Status Breakdown:
  - Published: 54
  - Unpublished: 18

Performance Statistics:
  - Average Marks: 58.34
```

---

## Troubleshooting

### "No schools found" error
Run the basic data seeding first:
```bash
python manage.py seed_data
```

### "UNIQUE constraint failed" error
This has been fixed! The seeding scripts now use unique counters for usernames.

### Database locked error
Make sure no other processes are accessing the database. Stop the Django server before seeding.

### Out of memory
Reduce the number of records:
```bash
python manage.py seed_data --schools 1 --students-per-school 50
```

---

## Notes

1. **Idempotent Operations**: Some operations (like creating schools) use `get_or_create` to avoid duplicates.

2. **Realistic Data**: All data uses Faker library for realistic names, addresses, and other details.

3. **Relationships**: The scripts maintain proper relationships between entities (students → classes → schools, etc.).

4. **Performance**: Large data volumes may take several minutes to seed. Be patient!

5. **Payment Logic**: Payments are created WITHOUT checking for fee assignments or balances - they simply record the transaction and update the invoice status.

---

## Support

For issues or questions, check the main README.md or contact the development team.
