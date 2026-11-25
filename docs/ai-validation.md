# AI feature validation

Sprint 4 requires each AI feature to document its purpose, inputs, model configuration, expected output, validation strategy, limitations, privacy considerations and failure handling, and to be tested with representative and edge-case inputs. This page does that for both AI features.

| Feature | User story | Where it runs |
| --- | --- | --- |
| AI job recommendations | #20 | `/jobs/recommendations`, dashboard card, `POST /api/recommendations` |
| AI candidate comparison for recruiters (team-proposed) | Recruiter AI feature | Applicants page of a posting, `POST /api/recruiter/jobs/[jobId]/compare` |

Setup, keys and costs are in [ai-recommendations.md](ai-recommendations.md) and [jev-setup.md](jev-setup.md). This page does not repeat them.

## 1. AI job recommendations

**Purpose.** Suggest open jobs to a signed-in job seeker, best match first, with a short explanation. The seeker decides where to apply.

**Inputs.** The seeker's own skills, experience, education, desired role, work mode and location, plus the text of open postings. Long text is cut to 400 characters (postings to 600 for Jev).

**Models and configuration.**

| Step | Model | Configuration |
| --- | --- | --- |
| Fit rating | Jev, through the Vercel AI Gateway | 3 typed score questions per job (skills, level, interest), 4 levels each, 20 s timeout, 3 jobs at once |
| Summary | Groq `openai/gpt-oss-20b` (override: `RECOMMENDATION_SUMMARY_MODEL`) | temperature 0.2, 2000 max tokens, 25 s timeout, top 5 only |

**Expected output.** A list ordered by `0.6 × AI fit + 0.4 × code score`, with code-written reasons for every job and an AI summary (at most 400 characters of plain text) for the top five.

### How the output is validated

| Risk | Control | Tested in |
| --- | --- | --- |
| Model answers are malformed or missing | The Jev client rejects a response unless every question has a finite score and confidence; a missing answer counts as level 0 with confidence 0 and is flagged | `lib/ai/jev.test.ts`, `job-fit.test.ts` |
| Model answers are out of range | Levels are clamped to 0–3 and confidence to 0–1 before scoring, so a fit is always 0–100 | `job-fit.test.ts`, `ai-validation.test.ts` |
| The text model returns garbage, a refusal or cut-off JSON | The reply must match a strict schema; anything else is dropped and the code-written reasons are shown | `summaries.test.ts`, `ai-validation.test.ts` |
| The text model writes about a posting that was not asked about | Summaries for unknown job ids are discarded | `summaries.test.ts`, `ai-validation.test.ts` |
| Unsupported or overlong claims | Summaries are flattened to plain text and capped at 400 characters; the code-computed reasons and skill match always sit beside them, so the AI text never replaces the facts | `summaries.test.ts` |
| Prompt injection in a profile or posting | The instructions are a fixed system message and a fixed list of questions. User and recruiter text only travels inside the JSON data, and the system prompt says to treat it as data. The AI can only reorder (it cannot add jobs, change a score outside 0–100 or write to the database) | `ai-validation.test.ts` |
| Unusual input (empty fields, emoji, right-to-left text, quotes and backslashes) | Fields are optional, text is serialized as JSON | `ai-validation.test.ts`, `seeker-state.test.ts` |

### Failure handling

| What fails | What the seeker sees |
| --- | --- |
| Jev key missing | "AI recommendations are not set up" (503); no data is sent anywhere |
| One Jev call fails | That job keeps its code score; the others are rated normally |
| Every Jev call fails | The list is ordered by code score and the page says AI ranking is unavailable |
| Groq key missing or Groq fails | Rankings stay; the "Why it fits" bullets replace the summaries |
| Empty profile | "Add a few details to get recommendations"; no AI call is made |
| Not signed in, MFA pending, or not a job seeker | Refused before any AI call (401 / 403) |
| Saving or reading a run fails | "Unable to load your recommendations" (500); internal messages and keys are never returned |

Manual job search and applying never depend on this feature.

### Privacy

Sent to the providers: skills, education, experience, years of experience, location, preferences, and the postings' text. Never sent: name, email, phone, employer names, school names, salary, or recruiter details. Tests assert this in `seeker-state.test.ts`, `job-fit.test.ts` and `summaries.test.ts`.

## 2. AI candidate comparison (recruiters)

**Purpose.** Help a recruiter compare the applicants to their own posting against requirements they wrote. The recruiter always decides; nothing is rejected or advanced automatically.

**Inputs.** Up to 20 requirements per posting, each marked core or nice-to-have with a weight from 1 to 10, plus each applicant's skills, education and experience.

**Model and configuration.** Jev, one call per applicant, one typed score question per requirement, 3 applicants at a time, 20 s timeout. Scores are combined with the weights in code, not by the model. Years of experience are also computed in code.

**Expected output.** A ranked table with a level for each requirement, an overall score, and a **needs human review** flag when the lowest confidence is below 0.5.

### How the output is validated

| Risk | Control | Tested in |
| --- | --- | --- |
| Out-of-range or missing answers | Same client validation and clamping as above | `jev.test.ts`, `candidate-comparison.test.ts` |
| An applicant's text tries to influence the model | Requirements are fixed typed questions; resume text is data in the state. Sprint 2 acceptance test #173: a resume with injected instructions got the same ratings as the control (scores 46 vs 50) | `candidate-state.test.ts`, acceptance test #173 |
| Keyword stuffing | A keyword-stuffed resume is flagged for human review when confidence is low (Oct pilot and acceptance test #172) | acceptance test #172 |
| Weak signal looks like a strong one | Low-confidence results carry the review flag instead of a bare number | `candidate-comparison.test.ts` |
| One applicant fails | The others are still returned; the failure is listed as "Could not score" | `candidate-comparison.test.ts`, `candidate-comparison.test.tsx` |
| Bias from names or prestige | Name, email and phone are never sent; company and school names are left out by default | `candidate-state.test.ts`, `candidate-comparison-service.test.ts` |
| Another recruiter's data | Every route checks sign-in, MFA, the recruiter role and ownership of the posting before reading anything | `candidate-comparison-service.test.ts`, route tests |

### Failure handling

| What fails | What the recruiter sees |
| --- | --- |
| Jev key missing | A setup message; nothing is saved |
| Database read fails (profile, posting, requirements, applicants, saved results, applicant profiles) | A safe "please try again" message; the AI is not called; internal messages are never returned |
| Saving results fails | The comparison is still shown; it is scored again next time |
| Requirements changed since a result was saved | The stored result is ignored and the applicant is scored again |
| Network error in the browser | A generic error message |

## 3. Limitations

- Jev returns probabilities and confidence, not explanations. The "why" shown to users comes from code (matched and missing skills) and, for recommendations, from the Groq summary.
- Jev is weak at counting and dates, so years of experience are computed in code.
- Ratings depend on how complete the profile and the posting are. Sparse data produces low confidence, not a confident wrong answer.
- Summaries can still be generic. They are limited to plain text and 400 characters and sit next to the factual reasons.
- Groq runs on a free tier with request and token limits. A failed summary degrades to the code-written reasons.
- There is no per-user rate limit on generating recommendations. Each run costs about 10 Jev calls and 1 Groq call.
- The unit tests use stubbed providers. They prove how the app behaves for each kind of model output, not how good the live models are. Live runs are recorded below.

## 4. Live validation record

| Date | Check | Result |
| --- | --- | --- |
| Oct 2026 | Jev pilot on 7 invented resumes, run twice | Stable scores, sensible ranking, prompt-injection resume scored 0, keyword-stuffing resume flagged by low confidence |
| Oct 2026 | Acceptance tests #171–#173 (recruiter comparison) | Strong vs weak candidate 74 vs 40; low-confidence flag shown; injected-text resume rated identically |
| Nov 12, 2026 | Live Jev and Groq run of recommendations | Summaries appeared after the Groq key was added and the server restarted |
| Nov 16, 2026 | #274 ranked recommendations on dev | Best match first, AI summaries on top cards, no closed duplicates, apply opened the apply page without submitting |
| Nov 16, 2026 | #275 access control and empty states | Signed-out and recruiter users refused, empty profile shows the prompt, a second seeker got a different list |

## 5. Re-running the validation

```bash
cd web
npm test -- src/lib/recommendations src/lib/ai src/lib/recruiter
```

To check the live behaviour before a demo: run a recommendation for a seeker with a full profile and one with an empty profile; unset `GROQ_API_KEY` and check that the bullets replace the summaries; unset `AI_GATEWAY_API_KEY` and check the "not set up" message; compare applicants on a posting that has fewer than two applicants.
