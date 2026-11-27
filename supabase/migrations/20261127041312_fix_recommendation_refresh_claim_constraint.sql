ALTER TABLE public.recommendation_refresh_state
  DROP CONSTRAINT recommendation_refresh_claim_check;

ALTER TABLE public.recommendation_refresh_state
  ADD CONSTRAINT recommendation_refresh_claim_check
  CHECK (
    (
      claim_token IS NULL
      AND claimed_revision IS NULL
      AND claimed_posting_revision IS NULL
      AND lease_expires_at IS NULL
    )
    OR
    (
      claim_token IS NOT NULL
      AND claimed_revision IS NOT NULL
      AND claimed_posting_revision IS NOT NULL
      AND lease_expires_at IS NOT NULL

      AND claimed_revision >= completed_revision
      AND claimed_revision <= requested_revision

      AND (
        claimed_revision > completed_revision
        OR claimed_posting_revision > completed_posting_revision
      )
    )
  );