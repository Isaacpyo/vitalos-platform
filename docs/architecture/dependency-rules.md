# Dependency rules

```mermaid
flowchart LR
Apps --> Packages
Adapters --> DomainInterfaces
DomainInterfaces --> Contracts
Services -. versioned API or event .-> Apps
```

No app-to-app source imports, cycles, client imports of server-only packages, or shared-database services. `dependency-cruiser` enforces the graph; package exports define public APIs.
