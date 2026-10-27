begin;
alter table public.profiles
ADD COLUMN IF NOT EXISTS avatar_path TEXT,
ADD COLUMN IF NOT EXISTS background_path TEXT;

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
    
commit;