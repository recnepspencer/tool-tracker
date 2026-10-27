from django.db import migrations

# A plain UUID foreign key does not prove both records belong to the same company.
RELATIONSHIPS = [
    ("tool_models", "category_id", "tool_categories", "model_category_company"),
    ("tool_assets", "tool_model_id", "tool_models", "asset_model_company"),
    ("tool_assets", "origin_warehouse_id", "warehouses", "asset_origin_company"),
    ("tool_assets", "responsible_warehouse_id", "warehouses", "asset_warehouse_company"),
    ("tool_assets", "registered_by_id", "company_memberships", "asset_registrar_company"),
    ("custody_periods", "asset_id", "tool_assets", "custody_asset_company"),
    ("custody_periods", "holder_membership_id", "company_memberships", "custody_member_company"),
    ("custody_periods", "holder_warehouse_id", "warehouses", "custody_warehouse_company"),
    ("asset_incidents", "asset_id", "tool_assets", "incident_asset_company"),
    ("asset_incidents", "reported_by_id", "company_memberships", "incident_reporter_company"),
    ("tool_requests", "asset_id", "tool_assets", "request_asset_company"),
    ("tool_requests", "requester_id", "company_memberships", "request_member_company"),
]

CUSTODY_SQL = """
CREATE FUNCTION nelson_assert_active_custody(asset_uuid uuid) RETURNS void AS $$
DECLARE asset_state text;
BEGIN
    SELECT lifecycle INTO asset_state FROM tool_assets WHERE id = asset_uuid FOR UPDATE;
    IF FOUND AND asset_state = 'active' AND
       (SELECT count(*) FROM custody_periods
        WHERE asset_id = asset_uuid AND ends_at IS NULL) <> 1 THEN
        RAISE EXCEPTION 'Active asset % requires exactly one open custody period', asset_uuid
            USING ERRCODE = '23514', CONSTRAINT = 'active_asset_requires_custody';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION nelson_check_asset_custody() RETURNS trigger AS $$
BEGIN
    PERFORM nelson_assert_active_custody(NEW.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION nelson_check_period_custody() RETURNS trigger AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM nelson_assert_active_custody(OLD.asset_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM nelson_assert_active_custody(NEW.asset_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER active_asset_custody
AFTER INSERT OR UPDATE ON tool_assets
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nelson_check_asset_custody();

CREATE CONSTRAINT TRIGGER active_period_custody
AFTER INSERT OR UPDATE OR DELETE ON custody_periods
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nelson_check_period_custody();
"""


class Migration(migrations.Migration):
    dependencies = [("equipment", "0001_initial")]
    operations = [
        *[
            migrations.RunSQL(
                f"ALTER TABLE {table} ADD CONSTRAINT {name} "
                f"FOREIGN KEY (company_id, {column}) REFERENCES {target} (company_id, id)",
                f"ALTER TABLE {table} DROP CONSTRAINT {name}",
            )
            for table, column, target, name in RELATIONSHIPS
        ],
        migrations.RunSQL(
            "ALTER TABLE tool_requests ADD CONSTRAINT request_source_same_asset "
            "FOREIGN KEY (company_id, asset_id, source_custody_id) "
            "REFERENCES custody_periods (company_id, asset_id, id)",
            "ALTER TABLE tool_requests DROP CONSTRAINT request_source_same_asset",
        ),
        migrations.RunSQL(
            CUSTODY_SQL,
            "DROP TRIGGER active_asset_custody ON tool_assets;"
            "DROP TRIGGER active_period_custody ON custody_periods;"
            "DROP FUNCTION nelson_check_asset_custody();"
            "DROP FUNCTION nelson_check_period_custody();"
            "DROP FUNCTION nelson_assert_active_custody(uuid);",
        ),
    ]
