# Secret management

Store local secrets in ignored environment files and remote secrets in each provider's encrypted environment store. Use distinct values per environment, least privilege, documented owners and rotation after suspected exposure. `NEXT_PUBLIC_*` is public. Never place service/secret keys, CMS write tokens, customer data or controlled evidence in browser bundles, Git, Sanity public datasets, logs or fixtures.

Secret scanning uses the default gitleaks rules plus one narrow allowlist in `.gitleaks.toml`: hyphenated lowercase Sanity `_key` slugs in `tooling/content/draft-dataset.ndjson` only (ADR-025); any other value in that file is still scanned. The CI scanner is pinned to the version the allowlist was validated against (`GITLEAKS_VERSION: 8.28.0` in `.github/workflows/secret-scan.yml`).
