-- Recruiter accounts: Concordia email addresses only.
--
-- Before this, every signup became a job seeker and the signup trigger ignored
-- anything sent from the browser. That is still true for everyone except this
-- one path: a person who asks to be a recruiter (account_type = 'recruiter' in
-- the signup data), whose email ends in concordia.ca or any subdomain of it
-- (live.concordia.ca, mail.concordia.ca, ...), and who has CONFIRMED that email,
-- becomes a recruiter. Nothing else can grant the role from the website.
--
-- The website runs the same rule (web/src/lib/auth/concordia.ts) only to show a
-- friendly message early. This file is what actually decides.

-- 1. The rule, in one place.
create or replace function public.is_concordia_email(email text)
  returns boolean
  language sql
  immutable
  set search_path to ''
as $function$
  select coalesce(
    lower(btrim(email)) ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*concordia\.ca$',
    false
  );
$function$;

-- 2. New signups: recruiter only if requested, Concordia and already confirmed
--    (projects with email confirmation turned off confirm at signup).
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when new.email_confirmed_at is not null
        and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
        and public.is_concordia_email(new.email)
      then 'recruiter'
      else 'job_seeker'
    end
  );
  return new;
end;
$function$;

-- 3. Later changes: confirming the email grants the role; changing to a
--    non-Concordia email takes it away.
create or replace function public.sync_recruiter_role()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  if new.email_confirmed_at is not null
     and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
     and public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'recruiter'
     where id = new.id
       and role <> 'recruiter';
  elsif old.email is distinct from new.email
        and not public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'job_seeker'
     where id = new.id
       and role = 'recruiter';
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_recruiter_role() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email, email_confirmed_at on auth.users
  for each row
  when (
    old.email is distinct from new.email
    or old.email_confirmed_at is distinct from new.email_confirmed_at
  )
  execute function public.sync_recruiter_role();
