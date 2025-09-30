# Custom migration to align state: declare User.school field without DB change
# This avoids duplicate column errors because the column already exists from 0004.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_user_school"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="school",
                    field=models.ForeignKey(
                        to="accounts.school",
                        on_delete=django.db.models.deletion.SET_NULL,
                        null=True,
                        blank=True,
                    ),
                ),
            ],
            database_operations=[],
        )
    ]
