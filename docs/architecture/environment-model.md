# Environment model

```mermaid
flowchart LR
Local --> Preview --> Staging --> Production
Git[Pull request] --> Preview
Main[Protected main] --> Staging
Tag[Approved tagged release] --> Production
```

Use isolated secrets/data, noindex preview/staging, production-only analytics and no copied live enquiries. Vercel Preview is current intent; dedicated staging depends on plan/workflow justification.
