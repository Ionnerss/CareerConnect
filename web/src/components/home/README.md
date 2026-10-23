# Homepage (`/`)

Everything for the public homepage lives here and in `src/app/page.tsx`.
It is deliberately self-contained so the rest of the app can keep changing
without touching it, and so it can change without touching the rest of the app.

## Rules that keep it easy to work with

- **Scoped styles only.** All CSS is in CSS Modules (`*.module.css`). Do not
  add homepage rules to `globals.css` or `layout.tsx`. Colours, spacing and the
  mono font are CSS variables on `.home` (top of `home.module.css`); the closing
  section and footer define their own on `.closing` / `.footer`
  (`home-ending.module.css`). Change a colour there, once.
- **Font is local to the page.** `page.tsx` loads Plus Jakarta Sans and applies
  it to the page wrapper only (the same approach as the dashboard).
- **No homepage-only dependencies.** Motion is plain CSS plus the small helpers
  in `home-motion.tsx`. Nothing here needs GSAP, Lenis or any other library.
- **Content is data, markup is dumb.** Illustrative people, companies and
  postings are plain arrays at the top of each section file. To change copy or
  swap in real data, edit the array, not the layout.
- **Illustrative stays labelled.** Anything invented (people, companies,
  postings, match percentages) must keep its "Illustrative" caption. Do not add
  testimonials, customer logos, user counts or hiring statistics.
- **Only claim what exists.** Check the feature is in the app before putting it
  in copy. Today that means: profile (skills, education, experience, projects,
  résumés), job search, application status tracking, and the recruiter
  applicants list with skill match. Applying to a job and posting a job are not
  on the homepage because they are not built yet.

## Layout of the folder

| File | Role |
|---|---|
| `home-navigation.tsx` | Sticky header and mobile menu (client). |
| `home-hero.tsx` | Hero and the profile-to-jobs connection line. |
| `home-statement.tsx` | Large statement that darkens word by word on scroll. |
| `job-seeker-section.tsx` | Profile showcase (`#job-seekers`). |
| `opportunities-section.tsx` | Scannable job list (illustrative). |
| `recruiter-section.tsx` | Applicant list with skill match (`#recruiters`). |
| `how-it-works-section.tsx` | Three steps (`#how-it-works`). |
| `home-ending.tsx` | Closing call to action and footer. |
| `home-motion.tsx` | `Reveal`, `ScrollTextReveal`, `HomeAnchors` (client). |
| `scroll-progress.ts` | Pure scroll maths, unit-tested. |
| `*.module.css` | Styles. `hero-motion` is the hero animation only. |

## Adding or changing things

- **New section:** create `my-section.tsx`, give the `<section>` an `id` and
  `aria-labelledby`, reuse the section classes in `home.module.css`, wrap blocks
  in `<Reveal>` if you want the scroll-in, and add it to `page.tsx`. If you link
  to it with `href="#id"`, the smooth scroll and focus handling work
  automatically (`home.test.tsx` fails if a link has no target).
- **Change or remove an animation:** sections only depend on `<Reveal>` and
  `<ScrollTextReveal>`. To drop one, delete the wrapper; content is always
  rendered. To swap the implementation (for example GSAP), replace the inside
  of `home-motion.tsx` and keep the same props, and no section needs editing.
- **Hero line animation** is entirely in `hero-motion.module.css` and keyed off
  `data-hero-motion` and `data-match` attributes. Delete the file's animation
  rules and the hero is simply static.

## Motion and accessibility guarantees (please keep)

- All content is present in the server-rendered HTML. Hidden "armed" states are
  only set by script after load, and never when `prefers-reduced-motion` is set.
- Every animation rule is inside `@media (prefers-reduced-motion: no-preference)`
  or is gated in script.
- Listeners are added in effects and removed in their cleanups. Scroll work is
  `requestAnimationFrame`-throttled and passive.
- Smooth scrolling is limited to in-page links on this page. The global
  `scroll-behavior` is not changed, so route navigation is unaffected.

## Connecting real data later

The homepage is a static page and is the same for everyone. Before showing
real jobs or profiles here, check what signed-out visitors may read. At the time
of writing `/jobs`, `/profile`, `/dashboard` and `/upload-resume` require login
(`lib/supabase/middleware.ts`), so real data would need an access-policy
decision first. Showing "signed in" state (for example a Dashboard link instead
of Log in) would require reading the session in `page.tsx`, which makes the
page dynamic; decide that deliberately.
