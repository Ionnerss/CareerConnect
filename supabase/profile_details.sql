begin;
alter table public.profiles
add bio TEXT constraint bio_size check (char_length(bio) <= 1000),
add location TEXT constraint location_size check (char_length(location) <= 150),
add contact_email TEXT;

grant update (bio, location, contact_email) 
on table public.profiles 
to authenticated;
commit;