# Primary owner: `admin@vitalos.co.uk` (finding F7)

Prepared for approval. Nothing has been run. Changing, disabling or renaming the primary-owner account, or any user, role or 2FA setting, is an approval item (RUN-PROMPT 0.2).

## What is true now (from the code and the review)

- One user carries `is_primary_owner=True` (database constraint `accounts_single_primary_owner`). Only the primary owner can grant or revoke SuperAdmin; the app will not demote or deactivate them (`apps/accounts/services.py`).
- `admin@vitalos.co.uk` was created by `create_owner` (`PRIMARY_OWNER_EMAIL`), is a superuser, and per the review has never signed in. A shared, generic mailbox as the only account that can change super admins is a weak point: nobody is personally accountable for it, and it has no authenticator yet.
- `NOTIFY_OWNER_EMAIL` decides who hears about every new enquiry; when it is empty, that falls back to the primary owner.

## Options

|     | Option                                               | What changes                                                                                                                                                                          | Risk                                                                                                                                             | Effort                    |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| A   | **Make Temitope the primary owner** (recommended)    | The flag moves to Temitope's own account. `admin@` stays a super admin.                                                                                                               | Low. Reversible with the same command.                                                                                                           | One command.              |
| B   | **A, then turn `admin@` into a break-glass account** | As A. Then `admin@` gets a long random password kept offline (a password manager vault the owner controls) and its own authenticator, and is used only if Temitope's account is lost. | Low, if the vault and authenticator are really separate from Temitope's own.                                                                     | A, plus about 15 minutes. |
| C   | **A, then deactivate `admin@`**                      | As A. Then `admin@` is deactivated in Settings → Users (possible once it is no longer the primary owner).                                                                             | Medium: one person holds the only owner account; losing it needs a database-level recovery (`create_owner --transfer` run in the Container App). | A, plus one click.        |

Recommendation: **B**. It gives a named, accountable owner and keeps a tested way back in.

## Steps for option A (and the start of B and C)

Prerequisites, checked by the command: Temitope's account exists, is active and has a confirmed authenticator.

1. Temitope signs in and confirms two-factor sign-in is on (Account & security).
2. Dry run in the production Container App (prints the current and new owner and changes nothing):
   `python manage.py transfer_primary_owner --to temitope.agbola@vitalos.co.uk`
3. If it reads right: `python manage.py transfer_primary_owner --to temitope.agbola@vitalos.co.uk --apply`. The change is written to the audit trail as "Set the primary owner".
4. **Before the next deploy**, set `PRIMARY_OWNER_EMAIL=temitope.agbola@vitalos.co.uk` in the GitHub Production environment variables (or remove it). The release job (`bin/release.sh`) runs `create_owner` whenever the variable is set; with `admin@` still in it, `create_owner` stops with "already the primary owner. Pass --transfer", the release job fails and the deploy stops. It never moves ownership back by itself.
5. Decide `NOTIFY_OWNER_EMAIL` (who hears about every new enquiry). Leave it empty to follow the primary owner.

For **B**: sign in once as `admin@` using a setup link (`python manage.py issue_setup_link --email admin@vitalos.co.uk`, printed to the terminal only), set a long random password, enrol an authenticator on a device kept apart from Temitope's, store both in the vault, sign out. Test it once a quarter.

For **C**: Settings → Users → Edit `admin@vitalos.co.uk` → untick Active.

## Rollback

`python manage.py transfer_primary_owner --to admin@vitalos.co.uk --apply` (once `admin@` has an authenticator), or `python manage.py create_owner --email admin@vitalos.co.uk --transfer`.

## Needs Temitope

- Choose A, B or C.
- Confirm the address of his own account (assumed above: `temitope.agbola@vitalos.co.uk`).
- Confirm who should get every new-enquiry email (`NOTIFY_OWNER_EMAIL`).
