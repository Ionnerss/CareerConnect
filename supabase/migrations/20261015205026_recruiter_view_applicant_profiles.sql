create or replace function public.recruiter_can_view_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    join public.job j on j.id = a.job_id
    where a.applicant_id = profile_id
      and j.recruiter_id = (select auth.uid())
  );
$$;

revoke all on function public.recruiter_can_view_profile(uuid) from public, anon;
grant execute on function public.recruiter_can_view_profile(uuid) to authenticated;

create policy "Recruiters can view their applicants' profiles"
on public.profiles
for select
to authenticated
using (public.recruiter_can_view_profile(id));

