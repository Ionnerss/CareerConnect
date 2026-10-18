# Jev setup and key ownership

Jev powers the recruiter **Compare top candidates** feature (User Story #19). This page explains how to run it locally, who owns the key, what data leaves the app, and what to do if something breaks.

## What it is

Jev is TypeSafe AI's decision model ("System One"). The app calls it through the Vercel AI Gateway:

- Endpoint: `https://ai-gateway.vercel.sh/v1/evaluate`
- Model: `typesafe-ai/jev`
- Timeout: 20 seconds per candidate

For each applicant, the app asks one scored question per job requirement. Jev answers with a level (0 none, 1 weak, 2 clear, 3 strong) and a confidence from 0 to 1. The app turns those into an overall score out of 100 and ranks the candidates. If any answer has confidence below 0.5, the candidate is flagged **Needs human review**. The score is a suggestion, and the recruiter makes the decision.

## Run it locally

1. Make sure you have the Supabase values in `web/.env.local` (see the main README).
2. Ask the key owner (below) for the AI Gateway key.
3. Add it to `web/.env.local` on its own line, with no quotes:

   ```dotenv
   AI_GATEWAY_API_KEY=the_key_you_were_given
   ```

4. Restart `npm run dev`. Next.js only reads env files at startup.
5. Sign in as a recruiter, open `/recruiter/jobs/<jobId>/applicants`, add requirements, and press **Compare top candidates**.

Rules for the key:

- It is **server-only**. Never name it with a `NEXT_PUBLIC_` prefix, because that would send it to every browser.
- Never commit it, paste it in Discord, an issue, a PR, or an AI chat. `.env.local` is git-ignored; `.env.example` holds only a placeholder.
- If it appears anywhere public, treat it as leaked and rotate it (see below).

If the key is missing, the compare route answers HTTP 503 with a plain message ("AI scoring is not set up") and the UI shows it. The key is never included in an error message or a log line.

## Key ownership

| Item | Detail |
| --- | --- |
| Where it lives | Vercel AI Gateway, API key named `careerconnect-dev` |
| Owner | Yousef (created it on Oct 15, 2026) |
| Who pays | The Gateway credit on Yousef's Vercel account |
| Spend limit | Set a budget on the key in the Gateway dashboard so a leak cannot run up a bill |
| Who may have a copy | Teammates working on the compare feature, in their own git-ignored `.env.local` |
| Deployed site | Not decided yet. Whoever owns the deployment adds `AI_GATEWAY_API_KEY` to that project's Environment Variables (Production, Preview, Development) and redeploys |

### Rotate the key

1. In Vercel, open **AI Gateway**, then **API Keys**, and create a new key. Copy it when it is shown, because it is shown once.
2. Put the new key in your own `web/.env.local` and in the deployment's environment variables, then redeploy.
3. Send the new key to teammates privately, never in a public channel.
4. Check that Compare works, then delete the old key in the Gateway dashboard.

## Privacy: what is sent to Jev

Only what is needed to score a candidate:

- Skills (name, proficiency)
- Education (degree, field of study, dates, description)
- Experience (role, dates, description)
- Total years of experience, computed in our code (overlapping roles are merged)

Never sent: name, email, phone, or anything else that identifies the applicant.

Company names and school names are **left out by default**. The team agreed to this to avoid bias from prestige and to keep scoring consistent. The option exists in code (`includeOrganizations`) but is off and is not exposed in the UI.

The recruiter sees a notice on the page that applicant data goes to a third-party model.

## Caching

Results are stored in `candidate_evaluations`, one row per application. A stored result is reused when the requirements are unchanged (same hash) and its answers are valid, so repeated clicks cost nothing. The **Score everyone again** box forces a fresh run. Saving changed requirements gives them new ids, so everyone is scored again.

Known limit: the cache does not record whether organizations were included. If that option is ever turned on, use **Score everyone again**.

## Database access

- `job_requirements` and `candidate_evaluations` have RLS on, and the `anon` role has no access to either.
- Recruiters can read an applicant's skills, education and experience only for people who applied to one of their own jobs (policies use `recruiter_can_view_profile`).
- Both routes check that the signed-in user is a recruiter and owns the job.

## Troubleshooting

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "AI scoring is not set up" (503) | `AI_GATEWAY_API_KEY` is missing or not loaded | Add it to `.env.local`, restart `npm run dev` |
| Every candidate fails with an auth or 401 message | Key was deleted, mistyped, or has hit its budget | Check the key in the Gateway dashboard, rotate if needed |
| Everyone scores None with 100% confidence | The applicant profile has no skills, education or experience, or the recruiter policies are missing | Check the three profile tables, and the recruiter policies in `pg_policies` |
| A few candidates listed under "Could not score" | Timeout or a model error for those candidates only | Press Compare again. The others are cached, so only the failed ones are retried |
| Results look stale after editing a profile | Cached result | Tick **Score everyone again** |

## Where the code is

- `web/src/lib/ai/jev.ts`: the Jev client and its error types
- `web/src/lib/recruiter/candidate-scoring.ts`: levels, overall score, ranking, review flag
- `web/src/lib/recruiter/candidate-state.ts`: builds the minimal data sent to Jev
- `web/src/lib/recruiter/candidate-comparison.ts`: scores many candidates, one failure never stops the rest
- `web/src/lib/recruiter/candidate-comparison-service.ts`: server logic behind the routes
- `web/src/app/api/recruiter/jobs/[jobId]/requirements` and `.../compare`: the API routes
- `web/src/components/recruiter/candidate-comparison.tsx`: the recruiter UI
