# CareerConnect – Meeting Minutes

**Date:** Thursday, November 12, 2026  
**Time:** 12:00 PM – 12:30 PM  
**Duration:** Approximately 30 minutes  
**Attendees:** Matthew, Catalin, Yousef, Ray, Dak  
**Meeting Type:** Online discussion (Discord) – Notifications System Implementation and Integration

---

## 1. Notifications and Interviews Database

- Reviewed the new `notifications` and `interviews` tables created in Supabase.
- Agreed that every notification in the application, for both job seekers and recruiters, should be stored in the `notifications` table so all pages read from the same place.
- Each notification is linked to the user receiving it (`recipient_id`) and, when relevant, to the related application, job, and interview.
- Notification types discussed: application updates, new applications for recruiters, interview invitations, interview responses, rescheduled interviews, cancelled interviews, and expired invitations.

## 2. Automatic Notifications (Database Triggers)

- Notifications will be created automatically by database triggers instead of being inserted from the frontend.
- The following triggers were confirmed:
  - Applicant is notified when a recruiter changes their application status.
  - Recruiter is notified when a job seeker applies to one of their job postings.
  - Recruiter is notified when a job seeker accepts or declines an interview.

## 3. Interview Workflow Rules

- Recruiters must add a **response deadline** when sending an interview. The deadline must be in the future and before the interview date.
- Interview statuses: pending, accepted, declined, cancelled, and expired.
- Status changes must go through the database functions only:
  - `respond_to_interview` – job seeker accepts or declines a pending invitation.
  - `reschedule_interview` – recruiter changes the date and deadline; the interview returns to pending and the applicant receives a new invitation.
  - `cancel_interview` – recruiter cancels a pending or accepted interview; the applicant is notified.
- Pending invitations past their deadline are automatically marked as expired every 5 minutes.

## 4. Frontend Integration

- **Recruiter notifications:** switch the page from reading applications to reading the `notifications` table, and add read/unread, a filter, an unread counter, a total count, and interview response notifications.
- **Recruiter interviews:** use the response deadline and the reschedule/cancel functions instead of updating the interviews table directly.
- **Job seeker notifications:** connect the notifications page to the real data instead of mock notifications.
- **Job seeker interviews:** replace the mock interviews with the `interviews` table and use `respond_to_interview` for accept and decline.
- The notification bell should show the number of unread notifications for both job seekers and recruiters.

## 5. Migrations and Pull Requests

- Changes made in the Supabase dashboard must also be added to a migration file in the repository, so that local databases and CI tests have the same triggers and functions.
- The migration pull request should be merged before the frontend pull requests that depend on it.
- Team members should pull the latest `dev` before opening a pull request, since several notification and interview changes are being merged on the same day.

## 6. Action Items

- Merge the triggers and functions migration before the frontend pull requests.
- Connect the job seeker notifications and interviews pages to the real data.
- Update the recruiter notifications page with read/unread, filter and counters.
- Finish the recruiter interviews page with the response deadline, reschedule and cancel.


## 7. Meeting Outcome

The team agreed on a single notifications table for all notifications, created automatically by database triggers, and on a clear interview workflow handled by database functions (respond, reschedule, cancel, and expire).
