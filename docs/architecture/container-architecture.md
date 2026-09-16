# Container architecture

```mermaid
flowchart TB
Web[apps/web deployable] --> UI[@vitalos/ui]
Web --> Validation[@vitalos/validation]
Web --> CMS[@vitalos/cms]
Studio[apps/studio deployable] --> CMS
Storybook[apps/storybook private workbench] --> UI
Web --> DB[(Operational PostgreSQL)]
```

The web, Studio and Storybook are independent build/deployment units. Storybook is not public by default.
