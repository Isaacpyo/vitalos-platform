# Careers roles review (B7)

Written for the WS4 review run on 17 October 2026, as a read-only review. No role was opened, edited, paused or closed.

The production admin is not reachable from this run, and the orchestrator confirmed no export of roles would come. So:

- **Part A** checks the three open roles against their public pages. That is the source of truth for what candidates see.
- **Part B** sets out how to review the seven draft roles. It gives the rubric and the exact read-only command the owner can run. Verdicts are left blank, not guessed.

## A. Open roles, as published (GET on 17 Oct 2026)

Read from the role pages and their `JobPosting` JSON-LD:

- https://vitalos.co.uk/careers/senior-technology-consultant
- https://vitalos.co.uk/careers/senior-software-engineer
- https://vitalos.co.uk/careers/ai-data-engineer

| Role | Practice | Level | Location | Work model | Employment | Salary shown | JSON-LD salary | Posted |
|---|---|---|---|---|---|---|---|---|
| Senior Technology Consultant | Consulting | Senior (L3) | United Kingdom | Hybrid | Permanent | £70,000–£85,000 a year | GBP 70000–85000 YEAR | 2026-10-16 12:14 UTC |
| Senior Software Engineer | Engineering | Senior (L3) | United Kingdom | Remote | Permanent | £70,000–£85,000 a year | GBP 70000–85000 YEAR | 2026-10-16 12:12 UTC |
| AI & Data Engineer | AI & Data | Professional (L2) | United Kingdom | Remote | Permanent | **£65,000–£80,000 a year** | GBP 65000–80000 YEAR | 2026-10-16 12:13 UTC |

None of the three has a closing date, a stated sponsorship position or its own hiring process. All three use the website form.

### Findings

1. **Two bands are the same, not three.** FINDINGS B7 says all three open roles show £70,000–£85,000. As of 17 Oct, the AI & Data Engineer shows **£65,000–£80,000**. Only the two Senior roles share £70,000–£85,000.
2. **Whether the shared Senior band was copied cannot be told from public data.** Both roles are level Senior (L3). CAR-05 (Verified) describes a seven-level framework "linking each level to scope and impact", so one band per level would be consistent with it. No source says pay is set by level, though. Three facts point the other way:
   - The roles are in different practices.
   - One is Hybrid and one is Remote.
   - They were posted within two minutes of each other, which is consistent with one being made with **Duplicate** in the admin. Duplicate copies every working field, salary included (`superadmin/apps/careers/services.py` `duplicate_role`).
3. **AI & Data Engineer is the same band shifted down by £5,000.** It is level Professional (L2), and the lower band fits a lower level. Again, no source states the banding.
4. **"United Kingdom" as the location of a Hybrid role.** A hybrid role usually names where the in-person time happens. The JSON-LD previously sent `addressLocality: "United Kingdom"`, a country in a locality field. WS4 changed the website to send `addressCountry: "GB"` for "United Kingdom" or "UK" (`apps/web/src/features/content/careers/model.ts`). The wording on the page itself is the owner's to decide. **GAP: needs owner input.** Is there a base city or region for in-person time on the Senior Technology Consultant role? "In-person time with clients is used where it adds value" is already in its About text.

### What would confirm each band

| Role | Evidence that would confirm the band | Where |
|---|---|---|
| Senior Technology Consultant | The owner's pay decision or benchmarking note for Consulting L3; the role's first revision and `careers.role_created` audit event, which together show whether the salary was entered or came from a duplicate | Admin › Careers › Roles › role › revision history; Admin › Audit (filter `careers.role_`); query below |
| Senior Software Engineer | The same, for Engineering L3. If a `careers.role_duplicated` audit event exists with `source` = the Consultant's id (or the other way round), the band was copied and needs a deliberate confirmation | Same |
| AI & Data Engineer | The owner's pay decision for AI & Data L2. Also: was it ever £70,000–£85,000? If earlier revisions show the band changed from that, it was copied and then corrected | Same |

## B. The seven draft roles

**Status: follow-up.** The run could not read production. No verdicts are given until the owner runs the command below, or reads the Drafts tab.

### Rubric: one verdict per draft

Each verdict comes from the admin's own rule for opening a role (`docs/content/BRIEF.md` 7.4) and the run's integrity rule.

- **ready to open:** title, practice, location, work model, employment type, summary, About and Requirements are all filled. The salary has a min and max (max ≥ min) or is deliberately hidden. No sentence makes a claim beyond an approved source. Not a duplicate.
- **needs salary:** everything else is ready, but `salary_min` or `salary_max` is empty and `show_salary` is on. Or the band equals another role's band and that is not a deliberate decision (check for a `careers.role_duplicated` audit event).
- **needs approval:** the text includes facts no source supports: benefits, an office, a team size, client names, or a process or salary policy that differs from `CAREERS-SETTINGS-DRAFT.md`. Or the role is a placeholder. The repo once held "Senior Engineer / Technical Lead (placeholder role)" (`packages/cms/src/draft/content/careers.ts`, slug `senior-engineer-technical-lead`, "No vacancy exists"). `import_repo_content` refuses placeholders, but check whether a copy reached the admin.
- **duplicate:** the title ends "(copy)", or the title and practice match an open role or another draft.

### Verdicts

| # | Draft (slug) | Verdict | Reason |
|---|---|---|---|
| 1–7 | not visible from this run | — | Fill in from the output of the command below |

### Read-only command for the owner

This prints roles only: no applicant or other personal data. It writes nothing. Run it from a machine signed in to Azure. Container and resource-group names are as in `superadmin/docs/email-setup.md`.

```sh
az containerapp exec -n superadmin -g rg-vitalos-superadmin --command "python manage.py shell"
```

Then paste:

```python
from apps.audit.models import AuditEvent
from apps.careers.models import Role
rows = Role.objects.filter(status__in=["draft", "open"]).order_by("status", "title")
for r in rows:
    print(" | ".join(str(v) for v in [
        r.status, r.slug, r.title, r.practice or "-", r.level or "-", r.location_text or "-",
        r.work_model or "-", r.employment_type or "-", r.salary_min, r.salary_max, r.salary_period,
        "shown" if r.show_salary else "hidden",
        "summary" if r.summary.strip() else "NO summary",
        "about" if r.about_md.strip() else "NO about",
        "reqs" if r.requirements_md.strip() else "NO reqs",
        "own process" if r.process_md.strip() else "default process",
        r.created_at.date(), r.updated_at.date(),
    ]))
dups = AuditEvent.objects.filter(action="careers.role_duplicated").values_list("created_at", "entity_id", "summary", "metadata")
for d in dups:
    print("DUPLICATED", *d)
for r in Role.objects.filter(status="open"):
    for rev in r.revisions.order_by("published_at"):
        print("REVISION", r.slug, rev.published_at, {k: v for k, v in rev.snapshot.items() if "salar" in k.lower()})
```

Type `exit()` to leave. Paste the output into this file, or into the Careers GitHub issue (#43), and fill in the verdict table.

Without a shell, use **Admin › Careers › Roles › Drafts**. That tab shows title, practice, location and status. Open each draft for the salary and its section text, and open the revision history on each open role.
