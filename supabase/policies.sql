-- profiles
create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- resumes
create policy "Users can view own resumes" on public.resumes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add own resumes" on public.resumes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete own resumes" on public.resumes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- storage: resumes bucket (files saved as <user id>/<file name>)
create policy "Users manage own resume files" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users manage own resume files (insert)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users manage own resume files (delete)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
