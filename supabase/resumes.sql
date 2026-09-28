   create table public.resumes (
     id uuid not null default gen_random_uuid (),
     uploaded_at timestamp with time zone not null default now(),
     user_id uuid not null default auth.uid (),
     file_path text not null,
     file_name text not null,
     constraint resumes_pkey primary key (id),
     constraint resumes_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
   ) TABLESPACE pg_default;
   alter table public.resumes enable row level security;
