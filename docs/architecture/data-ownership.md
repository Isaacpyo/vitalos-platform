# Data ownership

```mermaid
flowchart LR
Editors --> Sanity[(Editorial)] --> Web
Visitors --> Web --> Enquiries[(Operational enquiries)]
Enquiries --> Outbox[(Notification outbox)] --> Email[Email adapter]
Evidence[Controlled evidence repository future] -. approved references only .-> Trust[Public Trust content]
Staff[Vitalos staff] --> SuperAdmin[Super Admin] --> Architecture[(Company architecture, projects, KPIs, decisions)]
```

Email failure never removes a stored enquiry. Super Admin owns the internal company architecture records; they are classified Public/Internal/Confidential/Restricted, archived rather than deleted and fully history-tracked. Public clients have no table privileges. Extracted services must own their persistence.
