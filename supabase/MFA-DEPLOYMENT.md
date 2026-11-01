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

## Rollback

In the dashboard, drop only the policies introduced by `pending-mfa-policy.sql` (the twelve account-data policies, three `job` policies, one cover-letter and three image policies). Then `db pull` the resulting remote schema and review the diff. Do not remove the existing resume helper or resume policies as part of this rollback. Rollback weakens protection for enrolled accounts; restrict access while coordinating it.

## Recovery

Users should enroll a second authenticator before losing the first. If every factor is lost, password reset and email confirmation do not bypass MFA. There is no application self-service removal. The team must establish an identity verification and administrator procedure before promising account recovery; never put an administrator key in client code. Support and identity-verification ownership remain an operational decision.
