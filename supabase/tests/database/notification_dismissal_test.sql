begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- The auth trigger creates the corresponding profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'da100000-0000-4000-8000-000000000001',
    'dismissal-owner@example.com',
    '{"full_name":"Dismissal Owner"}'::jsonb
  ),
  (
    'da100000-0000-4000-8000-000000000002',
    'dismissal-other@example.com',
    '{"full_name":"Other Recipient"}'::jsonb
  ),
  (
    'da100000-0000-4000-8000-000000000003',
    'dismissal-mfa@example.com',
    '{"full_name":"MFA Recipient"}'::jsonb
  );

-- Database-policy fixture, not a real TOTP enrollment flow.
insert into auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  created_at,
  updated_at,
  secret
)
values (
  'da200000-0000-4000-8000-000000000001',
  'da100000-0000-4000-8000-000000000003',
  'Dismissal test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

insert into public.notifications (
  id,
  recipient_id,
  type,
  title,
  message,
  is_read,
  read_at,
  dismissed_at
)
values
  (
    'da300000-0000-4000-8000-000000000001',
    'da100000-0000-4000-8000-000000000001',
    'application_update',
    'Owner notification',
    'Original message',
    false,
    null,
    null
  ),
  (
    'da300000-0000-4000-8000-000000000002',
    'da100000-0000-4000-8000-000000000002',
    'application_update',
    'Other notification',
    'Original message',
    false,
    null,
    null
  ),
  (
    'da300000-0000-4000-8000-000000000003',
    'da100000-0000-4000-8000-000000000003',
    'application_update',
    'MFA notification',
    'Original message',
    false,
    null,
    null
  );

-- 1. No table-wide UPDATE privilege.
select ok(
  not has_table_privilege(
    'authenticated',
    'public.notifications',
    'UPDATE'
  ),
  'authenticated has no table-wide notification UPDATE privilege'
);

-- Owner without enrolled MFA: AAL1 should work.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"da100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 2. Owner can dismiss their notification.
with updated as (
  update public.notifications
  set dismissed_at = now(),
      is_read = true,
      read_at = now()
  where id = 'da300000-0000-4000-8000-000000000001'
  returning id
)
select is(
  (select count(*)::integer from updated),
  1,
  'recipient without enrolled MFA can dismiss their own notification'
);

-- 3. All three fields persist.
select ok(
  (
    select is_read
       and read_at is not null
       and dismissed_at = now()
    from public.notifications
    where id = 'da300000-0000-4000-8000-000000000001'
  ),
  'dismissal persists all three fields'
);

-- 4. Another recipient's notification cannot be dismissed.
with updated as (
  update public.notifications
  set dismissed_at = now(),
      is_read = true,
      read_at = now()
  where id = 'da300000-0000-4000-8000-000000000002'
  returning id
)
select is(
  (select count(*)::integer from updated),
  0,
  'recipient cannot dismiss another user notification'
);

reset role;

-- 5. Verify the protected row as the database administrator.
select ok(
  (
    select not is_read
       and read_at is null
       and dismissed_at is null
    from public.notifications
    where id = 'da300000-0000-4000-8000-000000000002'
  ),
  'other user notification remains unchanged'
);

set local role authenticated;

-- 6. Ownership does not permit editing notification content.
select throws_ok(
  $$
    update public.notifications
    set message = 'Tampered message'
    where id = 'da300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table notifications',
  'recipient cannot edit notification content'
);

-- 7. Ownership does not permit transferring the notification.
select throws_ok(
  $$
    update public.notifications
    set recipient_id = 'da100000-0000-4000-8000-000000000002'
    where id = 'da300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table notifications',
  'recipient cannot transfer notification ownership'
);

-- Switch to the MFA-enrolled recipient without completing MFA.
select set_config(
  'request.jwt.claims',
  '{"sub":"da100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

-- 8. AAL1 cannot read the protected notification.
select is(
  (
    select count(*)::integer
    from public.notifications
    where id = 'da300000-0000-4000-8000-000000000003'
  ),
  0,
  'MFA-enrolled recipient cannot read notifications at AAL1'
);

-- 9. AAL1 cannot dismiss the protected notification.
with updated as (
  update public.notifications
  set dismissed_at = now(),
      is_read = true,
      read_at = now()
  where id = 'da300000-0000-4000-8000-000000000003'
  returning id
)
select is(
  (select count(*)::integer from updated),
  0,
  'MFA-enrolled recipient cannot dismiss notifications at AAL1'
);

reset role;

-- 10. Verify the blocked attempt changed nothing.
select ok(
  (
    select not is_read
       and read_at is null
       and dismissed_at is null
    from public.notifications
    where id = 'da300000-0000-4000-8000-000000000003'
  ),
  'blocked AAL1 attempt leaves the notification unchanged'
);

-- Complete MFA for the same recipient.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"da100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

-- 11. AAL2 permits the legitimate dismissal.
with updated as (
  update public.notifications
  set dismissed_at = now(),
      is_read = true,
      read_at = now()
  where id = 'da300000-0000-4000-8000-000000000003'
  returning id
)
select is(
  (select count(*)::integer from updated),
  1,
  'MFA-enrolled recipient can dismiss their notification at AAL2'
);

-- 12. All three fields persist after the AAL2 dismissal.
select ok(
  (
    select is_read
       and read_at is not null
       and dismissed_at = now()
    from public.notifications
    where id = 'da300000-0000-4000-8000-000000000003'
  ),
  'AAL2 dismissal persists all three fields'
);

reset role;

select * from finish();
rollback;