# MFA access policy and release checklist (#50, #86–#94)

## Policy

| Session | Protected data/actions | Public job and profile listings | Verification/logout |
| --- | --- | --- | --- |
| Signed out | Denied | Allowed where existing public policies allow | Login/logout available |
| Signed in, no verified factor | Existing role/ownership rules | Allowed | Enrollment available |
| Verified factor, password only (`aal1`) | Denied | Allowed where public | Challenge and logout available |
| Verified factor, completed (`aal2`) | Existing role/ownership rules | Allowed | Factor management available |
| Assurance unavailable or inconsistent | Denied | Existing public rules | Retry or sign out |

Server checks supplement RLS; the RLS policy is the direct Supabase API boundary. The existing `private.careerconnect_mfa_allowed()` queries trusted verified factors and the session AAL claim. It is already applied to `resumes` and the `resumes` Storage bucket. The pending dashboard script extends it to account data and other private files. The `project-images` bucket is private; `profile-images` is public. Known public profile-image URLs remain accessible. Changing that scope requires a separate bucket migration and URL strategy.

| Protected operation | Server entry | Database/Storage boundary |
| --- | --- | --- |
| Own profiles and sections | `/profile` layout; profile services/actions | `profiles`, `profile_*` restrictive MFA policies |
| Applications and cover letters | `/jobs` actions, `/application-status` layout | `applications`, `cover_letters` |
| Resumes and downloads | `/upload-resume` layout and seven actions | `resumes`, private `resumes` bucket |
| Recruiter comparisons and requirements | recruiter routes and comparison service | `job_requirements`, `candidate_evaluations`, applicant sections |
| Recruiter job mutations | recruiter actions | `job` INSERT/UPDATE/DELETE policies |
| Image mutations | profile and project image routes/services | profile/project image tables and Storage write policies |

## Deployment

1. Review the current dashboard schema and policies against the branch; confirm the resume helper and policies already exist. Confirm TOTP MFA is enabled in Supabase Auth settings and the enrollment limits match the intended backup-factor count.
2. Apply [`pending-mfa-policy.sql`](./pending-mfa-policy.sql) in the **Supabase dashboard SQL editor** in an isolated test environment first. Use a transaction and review for duplicate policy names; do not apply the same policy twice. Inspect the generated SQL with a teammate.
3. Following [`how-to-migrate.md`](./how-to-migrate.md), run `supabase db pull` to record the actual remote changes on the branch. Do not use `db push`. The pending SQL script is review material, not a generated migration.
4. Repeat in the intended environment after direct API checks. Review any live auth hooks, email confirmation and password-reset redirects; password reset must never remove factors. Auth configuration and hooks are not fully represented by repository files.

## Direct acceptance evidence to record

Use disposable job seeker and recruiter accounts. Record environment, branch commit, expected result and actual result. Do not record tokens, TOTP seeds, cookies or signed URLs.

- No-MFA account: normal role-appropriate login and owned operations.
- MFA account: enroll and verify, log out, password login, challenge; before verification, direct GET/POST to protected pages, actions, API routes, table REST endpoints and private Storage requests must fail. Invalid codes and modified browser state must not change this.
- After verification, own data and authorized recruiter applicant data work; another user's records/files remain inaccessible.
- Repeat with an old session from before enrollment, refreshed session, interrupted enrollment, a backup factor, removal of one factor and removal of the last factor. Test network failures and rate limits.
- Try direct factor removal with an `aal1` session. Supabase must reject it. An existing `aal2` token can still call Supabase Auth's unenroll endpoint directly without the application's fresh-code UI; strict server-enforced recency requires an Auth-level control outside this frontend.

The resume actions issue 60-second signed URLs. A previously issued URL can remain usable until expiry after logout or factor changes. Do not claim immediate revocation. Review other file URL issuers before release.

## Rollback

In the dashboard, drop only the policies introduced by `pending-mfa-policy.sql` (the twelve account-data policies, three `job` policies, one cover-letter and three image policies). Then `db pull` the resulting remote schema and review the diff. Do not remove the existing resume helper or resume policies as part of this rollback. Rollback weakens protection for enrolled accounts; restrict access while coordinating it.

## Recovery

Users should enroll a second authenticator before losing the first. If every factor is lost, password reset and email confirmation do not bypass MFA. There is no application self-service removal. The team must establish an identity verification and administrator procedure before promising account recovery; never put an administrator key in client code. Support and identity-verification ownership remain an operational decision.
