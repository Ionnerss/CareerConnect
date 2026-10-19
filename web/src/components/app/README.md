# Signed-in app frame

Everything a logged-in person sees shares one frame: the brand font, the page
colour and the header (logo, Home, Jobs, Applications, Resume, Log out, your
initials). It lives here so no page has to build its own.

## How a page gets the frame

Each signed-in route folder has a small `layout.tsx`:

```tsx
export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell audience="job_seeker">{children}</AppShell>;
}
```

Today that is `jobs/`, `application-status/`, `upload-resume/` (job seekers) and
`recruiter/` (recruiters). **A new signed-in section needs the same layout with
the right `audience`, and nothing else.** If the person is not logged in, the shell sends them to
`/auth/login`, so a new section is protected even before it is added to
`protectedRoutes` in `lib/supabase/middleware.ts` (add it there too).

`/dashboard` and `/profile` predate the shell and build the same header
themselves. Their `layout.tsx` uses `RoleGate` (no markup, just the role check),
so recruiters cannot land on them. They can be moved onto the shell later
without any visual change.

## Who sees what

Each account type stays on its own pages. `audience` is `"job_seeker"` or
`"recruiter"`; anyone of the other kind is redirected to their own home
(`ROLE_HOME_PATH` in `lib/auth/roles.ts`). Recruiters have no resume, skills or
experience, so their avatar opens `/recruiter/account` instead of `/profile`.
The role comes from `profiles.role`, never from the browser.

## Pieces

| File             | Role                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `app-shell.tsx`  | Server. Checks the session and role, works out initials, wraps children.                              |
| `role-gate.tsx`  | Server. Role check only, for pages that draw their own header.                                        |
| `app-header.tsx` | Client. Highlights the current section from the URL.                                                  |
| `page-hero.tsx`  | `PageHero` (navy title band), `PageBody` (content that overlaps it), `Surface` (white rounded panel). |

The header itself is `components/dashboard/dashboard-header.tsx`. To add a
menu item, add one entry to `NAV_ITEMS` there and its path to `NAV_HREFS` in
`app-header.tsx` (`app-header.test.tsx` fails if they drift apart).

## Page recipe

```tsx
<main>
  <PageHero label="Jobs" title="Find jobs" description="One short line." />
  <PageBody>{/* cards, lists, forms */}</PageBody>
</main>
```

- One `<h1>`, and it lives in `PageHero`. Panels inside the page use `<h2>`.
- Do not add "Back to dashboard" links; the header is always there.
- Colours: navy `#0E1726`, blue `#1D4ED8`, page `#F5F6F8`, borders `#E3E6EB`.
  The shadcn tokens in `globals.css` (`bg-primary`, `border-border`, ...) are set
  to the same palette, so components that use them match automatically.
- Do not set a font on a page; the shell already does.

## Job seekers and recruiters

`profiles.role` in the database decides who someone is (`job_seeker` by
default, or `recruiter`). The shell reads it and shows the matching menu
(`MENUS` in `app-header.tsx`). The login page has a Job seeker / Recruiter
switch (`/auth/login?as=recruiter` opens the recruiter tab) and
`lib/auth/roles.ts` holds where each role lands after login
(`ROLE_HOME_PATH`). A new role only needs a menu and a landing path there.

## Recruiter accounts: Concordia emails only

Recruiters can read the profiles of people who applied to their postings, so
the role is not self-service for everyone. It is granted only when all of these
are true (decided in the database, `supabase/migrations/20261019140000_recruiter_concordia_signup.sql`):

1. the person signed up on the **Recruiter** tab (`account_type = 'recruiter'`),
2. their email is `concordia.ca` or any subdomain (`live.concordia.ca`,
   `mail.concordia.ca`, `encs.concordia.ca`, ...), and
3. they have **confirmed** that email.

Changing a recruiter's email to a non-Concordia address removes the role.
Look-alikes (`concordia.com`, `evilconcordia.ca`, `concordia.ca.evil.com`) are
rejected. The website repeats the rule in `lib/auth/concordia.ts` only to show
a friendly message early; the two must be changed together
(`concordia.test.ts` lists the cases).

Job seekers can use any email, Concordia included. Browsers cannot grant the
role by sending `role` in the signup data; only `account_type` is read, and
only together with the three conditions above.

If a recruiter must exist for another reason (a demo account on a non-Concordia
email), an administrator can set it by hand in the Supabase SQL editor:

```sql
update public.profiles set role = 'recruiter' where id = (
  select id from auth.users where email = 'person@example.com'
);
```

That person can use the **Job seeker** tab to log in and is sent to the
recruiter pages by their role.
