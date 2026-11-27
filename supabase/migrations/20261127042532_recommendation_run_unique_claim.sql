CREATE UNIQUE INDEX recommendation_runs_unique_refresh_claim
  ON public.recommendation_runs (refresh_claim_token)
  WHERE refresh_claim_token IS NOT NULL;