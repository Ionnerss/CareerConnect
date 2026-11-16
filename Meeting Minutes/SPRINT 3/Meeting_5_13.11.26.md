# CareerConnect – Meeting Minutes

**Date:** Friday, November 13, 2026  
**Time:** 2:30 PM – 2:55 PM  
**Duration:** 25 minutes  
**Attendees:** Yousef, Matthew, Catalin, Ray, Dak  
**Meeting Type:** Testing, Bug Fixes and Sprint 3 Review

---

## 1. Sprint 3 Review – Work Completed by Each Member

### Matthew
- Allowed recruiters to change an application's status (PR #241).
- Created the notifications and interviews tables (PR #277).
- Added the database functions and triggers for interviews and notifications (PR #282).
- Implemented the job seeker interview backend, including the Pending, Accepted, Rejected, Expired and Cancelled statuses (PR #290).

### Catalin
- Completed the MFA flows and protected access, then hardened MFA access and factor management (PRs #239, #258), with documentation of the MFA access policy (PR #243).
- Added Supabase database checks to CI and tests for application submission and MFA policies (PRs #245, #246), and set unmerged PRs to Closed on the board (PR #244).
- Completed recruiter posting edits and applicant date filtering (PR #279, task #267).
- Completed the application analytics data and access controls (PR #284, task #264).
- Made account security reachable from both account pages (PR #276).
- Started the recommendation storage migration (task #198).

### Ray
- Built the application analytics and history dashboard (PR #270, task #256).
- Added the recruiter new-application notifications page (PR #271) and loaded recruiter notifications from the notifications table with read/unread, filters and counts (PR #287, task #248).
- Added the recruiter interview management interface with rescheduling (PR #286, task #261).
- Added interview links to the application status and analytics pages (PR #289).

### Dak
- Improved the job application form and job listing pagination (PR #269).
- Built the recruiter dashboard and job editing interface (PR #273, task #21.1).
- Implemented the notifications and reminders interface and the notification bell (PRs #272, #280).
- Built the job seeker interview management interface (PR #283, task #260).

### Yousef
- Built the AI job recommendation pipeline: seeker profile inputs and job shortlist (PR #278, task #197), AI ranking and summaries (PR #285, task #200) and the authenticated recommendation endpoint (PR #291, task #202).
- Built the recommendations page (task #203) and started the notification actions (task #257) and the dashboard recommendations (task #101).

## 2. Testing

- Lint, typecheck and the full unit test suite pass on `dev`, and CI now also runs the Supabase database checks on every pull request.
- Acceptance tests passed and closed: US #21 Recruiter Dashboard and Posting Management (#268) and US #22 Application Analytics and History Dashboard (#265). Both user stories were closed.
- The AI recommendations were run live for the first time. Ranking with Jev worked, and the AI summaries appeared once the Groq key was added to `.env.local` and the dev server was restarted.
- Acceptance tests still to run before the deadline: notifications (#252), interviews (#263) and AI job recommendations (#274 and #275).
- Agreed that acceptance tests are run on `dev` with screenshots attached to each issue before it is closed.

## 3. Bug Fixes and Cleanup

- Fixed a lint error in the interview backend before it was merged (Matthew).
- Fixed the notification bell navigation test (Dak).
- Updated the interview menu test after rescheduling moved to the database (Ray).
- Fixed missing analytics data and tightened access controls for applications (Catalin).
- Three duplicate "TEST – Frontend Developer" postings in the shared database were cluttering job results. The team agreed to close two of them instead of deleting them, so existing test applications were kept.
- Task #262 (interview data management) was reviewed. It was already covered by the merged interview work, so no separate implementation was needed.

## 4. Remaining Work

- Review and merge the remaining open pull requests, including the recommendations page, notification actions and dashboard recommendations.
- Deadline reminders for interviews (task #250).
- Recommendation storage migration (#198), following the migration workflow (MIGRATION label, review, no `db push`).
- Yousef agreed to take on the AI cover letter agent (US #16) as the next AI feature.

## 5. Action Items

- [ ] Review and merge the remaining open pull requests.
- [ ] Complete the deadline reminders (#250).
- [ ] Review and merge the recommendation storage migration (#198).
- [ ] Run and close the acceptance tests #252, #263, #274 and #275 on `dev`.
- [ ] Complete the individual AI logs, contribution logs and the Sprint 3 report before November 16.

## 6. Meeting Outcome

Most Sprint 3 features were merged, with the recruiter dashboard and the application analytics stories completed and their acceptance tests passed.

The remaining work was mainly reviews, the deadline reminders, the recommendation storage and the last acceptance tests. The team agreed to focus on these before the Sprint 3 deadline.
