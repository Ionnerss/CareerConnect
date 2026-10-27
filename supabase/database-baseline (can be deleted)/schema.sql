create table public.profiles (
  id uuid not null,
  created_at timestamp with time zone not null default now(),
  full_name text null,
  role text not null default 'job_seeker'::text,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
alter table public.profiles enable row level security;
