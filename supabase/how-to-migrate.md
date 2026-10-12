HOW TO TRACK SUPABASE DATABASE CHANGES

**1. Install the required tools**

- **Node.js:** https://nodejs.org/
- **Docker Desktop:** https://www.docker.com/products/docker-desktop/
- **Supabase CLI documentation:** https://supabase.com/docs/guides/local-development/cli/getting-started
- **Git:** https://git-scm.com/downloads

Docker Desktop must be running when using `db pull`. The Supabase CLI is already included as a project dependency.

**2. Set up the project**

Clone the CareerConnect repository and open a terminal in its root folder.

Install the project dependencies if you have not yet:

```bash
npm install
```

Log in to Supabase:

```bash
npx supabase login
```

Link the project (only once per local setup):

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with our Supabase project reference.

**3. Get the latest migration history**

Before tracking new changes, switch to `dev` and get the latest team changes:

```bash
git checkout dev
git pull origin dev
```

If you are working on a feature branch, merge or rebase the latest `dev` changes into your branch as appropriate. This ensures you have the team's latest migration files.

**4. Make and track database changes**

Make database changes directly in the Supabase dashboard.

From the CareerConnect root folder, run:

```bash
npx supabase db pull
```

Review the generated SQL file inside `supabase/migrations/`. It contains the schema differences detected by Supabase and may include multiple changes in one file.

**5. Share the migration file**

Commit the generated migration file to your feature branch, push it to GitHub, and open a pull request into `dev`.

Other members should get the latest migration files with `git pull`; they should not independently run `db pull` for the same changes.

**IMPORTANT RULES**

- **NEVER run `npx supabase db push`.** We make schema changes through the Supabase dashboard, not by applying migrations from the terminal.
- Migration files are for **tracking and sharing database changes in GitHub**. Committing them does not change the online database.
- `db pull` reads the online schema and generates local migration files. If prompted to update the remote migration history, coordinate with the team before approving. This updates tracking records, not the actual schema.
- Do not edit or delete migration files that have already been shared without coordinating with the team.
- Only one member should pull and record a particular set of dashboard changes to avoid duplicate or conflicting migrations.
- Review generated SQL before committing it.

**Remember:** Supabase dashboard = make database changes. Migration files + GitHub = track and share those changes.