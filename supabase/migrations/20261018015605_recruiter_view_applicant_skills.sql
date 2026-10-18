create policy "Recruiters can view their applicants' skills"
on public.profile_skills
for select
to authenticated
using (public.recruiter_can_view_profile(profile_id));