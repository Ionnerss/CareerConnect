import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STAT_KEYS = [
  "recovered",
  "selected",
  "claimed",
  "succeeded",
  "failed",
  "skipped",
  "claim_errors",
  "cleanup_errors",
];

export async function invokeRecommendationWorker({
  baseUrl,
  secret,
  allowLocal = false,
  fetcher = fetch,
}) {
  if (
    typeof secret !== "string" ||
    !secret.trim() ||
    /[\u0000-\u001f\u007f]/.test(secret.trim())
  ) {
    throw new Error(
      "A valid RECOMMENDATION_WORKER_SECRET is required.",
    );
  }

  let url;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      "RECOMMENDATION_APP_URL must be a valid application origin.",
    );
  }

  const local = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(url.hostname);

  const allowedProtocol =
    url.protocol === "https:" ||
    (allowLocal && local && url.protocol === "http:");

  if (
    !allowedProtocol ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use an HTTPS application origin; local HTTP requires --allow-local.",
    );
  }

  let response;

  try {
    response = await fetcher(
      new URL(
        "/api/internal/recommendations/refresh",
        url,
      ),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret.trim()}`,
          Accept: "application/json",
        },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(270_000),
      },
    );
  } catch {
    throw new Error(
      "Worker request did not complete. Check server state before invoking again.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Worker request failed (HTTP ${response.status}).`,
    );
  }

  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error(
      "Worker returned an invalid JSON response.",
    );
  }

  if (body?.success !== true) {
    throw new Error(
      "Worker did not report a successful batch invocation.",
    );
  }

  if (body.skipped === true) {
    if (body.reason !== "DISABLED") {
      throw new Error(
        "Worker returned an unknown skip reason.",
      );
    }

    return { kind: "disabled" };
  }

  const stats = {};

  for (const key of STAT_KEYS) {
    const value = body.stats?.[key];

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        "Worker returned invalid batch statistics.",
      );
    }

    stats[key] = value;
  }

  const needsAttention =
    stats.failed > 0 ||
    stats.claim_errors > 0 ||
    stats.cleanup_errors > 0;

  return {
    kind: needsAttention ? "attention" : "completed",
    stats,
  };
}

export function formatWorkerReport(result) {
  if (result.kind === "disabled") {
    return [
      "**Recommendation refresh**",
      "",
      "Skipped: application processing is disabled.",
      "",
    ].join("\n");
  }

  return [
    "**Recommendation refresh**",
    "",
    result.kind === "attention"
      ? "Completed with worker errors."
      : "Completed without reported worker errors.",
    "",
    "| Counter | Count |",
    "| --- | ---: |",
    ...STAT_KEYS.map(
      (key) => `| ${key} | ${result.stats[key]} |`,
    ),
    "",
  ].join("\n");
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.some((arg) => arg !== "--allow-local")) {
      throw new Error(
        "Only the --allow-local argument is supported.",
      );
    }

    const result = await invokeRecommendationWorker({
      baseUrl: process.env.RECOMMENDATION_APP_URL,
      secret: process.env.RECOMMENDATION_WORKER_SECRET,
      allowLocal: args.includes("--allow-local"),
    });

    const report = formatWorkerReport(result);

    console.log(report);

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        report,
        "utf8",
      );
    }

    if (result.kind === "attention") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Worker invocation failed.",
    );

    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}