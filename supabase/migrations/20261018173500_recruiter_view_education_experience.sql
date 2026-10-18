-- Lets a recruiter read the education and experience of people who applied to
-- their own postings (same pattern as the profile_skills policy in #160).
create policy "Recruiters can view their applicants' education"
on public.profile_education
for select
to authenticated
using (public.recruiter_can_view_profile(profile_id));

create policy "Recruiters can view their applicants' experience"
on public.profile_experience
for select
to authenticated
using (public.recruiter_can_view_profile(profile_id));
