# CareerConnect – Meeting Minutes

**Date:** Monday, November 9, 2026  
**Time:** 13:00 PM - 14:00 PM
**Duration:** 40 minutes  
**Attendees:** Yousef, Matthew, Catalin, Ray, Dak  
**Meeting Type:** Sprint 3 Planning – AI Job Recommendations, General AI within the project, and MFA

---

## 1. Sprint 3 Scope for User Story #20 and general AI implementations

The team discussed what a job seeker should be able to do by the end of Sprint 3: open the recommendations page, see eligible job postings ranked against their profile, and read a short explanation of why each job was recommended.

## 2. Generating Job Summaries

The team identified a gap in the proposed design: Jev could handle ranking, but the recommendation page also needed a text model to explain each match. The target was three or four sentences per job.

- We came up with the following solutions: two free-tier options, Groq-hosted `gpt-oss-20b` and Gemini 2.5 Lite. We estimated roughly 100 detailed summaries per day or around 500 at the shorter length. These were planning estimates, and actual capacity still needed testing.
- We agreed to try Groq-hosted `gpt-oss-20b`. Proposed making one server-side function for summaries, with the API key in `.env.local`, as with Jev. Keeping the call in one place would let the team switch providers if it reached the usage limit. Ownership of the API key remained open.

## 4. MFA Planning and Discussion

The team discussed optional multi-factor authentication (MFA) for job seekers and recruiters. Users would be able to set up an authenticator app from their account settings. The planned sign-in check was to confirm that an enrolled user could access protected account data only after entering a valid authenticator code, while users who had not enabled MFA could still sign in with their password. [User Story #11 (issue #50)](https://github.com/Ionnerss/CareerConnect/issues/50)

In addition, recovery options were discussed for users who may lose their MFA keys. Settled on multiple use MFA keys.

## 4. Meeting Outcome

The Sprint 3 priority was a working recommendation that a seeker could read and understand. The follow-up confirmed the work split and identified Groq-hosted `gpt-oss-20b` as the first model to try for summaries. Background refresh, caching and optional application drafts were proposed for Sprint 4.
