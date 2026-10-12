begin;
alter table public.profiles
add avatar_path TEXT,
add background_path TEXT;

grant update (avatar_path, background_path)
on table public.profiles
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update 
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own profile images" on storage.objects
for insert to authenticated with check (
    bucket_id = 'profile-images' 
    and (storage.foldername(name))[1] = (select auth.uid())::text 
    and ((storage.foldername(name))[2] = 'avatar' or (storage.foldername(name))[2] = 'background')
);

create policy "Users can delete own profile images" on storage.objects
for delete to authenticated using (
    bucket_id = 'profile-images' 
    and (storage.foldername(name))[1] = (select auth.uid())::text 
    and ((storage.foldername(name))[2] = 'avatar' or (storage.foldername(name))[2] = 'background')
);

create policy "Users can select own profile images" on storage.objects
for select to authenticated using (
    bucket_id = 'profile-images' 
    and (storage.foldername(name))[1] = (select auth.uid())::text 
    and ((storage.foldername(name))[2] = 'avatar' or (storage.foldername(name))[2] = 'background')
);
commit;