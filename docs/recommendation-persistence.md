# Recommendation persistence contract

A recommendation run is one attempt to produce a complete result set for one
job seeker. A new attempt does not change the previously available successful
run while it is pending, running, or failed.

## Publication

The trusted writer must validate and insert the complete result set and mark
its run `succeeded` in one database transaction. Before marking success, it
must verify that the number of inserted results equals the intended result
count. A successful run may contain zero results. Missing AI summaries and
valid code-score fallbacks do not, by themselves, make a complete run fail.

For overlapping attempts, the current result is the successful run with the
newest creation order (`created_at DESC, id DESC`). Finishing an older attempt
later must not make it current ahead of a newer successful attempt.

## Historical counts

`result_count` is the number of results saved when the run was published.
`summary_count` is the number of non-null summaries saved at that time.
These are historical values; deleting a job does not update them.

A result references its job with `ON DELETE CASCADE`. Deleting a job removes
that result while retaining the run and its historical counts. Therefore,
`result_count` is not the number of result rows currently present.

A reader must check that each referenced job still exists and is open before
presenting it as an actionable recommendation. Closing a job does not delete
its saved result, but it must prevent that job from being presented as
actionable.

## Access and retention

Authenticated job seekers may read only their own recommendation data,
subject to the existing MFA rule. Client roles cannot write generated runs
or results. The trusted writer must derive the owner from a verified session
or a trusted scheduled record; a browser-supplied user ID cannot select the
owner.

Deleting a profile cascades to its recommendation runs and results. Deleting
a run cascades to its results. Deleting a job cascades to its result rows.
A time-based retention period has not yet been chosen; do not claim cleanup
is implemented until that policy and its worker are added.