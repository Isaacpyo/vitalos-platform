# Container architecture

```mermaid
flowchart TB
Web[apps/web deployable] --> UI[@vitalos/ui]
Web --> Validation[@vitalos/validation]
Web --> CMS[@vitalos/cms]
Studio[apps/studio deployable] --> CMS
Storybook[apps/storybook private workbench] --> UI
Web --> DB[(Operational PostgreSQL)]
SuperAdmin[superadmin Django deployable] --> SADB[(Super Admin PostgreSQL)]
SuperAdmin -. read-only /api/v1 .-> Consumers[Internal API consumers]
```

The web, Studio, Storybook and Super Admin are independent build/deployment units. Storybook is not public by default. Super Admin is an internal Django application with its own database and toolchain and no source imports in either direction (ADR-016).
