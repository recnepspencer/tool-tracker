from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, models

from companies.constraints import ScopedForeignKey


class Command(BaseCommand):
    help = (
        "Compare declared scoped foreign keys with PostgreSQL; fail on drift or missing coverage."
    )

    def add_arguments(self, parser):
        parser.add_argument("--database", default="default")

    def handle(self, *args, **options):
        connection = connections[options["database"]]
        if connection.vendor != "postgresql":
            raise CommandError("This schema requires PostgreSQL.")
        errors = []
        count = 0
        with connection.cursor() as cursor:
            for model in apps.get_models():
                if model._meta.app_label not in {"companies", "equipment", "work", "evidence"}:
                    continue
                declared = {
                    c.name: c for c in model._meta.constraints if isinstance(c, ScopedForeignKey)
                }
                # Adding a new company-owned relationship must also add its scope constraint.
                for field in model._meta.local_fields:
                    if not isinstance(field, models.ForeignKey):
                        continue
                    local_names = {f.name for f in model._meta.local_fields}
                    remote_names = {f.name for f in field.remote_field.model._meta.local_fields}
                    if "company" in local_names & remote_names and not any(
                        c.field == field.name and "company" in c.scope for c in declared.values()
                    ):
                        errors.append(
                            f"{model._meta.label}.{field.name}: missing company scope declaration"
                        )
                cursor.execute(
                    """
                    SELECT c.conname,
                        ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(n, pos)
                              JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.pos),
                        c.confrelid::regclass::text,
                        ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(n, pos)
                              JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.pos),
                        c.convalidated, c.condeferrable, c.confmatchtype, c.confupdtype, c.confdeltype
                    FROM pg_constraint c
                    WHERE c.conrelid=to_regclass(%s) AND c.contype='f' AND cardinality(c.conkey)>1
                    """,
                    [model._meta.db_table],
                )
                actual = {row[0]: row[1:] for row in cursor.fetchall()}
                for name, constraint in declared.items():
                    local, target, remote = constraint.columns(model)
                    expected = (local, target, remote, True, False, "s", "a", "a")
                    if actual.get(name) != expected:
                        errors.append(
                            f"{model._meta.label}.{name}: expected {expected!r}; found {actual.get(name)!r}"
                        )
                    count += 1
                for name in actual.keys() - declared.keys():
                    errors.append(
                        f"{model._meta.label}.{name}: database constraint has no model declaration"
                    )
            cursor.execute(
                """SELECT tgname FROM pg_trigger
                   WHERE NOT tgisinternal AND
                   ((tgrelid=to_regclass('tool_assets') AND tgname='active_asset_custody') OR
                    (tgrelid=to_regclass('custody_periods') AND tgname='active_period_custody'))"""
            )
            errors.extend(
                f"Obsolete custody trigger remains: {row[0]}" for row in cursor.fetchall()
            )
        if errors:
            raise CommandError("Database schema drift:\n" + "\n".join(errors))
        self.stdout.write(
            self.style.SUCCESS(f"Verified {count} scoped foreign keys against PostgreSQL.")
        )
