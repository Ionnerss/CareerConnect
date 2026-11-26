# Database development and deployment

CareerConnect uses version-controlled Supabase migrations for database changes.
Developers create and test migrations locally, submit a PR into `dev`, and
the Supabase GitHub integration deploys pending migrations after the merge.

**Merging into `dev` can change the live hosted database.**

## Deployment configuration

The team's configured Supabase GitHub integration uses:

- Repository: `Ionnerss/CareerConnect`
- Working directory: `.`
- Production branch: `dev`
- Deploy to production: enabled
- Automatic preview branching: disabled

GitHub Actions validates changes. The Supabase GitHub integration deploys them.
There is no separate GitHub Actions database deployment job.

The `dev` rules require an up-to-date branch, passing Web checks, Database
checks, and SonarCloud Code Analysis. A teammate's approving review is also
required.

## 1. Prepare your branch and local environment

Start from the latest `dev` and create a feature branch. Run database commands
from the repository root, where the `supabase/` directory lives.

Have Docker running before starting local Supabase.

The commands below pin Supabase CLI `2.122.1`, matching the current
[CI workflow](../.github/workflows/ci.yml). When upgrading the CLI, update and
validate the local instructions and CI together.

```bash
npx supabase@2.122.1 start
```

For application testing against the local database, use the local Supabase URL
and keys in your uncommitted `web/.env.local`. Confirm the application is using
the intended database before testing. Never commit credentials.

## 2. Create a migration

```bash
npx supabase@2.122.1 migration new describe_your_change
```

Replace `describe_your_change` with a meaningful name, such as
`add_application_notes`.

Write the SQL in the generated file:

```text
supabase/migrations/<timestamp>_describe_your_change.sql
```

Keep changes focused. Include the permissions, RLS policies, indexes, functions,
and triggers required by the feature.

Team rules:

- Use new migration files for routine database changes.
- Do not routinely apply schema changes in the hosted SQL Editor.
- Do not edit, rename, or delete migrations that have already been deployed.
  Make corrections through a new migration.
- Use `db pull` only for deliberate reconciliation of existing remote changes,
  not as the normal development workflow.
- Do not commit passwords, access tokens, connection strings containing secrets,
  or real user data.

## 3. Add or update database tests

Place pgTAP tests in:

```text
supabase/tests/database/
```

Cover the behavior affected by the migration. Where relevant, include:

- The intended operation succeeds.
- Other users cannot access or change the affected data.
- Invalid input is rejected.
- MFA requirements remain enforced.
- Existing behavior continues to work.

For changes affecting existing rows, also test the upgrade against
representative data locally. A successful clean reset alone does not establish
that an upgrade works on a populated database.

Coordinate destructive changes and application compatibility with the team
before merging.

## 4. Rebuild and test locally

```bash
npx supabase@2.122.1 db reset --local --no-seed
npx supabase@2.122.1 test db
```

The reset deletes local database data and rebuilds the database from migrations.
The explicit `--local` flag keeps this operation local.

Both commands must succeed. Fix migration or test failures before opening
the PR.

If the change affects application behavior, test that flow against local
Supabase and run the relevant application checks.

## 5. Open a PR into dev

Commit the migration, tests, and related application changes, then push your
feature branch and open a PR targeting `dev`.

Include:

- What changes in the database and why.
- Migration filenames.
- Local test results.
- Effects on existing data and application compatibility.
- Any deployment coordination or recovery steps.
- How to verify the affected behavior after deployment.

Wait for all required checks and teammate approval. If `dev` changes, update
your branch and let the required checks run again.

A skipped Supabase Preview check is expected while automatic preview branching
is disabled. It does not mean the migration was tested against a hosted preview
database.

## 6. Merge and verify deployment

Merging into `dev` triggers the configured Supabase GitHub integration.
It applies migration files that are not recorded in the hosted migration
history.

Do not also run a manual `db push` for the same routine deployment.

After merging:

1. Inspect the Supabase deployment status and migration logs for the merged
   commit.
2. Use a current checkout containing the merged migration files.
3. If this checkout is not linked, authenticate and link it to the correct
   team project:

   ```bash
   npx supabase@2.122.1 login
   npx supabase@2.122.1 link --project-ref <project-ref>
   ```

   Replace `<project-ref>` with the team's project reference. Enter credentials
   only through the CLI's prompts; do not put them in commits or PR comments.

4. Check migration history:

   ```bash
   npx supabase@2.122.1 migration list --linked
   ```

5. Confirm each new migration appears in both Local and Remote.
6. Verify the affected application flow using designated test accounts against
   the hosted database.
7. Record the deployment and verification result on the PR.

Matching migration versions confirms history alignment. It does not prove that
every schema object or application behavior is correct.

## Troubleshooting and recovery

### A deployment fails

Inspect the first migration error and the current remote migration history.
Do not assume that no migrations were applied: earlier files may have succeeded.

Coordinate with the team before retrying or changing database state. For
migrations already applied, use a new corrective migration. If a migration
never applied, inspect the failure before deciding how to correct and retry it.

Reverting a Git commit does not automatically undo SQL already applied to the
database. Data recovery may require a backup; coordinate that separately.

### Migration history does not match

First confirm the linked project and local checkout are correct.

Useful inspection commands:

```bash
npx supabase@2.122.1 migration list --linked
npx supabase@2.122.1 db push --linked --dry-run
```

The dry run lists pending migrations without applying them. It does not execute
the SQL or prove that deployment will succeed.

Do not blindly use `migration repair`. It changes migration history records,
not the actual schema. Reconcile schema state and history deliberately.

### Schema drift is suspected

For an initial comparison of application schemas:

```bash
npx supabase@2.122.1 db diff --linked --schema public,private
```

Review the output; do not automatically execute it. This comparison is scoped
to `public` and `private`, and function differences can include formatting
differences.

Storage policies, Realtime publication membership, cron jobs, and other
configuration may need separate inspection.

### An emergency dashboard change is necessary

Coordinate the change with the team, record exactly what was changed, and
reconcile it into version-controlled migrations and tests promptly. Verify both
a clean local rebuild and the hosted state before returning to routine
deployments.

## Initial rollout

PR #358 introduced three reconciliation migrations:

- `20261123030842_reconcile_notification_dismissal.sql`
- `20261123032108_reconcile_notification_realtime.sql`
- `20261123032639_reconcile_interview_reschedule.sql`

During rollout, the team verified a clean local reset, 131 passing database
tests across 14 files, passing CI, and matching remote migration versions after
the merge. The team also manually verified notification dismissal and interview
rescheduling against hosted Supabase.

These are historical rollout results, not a permanent test count or proof that
future migrations will succeed.

## References

- [CareerConnect CI workflow](../.github/workflows/ci.yml)
- [Reconciliation PR #358](https://github.com/Ionnerss/CareerConnect/pull/358)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)