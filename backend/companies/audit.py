"""The consumer-owned bridge to CleanForce's transactional audit outbox."""

from backend_platform.audit import AuditActor, AuditSubject, build_audit_event, record_audit_event


def record_company_event(identity, company_id, event_key, entity, *, metadata=None):
    actor_id = identity.actor_user_id or identity.user_id
    record_audit_event(
        build_audit_event(
            event_key=event_key,
            subject=AuditSubject(
                domain=entity._meta.app_label,
                entity_type=entity._meta.model_name,
                entity_id=str(entity.pk),
            ),
            actor=AuditActor(
                user_id=actor_id,
                email=identity.actor_email or identity.email,
                principal_id=identity.principal_id or actor_id,
                effective_user_id=identity.user_id,
                effective_email=identity.email,
                is_impersonating=identity.is_impersonating,
            ),
            metadata={"company_id": str(company_id), **(metadata or {})},
        )
    )
