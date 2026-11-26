SELECT
  jobname,
  schedule,
  command,
  database,
  username,
  active
FROM cron.job
WHERE jobname IN (
  'expire-pending-interviews',
  'interview-deadline-reminders'
)
ORDER BY jobname;