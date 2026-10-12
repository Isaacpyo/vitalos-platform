# Secret management

Store local secrets in ignored environment files and remote secrets in each provider's encrypted environment store. Use distinct values per environment, least privilege, documented owners and rotation after suspected exposure. `NEXT_PUBLIC_*` is public. Never place service/secret keys, CMS write tokens, customer data or controlled evidence in browser bundles, Git, Sanity public datasets, logs or fixtures.

Secret scanning uses the default gitleaks rules (`.gitleaks.toml`) with no allowlists.
