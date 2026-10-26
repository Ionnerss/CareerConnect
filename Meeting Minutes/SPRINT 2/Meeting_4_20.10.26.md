# CareerConnect – Meeting Minutes

**Date:** Sunday, October 20, 2026  
**Time:** 6:45 PM – 7:15 PM  
**Duration:** Approximately 30 minutes  
**Attendees:** Yousef, Matthew, Catalin, Ray, Dak  
**Meeting Type:** Online discussion

---

## 1. Job Search UI and Pagination

- Reviewed the updated job search page and noticed that some changes conflicted with the pagination already implemented in the `dev` branch.
- The backend was already handling pagination by retrieving six jobs at a time from Supabase.
- The redesigned frontend was still splitting the jobs into pages locally, which could cause problems when more jobs were added.
- Decided to keep the new UI design but restore the existing backend pagination logic.
- The page number and search query need to be passed to `searchJobs()`, and the total number of jobs should be used to calculate the number of pages.
- Pagination buttons should update the page number in the URL without removing any active search filters.

## 2. Search Filters

- Noticed that applying filters while on a later page could lead to empty results if the filtered jobs had fewer pages.
- Decided that applying or clearing filters should automatically return the user to page 1.
- The same change was needed for the search bar when clearing a keyword.
- Existing search queries and selected filters should remain in the URL whenever possible.

## 3. Experience Levels and Salary Range

- Reviewed the experience-level options to make sure they matched the values expected by the backend.
- The following experience ranges were selected:
  - Entry Level: 0–2 years
  - Mid Level: 3–5 years
  - Senior Level: 6+ years
- Only the labels displayed to users would be changed. The values sent to the backend would remain the same.
- Decided to specify that the salary range is measured in CAD per year.
- Also identified an issue with the salary slider, which has a maximum of $200,000. Manually entered values above this amount should not be overwritten when adjusting the other slider handle.

## 4. Pull Request Updates

- Confirmed that the changes could be added to the existing job-search UI pull request.
- There was no need to open another pull request.
- The pagination and filter fixes would be committed to the same feature branch so they could be reviewed together.

## 5. Action Items

- Update the job search page to work with server-side pagination.
- Remove client-side pagination and update page navigation through URL parameters.
- Reset pagination when filters are applied, cleared, or when a keyword search is cleared.
- Update the experience-level labels and clarify the salary units.
- Fix the salary slider so manually entered values above $200,000 are preserved.
- Push the changes to the existing pull request.

## 6. Meeting Outcome

The main focus of the discussion was making sure the redesigned job search page worked properly with the existing backend.

Several changes were identified, mainly involving pagination, search filters, and salary inputs. The plan was to keep the new interface while fixing these compatibility issues.

The updates would be made through the existing pull request before the changes were merged into `dev`.
