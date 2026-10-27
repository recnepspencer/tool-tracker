"""Model-declared foreign keys that also bind a relationship's company/asset scope."""

from django.core import checks
from django.core.exceptions import FieldDoesNotExist, ValidationError
from django.db import DEFAULT_DB_ALIAS, models
from django.db.backends.ddl_references import Columns, Statement, Table


class ScopedForeignKey(models.BaseConstraint):
    """Augment a normal ForeignKey with matching scope fields on both records.

    Keep this import path stable: historical migrations serialize this class.
    PostgreSQL supplies MATCH SIMPLE / NO ACTION semantics. The normal Django
    ForeignKey continues to own ORM traversal and deletion behavior.
    """

    def __init__(self, *, field, scope=("company",), name, **kwargs):
        self.field = field
        self.scope = tuple(scope)
        super().__init__(name=name, **kwargs)

    def deconstruct(self):
        path, args, kwargs = super().deconstruct()
        kwargs.update(field=self.field, scope=self.scope)
        return path, args, kwargs

    def __eq__(self, other):
        if isinstance(other, ScopedForeignKey):
            return self.deconstruct() == other.deconstruct()
        return NotImplemented

    def columns(self, model):
        relation = model._meta.get_field(self.field)
        target = relation.remote_field.model
        local = [model._meta.get_field(name).column for name in (*self.scope, self.field)]
        remote = [target._meta.get_field(name).column for name in self.scope]
        return local, target._meta.db_table, [*remote, relation.target_field.column]

    def constraint_sql(self, model, schema_editor):
        # Defer CREATE TABLE constraints until referenced tables/unique keys exist.
        schema_editor.deferred_sql.append(self.create_sql(model, schema_editor))
        return None

    def create_sql(self, model, schema_editor):
        local, table, remote = self.columns(model)
        quote = schema_editor.quote_name
        return Statement(
            "ALTER TABLE %(table)s ADD CONSTRAINT %(name)s "
            "FOREIGN KEY (%(columns)s) REFERENCES %(target)s (%(target_columns)s)",
            table=Table(model._meta.db_table, quote),
            name=quote(self.name),
            columns=Columns(model._meta.db_table, local, quote),
            target=Table(table, quote),
            target_columns=Columns(table, remote, quote),
        )

    def remove_sql(self, model, schema_editor):
        quote = schema_editor.quote_name
        return f"ALTER TABLE {quote(model._meta.db_table)} DROP CONSTRAINT {quote(self.name)}"

    def _check(self, model, connection):
        errors = []
        if connection.vendor != "postgresql":
            errors.append(
                checks.Error("ScopedForeignKey requires PostgreSQL.", id="companies.E001")
            )
        try:
            relation = model._meta.get_field(self.field)
            if not isinstance(relation, models.ForeignKey) or not self.scope:
                raise ValueError("Specify a ForeignKey and at least one scope field.")
            target = relation.remote_field.model
            for name in self.scope:
                source_field = model._meta.get_field(name)
                target_field = target._meta.get_field(name)
                if (
                    source_field not in model._meta.local_fields
                    or target_field not in target._meta.local_fields
                ):
                    raise ValueError("Scope fields must be local to both tables.")
            self.columns(model)
        except (FieldDoesNotExist, AttributeError, ValueError) as exc:
            errors.append(checks.Error(f"{self.name}: {exc}", obj=model, id="companies.E002"))
        return errors

    def validate(self, model, instance, exclude=None, using=DEFAULT_DB_ALIAS):
        names = (*self.scope, self.field)
        if set(names).intersection(exclude or ()):
            return
        fields = [model._meta.get_field(name) for name in names]
        values = [getattr(instance, field.attname) for field in fields]
        if any(value is None for value in values):
            return  # PostgreSQL MATCH SIMPLE permits nullable references.
        relation = fields[-1]
        target = relation.remote_field.model
        lookups = (*self.scope, relation.target_field.name)
        if (
            not target._default_manager.using(using)
            .filter(**dict(zip(lookups, values, strict=True)))
            .exists()
        ):
            raise ValidationError(
                self.get_violation_error_message(), code=self.violation_error_code
            )
