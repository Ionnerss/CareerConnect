# MFA access policy and authentication audit

Related issues: #50, #86.
Related enforcement and validation tasks: #87–#94.

## Scope

CareerConnect supports optional authenticator-app MFA.

Users without a verified authenticator retain normal access under existing
role and ownership rules. Users with a verified authenticator must complete
MFA before accessing protected account data.

MFA supplements authorization. Completing MFA never grants access to
another user's data or changes a user's role.

This document records the code audit, required configuration, deployment
order, and remaining live verification.

## Session access rules

| Session | Protected data/actions | Public resources |
| --- | --- | --- |
| Signed out | Denied | Existing public access rules |
| Signed in, no verified factor, AAL1 | Existing role/ownership rules | Existing public access rules |
| Verified factor enrolled, AAL1 | Denied until MFA verification | Existing public access rules |
| Verified factor enrolled, AAL2 | Existing role/ownership rules | Existing public access rules |
| Assurance unavailable or inconsistent | Application guards deny access | Existing public access rules |

An unverified setup does not count as enabled MFA.

Application guards reject the stale AAL2/next-AAL1 combination.
The database helper has a different boundary: it permits authenticated
AAL2 tokens or authenticated users with no currently verified factor.
Do not describe these two checks as identical.

## Protected surface inventory

| Surface | Application boundary | Database/Storage boundary |
| --- | --- | --- |
| Dashboard | Protected route/session checks | Policies on underlying account data |
| Profile and profile sections | Profile layout, services, and actions | profiles and profile section tables |
| Applications | Jobs actions and application-status layout | applications |
| Cover letters | Application/document operations | cover_letters table and private bucket |
| Resumes | upload-resume layout and guarded actions | resumes table and private resumes bucket |
| Recruiter comparisons | Recruiter routes and comparison services | job_requirements, candidate_evaluations, applicant data |
| Recruiter job mutations | Recruiter actions | job INSERT, UPDATE, DELETE |
| Project images | Image services/routes | profile_project_images and private project-images bucket |
| Profile image mutations | Image services/routes | profile-images Storage write policies |

Account-data restrictive policies cover:

- applications
- candidate_evaluations
- job_requirements
- profile_education
- profile_experience
- profile_preference_languages
- profile_preferences
- profile_project_images
- profile_project_links
- profile_projects
- profile_skills
- profiles

Public listings remain subject to their existing public policies.
The application may require authentication for a route even when some
underlying listing data is public.

The profile-images bucket is public. Known public image URLs are not
made private by MFA checks on uploads, changes, or deletions.

## Authorization boundaries

1. Route checks guide users to login or MFA verification.
2. Server checks protect content, actions, and API operations independently.
3. Restrictive RLS policies protect direct database and Storage requests.

Relevant application files:

- web/src/lib/supabase/middleware.ts
- web/src/lib/auth/mfa.ts
- web/src/lib/auth/require-mfa.ts
- web/src/components/auth/login-form.tsx
- web/src/components/auth/mfa-challenge.tsx
- web/src/app/auth/mfa/page.tsx
- web/src/app/auth/actions.ts

The database helper is private.careerconnect_mfa_allowed().
It reads verified factors from auth.mfa_factors and the authenticated
token's AAL claim. Browser flags are not authorization evidence.

The audited resume Server Action exception in middleware only avoids
redirecting those POST requests. Each action must still enforce its
own authentication and MFA requirements.

New protected operations must enforce MFA before accessing data.
Privileged clients can bypass RLS and require separate authorization review.

## Authentication flow audit

### Password sign-in

The login flow checks MFA assurance before reading the protected profile
role. An enrolled AAL1 user must complete the challenge before protected
application access.

Users without MFA continue through the normal role-based flow.

### Verification and logout

/auth/mfa is outside the protected-route redirect list.
It checks authentication without requiring completed MFA.

This avoids redirecting the challenge page back to itself.
The challenge provides sign-out, and logout does not require AAL2.

Return destinations must remain safe internal paths. They do not grant
authorization to the destination.

### Password reset

No application password-reset implementation was found in the reviewed
source: no resetPasswordForEmail, PASSWORD_RECOVERY, or password-update
handler was present.

Therefore, an application recovery flow is not being declared tested.

Any recovery flow added later must preserve enrolled factors and require
the same MFA authorization for protected data. A recovery email must not
be treated as proof of second-factor verification.

The hosted recovery email destination and resulting session must be
checked separately before a supported recovery flow is released.

### Email confirmation

No application verifyOtp or exchangeCodeForSession callback handler was
found in the reviewed source.

The committed local configuration disables email confirmations.
That does not establish the hosted project's configuration.

Email confirmation and recruiter eligibility are separate from MFA.
Confirming an email must not grant AAL2 or remove an enrolled factor.

Review hosted confirmation settings, email links, and redirect destinations.
Test the configured confirmation flow before marking its live behavior passed.

### Existing sessions

The database helper checks current verified-factor records. Consequently,
an older AAL1 token should be denied protected database/Storage access once
a verified factor exists, even if that session predates enrollment.

Application navigation must also reject or challenge an enrolled AAL1
session. Test this using two independent browser sessions.

An existing valid AAL2 session is allowed by policy. This feature does
not promise a new OTP for every operation.

Do not assume logout, factor changes, or password changes immediately
invalidate every previously issued access token or signed file URL.
Record actual deployed behavior, including expiry and refresh behavior.

## Required Supabase configuration

Committed local configuration:

- TOTP enrollment enabled.
- TOTP verification enabled.
- Maximum enrolled factors: 10.
- Phone MFA disabled.
- Site URL: http://127.0.0.1:3000.
- Additional redirect URL: https://127.0.0.1:3000.
- Email confirmations disabled locally.

Before deployment, verify the hosted project separately:

- TOTP enrollment and verification are enabled.
- Factor limits support the intended backup-authenticator flow.
- Site URL matches the deployed application.
- Redirect allowlist contains the intended application destinations.
- Confirmation and recovery emails point to supported destinations.
- Confirmation requirements match the intended signup policy.
- Private buckets remain private.
- MFA migrations and existing ownership policies are present.
- Client code uses the publishable key, never a privileged server key.

Do not copy local loopback URLs into production configuration.
supabase/config.toml alone is not evidence of hosted configuration.

## Implementation and deployment order

1. Review the access policy and protected-surface inventory.
2. Configure and verify TOTP support.
3. Deploy enrollment, challenge, and logout support.
4. Deploy server-side checks, including MFA checks before protected role reads.
5. Apply reviewed database and Storage migrations in timestamp order.
6. Verify direct AAL1 denial, AAL2 access, and ownership restrictions.
7. Verify authentication lifecycle scenarios below.
8. Record results before closing #86.

Relevant committed migrations:

- 20261101054516_require_mfa_for_resumes.sql
- 20261101074321_require_mfa_for_resume_storage.sql
- 20261101094954_require_mfa_for_account_data.sql

Apply prerequisites and other repository migrations in their normal order.
These filenames are not an instruction to skip intervening migrations.

The account-data migration also contains function and resume-policy changes;
review the entire migration before applying it.

If SQL was already applied through the dashboard and captured with db pull,
check migration history and the deployed schema before applying anything again.
Do not execute CREATE POLICY statements twice.

## Verification record

Use disposable accounts and record the environment and tested commit.
Never record passwords, access tokens, OTP codes, or authenticator seeds.

| Check | Required result | Status |
| --- | --- | --- |
| Signed-out protected access | Denied | Pending |
| No-MFA user | Normal authorized access | Pending |
| Enrolled user after password login | Challenge; protected data denied | Pending |
| Valid second factor | Own authorized data accessible | Pending |
| Challenge and logout | Reachable without redirect loops | Pending |
| Password recovery configuration | Supported destination identified; no MFA bypass | Pending |
| Email confirmation | No AAL2 grant or factor removal from email alone | Pending |
| Older AAL1 session after enrollment elsewhere | Protected requests denied | Pending |
| Page reload and session refresh | MFA requirement preserved | Pending |
| Assurance lookup failure | Protected application access denied | Pending |
| Public listings and images | Match documented public policy | Pending |

For each executed check record:

- Date:
- Environment:
- Commit:
- Account role and initial MFA state:
- Steps:
- Observed result:
- Pass/fail:
- Sanitized evidence:

If a flow is unsupported, record that fact and its configuration explicitly.
Do not replace an unexecuted check with a claimed pass.

Detailed database/Storage acceptance evidence belongs to #90 and #94.
Full successful MFA sign-in acceptance evidence belongs to #93.
Link that evidence here instead of duplicating it.

### Signed resume URL lifetime — #90

These are user-reported manual tests with disposable PDFs. The signed URLs,
tokens, credentials, and authenticator codes were not recorded.

| Environment | Test date / commit | URL expiry | Check | Elapsed after issuance | HTTP | PDF bytes matched | Cache status |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| Hosted isolated test project | [8/11/26] / [ee01a3a] | 30 s | Before logout | 0.6 s | 200 | Yes | MISS |
| Hosted isolated test project | [8/11/26] / [ee01a3a] | 30 s | After logout, before expiry | 1.2 s | 200 | Yes | REVALIDATED |
| Hosted isolated test project | [8/11/26] / [ee01a3a] | 30 s | After expiry | 35.2 s | 400 | No | DYNAMIC |
| Local Supabase | [8/11/26] / [ee01a3a] | 600 s | Before adding backup factor | 0 s | 200 | Yes | No header |
| Local Supabase | [8/11/26] / [ee01a3a] | 600 s | After verifying backup factor, original factor retained | 123.7 s | 200 | Yes | No header |

The hosted test showed that logout did not stop use of an already issued URL
before its expiry. Its request after expiry returned 400. In the local test,
adding a verified backup factor did not stop use of the previously issued URL
at 123.7 seconds. A fresh password-only session for the MFA-enrolled account
could not issue a new signed URL.

These observations do not prove that every URL becomes inaccessible exactly
at expiry: CDN behavior and environments can differ. They also do not test
removing the original factor. The 600-second local URL was used only to allow
time for the manual factor-addition test; it is not the application's URL
duration. Resume view and download actions currently request 60-second URLs.

Treat an issued signed URL as a bearer link during its valid lifetime. Check
MFA and ownership before issuing a new one, and avoid presenting logout or a
factor change as immediate revocation of an already issued URL.

### Privileged-path and private-file audit — #90

This record separates code inspection from direct-request tests. The HTTP
results below are from local Supabase with disposable accounts and files;
they are not hosted-project verification.

#### Privileged client search

A case-insensitive recursive search of `web/src` for `service_role`,
`sb_secret_`, `SUPABASE_SECRET`, `createAdminClient`, and `auth.admin.`
returned no matches. This is evidence for that source directory and those
search terms only. It does not establish that every privileged client path
in the repository or deployed environment is safe.

#### Security-definer functions

The local database inventory found two security-definer helpers executable
by `authenticated`:

- `private.careerconnect_mfa_allowed()` applies the verified-factor and
  session-AAL rule. The local API configuration does not expose the
  `private` schema as a Data API schema.
- `public.recruiter_can_view_profile(uuid)` is callable through the Data
  API. The original function allowed an MFA-enrolled recruiter at AAL1
  to infer an applicant relationship. The replacement requires
  `private.careerconnect_mfa_allowed()` while retaining the application
  and job-ownership check.

The remaining inventoried security-definer functions were attached to
table triggers or an event trigger: `create_public_profile()`,
`handle_new_user()`, `rls_auto_enable()`, `sync_public_profile_name()`,
`sync_recruiter_role()`, and `validate_application_resume()`. Their
function EXECUTE grants alone are not evidence of a callable HTTP RPC.
This inventory does not prove that every trigger path is safe.

A local database regression first reproduced the recruiter-helper AAL1
failure and passed after the function change. A direct local HTTP RPC test
then observed:

| Caller | Expected and observed result |
| --- | --- |
| Owning recruiter with a verified factor, AAL1 | Applicant relationship denied |
| Same recruiter, AAL2 | Applicant relationship accessible |
| Unrelated recruiter | Applicant relationship denied |

#### Private Storage requests

A local direct-request test used an applicant's real attached cover-letter
PDF and recorded project PNG. The applicant and owning recruiter could
access the files under their normal authorized conditions. After the
recruiter enrolled MFA, a fresh AAL1 session was denied access to both
private files; AAL2 restored the owning recruiter's access. An unrelated
recruiter remained denied. The test checked direct downloads and fresh
signed-URL requests, including downloaded file bytes.

These HTTP results were obtained locally, not on the hosted CareerConnect
project. The local `resumes` and `cover_letters` buckets used for live
testing were created manually; a fresh database reset removes that setup.
Document or automate their local creation before treating the live scripts
as reproducible from a clean checkout.

## Rollback

`supabase/pending-mfa-rollback.sql` is a policy-only rollback plan for:

- `20261101054516_require_mfa_for_resumes.sql`
- `20261101074321_require_mfa_for_resume_storage.sql`
- `20261101094954_require_mfa_for_account_data.sql`

It lists the restrictive MFA policies created by those migrations.
It does not revert application checks, database functions, or existing
ownership policies. In particular, it is not a complete rollback of
the MFA release.

For an actual rollback, review the deployed schema and prepare a
release-specific forward migration. Coordinate changes to application
access checks and database policies, then verify the resulting access
rules and migration history. Removing the restrictive policies weakens
protection of account data and files.

Do not execute the rollback plan during testing.

## Lost-device boundary

For this release, users should enroll a second authenticator on an
independent device before losing access to their first one.

If one authenticator is lost but another verified authenticator remains,
the user can sign in with the remaining factor. After signing in, they
can add a replacement, verify it, and then remove the lost factor.

If every authenticator is lost, this release provides no supported
account-recovery or MFA-reset procedure. The user cannot complete MFA
or access protected account data through the application. Password
reset, email confirmation, and access to an email account do not serve
as a replacement for an enrolled authenticator.

Support must not promise or perform a factor reset under an
undocumented process. Administrator-assisted recovery would require a
separately approved identity-verification procedure, authorized
operators, and an auditable process before it could be offered.

This policy does not restore access to an existing account when all
factors are lost. Review and approve this release policy with the team
before marking #91 complete.

## Completion rule for #86

Close #86 when:

- The policy and protected-surface inventory have been reviewed.
- Hosted configuration and deployment order have been confirmed.
- Password reset, email confirmation, and existing-session behavior have
  recorded outcomes or explicit unsupported-flow decisions.
- Verification and logout have been checked for redirect loops.
- Any discovered implementation defect has been fixed or explicitly tracked
  as a blocking issue.

Documentation alone does not establish successful live verification.