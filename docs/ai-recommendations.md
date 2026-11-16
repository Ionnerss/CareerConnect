# AI job recommendations: setup, operation and limits

AI job recommendations (User Story #20) suggest open jobs to a job seeker, best match first, with a short explanation. This page covers how to run the feature locally, what it costs, what data leaves the app, how to switch it off, and what to check when it fails.

Related docs: [Jev setup and key ownership](jev-setup.md) (the Jev key) and [Recommendation persistence contract](recommendation-persistence.md) (the saved runs).

## Where users see it

- **Recommended for you** page at `/jobs/recommendations`, linked from the Jobs page.
- **Recommended for you** card on the job seeker dashboard. It shows the top 5 and calls the AI only when the seeker presses **Show my top matches**.
- Each result links to the normal apply page (`/jobs/<id>/apply`). The AI only suggests. Nothing is applied to automatically.

Only signed-in job seekers who have passed MFA can use it. Recruiters and signed-out visitors are refused.

## How a result is produced

1. **Inputs.** The server loads the seeker's own profile (skills, experience, education, desired role, work mode, location) and up to 200 open jobs. Jobs that are closed or already applied to are skipped.
2. **Shortlist.** Code scores every job out of 100: skills 45, role 20, work mode 15, experience 10, location 5, employment type 5. The top 10 go to the AI.
3. **AI fit (Jev).** Jev answers three scored questions per job (skills, level, interest). Up to 3 jobs are rated at the same time. A job whose rating fails keeps its code score.
4. **Final score.** `final = 0.6 × AI fit + 0.4 × code score`, so the AI can reorder the list but cannot override hard facts. If every rating fails, the list is ordered by code score and the page says so.
5. **Summaries (Groq).** A text model writes a short note (at most 400 characters) for the top 5. If it fails, the page shows the code-written "Why it fits" reasons instead.
6. **Save.** The finished run is saved for the seeker (see the persistence contract). Jobs that closed in the meantime are removed before the results are shown.

A **low confidence** note appears when Jev's lowest confidence for a job is below the same threshold used by the recruiter comparison.

## Run it locally

Add these to `web/.env.local`, one per line, no quotes, then restart `npm run dev` (Next.js reads env files only at startup):

| Variable | Used for | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Database connection | Main README |
| `AI_GATEWAY_API_KEY` | Jev ratings | Key owner, see [jev-setup.md](jev-setup.md) |
| `GROQ_API_KEY` | Summaries | Your own free key at console.groq.com |
| `SUPABASE_SERVICE_ROLE_KEY` | Saving recommendation runs | Supabase dashboard (Project Settings, API keys) or the project owner |
| `RECOMMENDATION_SUMMARY_MODEL` (optional) | Change the summary model | Default `openai/gpt-oss-20b` |

All of these except the two `NEXT_PUBLIC_` values are **server-only**. Never give them a `NEXT_PUBLIC_` prefix, never commit them, and never paste them in Discord, issues, PRs or AI chats. The service role key bypasses row-level security, so treat it as the most sensitive of all.

What happens when a key is missing:

- No `AI_GATEWAY_API_KEY`: the page shows "AI recommendations are not set up on the server yet." (HTTP 503).
- No `GROQ_API_KEY`: results still load. The AI summary box is replaced by the "Why it fits" bullets.
- No `SUPABASE_SERVICE_ROLE_KEY`: the page shows "Unable to load your recommendations. Please try again." (HTTP 500), because the run cannot be saved.

## API

`POST /api/recommendations` builds a fresh set (this is the call that costs money). It is a POST so that link prefetching or crawlers cannot trigger it. `GET /api/recommendations` reads the latest saved run without calling the AI. Responses are `Cache-Control: private, no-store`.

Error codes and HTTP status: `UNAUTHENTICATED` 401, `MFA_REQUIRED` 403, `NOT_JOB_SEEKER` 403, `AUTH_UNAVAILABLE` 503, `AI_NOT_CONFIGURED` 503, `LOAD_FAILED` 500, `BACKEND_ERROR` 500.

## Cost and quotas

- Each POST (page load, Refresh, or the dashboard button) makes about **10 Jev calls + 1 Groq call**.
- Jev is paid from the AI Gateway credit of the key owner. Keep a budget set on the key.
- Groq runs on the free tier. Its rate limits were not tested under load.
- There is **no rate limit and no cache** for POST yet. Avoid repeated Refresh clicks in demos. Background refresh and caching are planned in #201 (Sprint 4).

## Privacy: what leaves the app

Sent to the AI providers, with long text cut to 400 characters:

- Skills (name, proficiency)
- Education (degree, field of study, dates, description)
- Experience (role, dates, description) and total years of experience, computed in code
- Location and preferences: desired role, position, salary and work mode
- The job postings' text

Never sent: name, email, phone, employer names or school names.

The page tells the seeker that these are AI suggestions only and that they decide where to apply. The dashboard card adds that a match score is not a guarantee of an interview or offer.

## Turn it off

- Quick: remove `AI_GATEWAY_API_KEY` from the environment and restart. The page and the dashboard card show the "not set up" message, and nothing is sent to an AI provider.
- Full: remove the "Recommended for you" link from `app/jobs/page.tsx`, the card from `app/dashboard/page.tsx` and the shortcut from `components/dashboard/dashboard-sidebar.tsx`.

Manual job search and applying never depend on this feature.

## Troubleshooting

| What you see | Check |
| --- | --- |
| "AI recommendations are not set up" | `AI_GATEWAY_API_KEY` is in `web/.env.local`, then restart the dev server |
| "Unable to load your recommendations" | `SUPABASE_SERVICE_ROLE_KEY` is set, and the recommendation migrations are applied to the database |
| Only "Why it fits" bullets, no AI summary | `GROQ_API_KEY` is set, the model id exists in your Groq account, and the dev server was restarted |
| "AI ranking is unavailable right now" banner | Jev calls failed for every job: check the Gateway key, its credit and its budget |
| "Add a few details to get recommendations" | The seeker's profile has no skills, experience or desired role |
| An expected job is missing | It is closed, already applied to, or outside the top 10 by code score |

## Known limits

- Results are generated on demand. Reusing earlier ratings, scheduled refresh and cleanup of old runs are not implemented yet.
- No per-user rate limit on POST.
- Ratings depend on how complete the profile and the posting are. Sparse postings produce low confidence.

## Ownership

| Area | Owner |
| --- | --- |
| Inputs, AI ranking, summaries, endpoint, page and dashboard card | Yousef |
| Database tables, saved runs, eligible-job filtering | Catalin |
| Jev key and its budget | Key owner in [jev-setup.md](jev-setup.md) |
