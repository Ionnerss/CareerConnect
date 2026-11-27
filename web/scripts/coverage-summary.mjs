import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = fileURLToPath(new URL("../", import.meta.url));

const summaryPath = resolve(
  webDirectory,
  process.env.COVERAGE_SUMMARY_FILE || "coverage/coverage-summary.json",
);

const reportPath = resolve(webDirectory, "coverage/coverage-report.md");

const metrics = [
  ["statements", "Statements"],
  ["branches", "Branches"],
  ["functions", "Functions"],
  ["lines", "Lines"],
];

const outcomeMessages = {
  success: "Test command completed successfully.",
  failure: "> **Warning: the test command failed. Coverage may be incomplete.**",
  cancelled:
    "> **Warning: the test command was cancelled. Coverage may be incomplete.**",
  skipped:
    "> **Warning: the test command was skipped. Any existing coverage may be stale.**",
  unknown:
    "Test outcome was not supplied. This script only reads an existing coverage report.",
};

function validateMetric(metric, name) {
  if (
    !metric ||
    !Number.isSafeInteger(metric.total) ||
    !Number.isSafeInteger(metric.covered) ||
    metric.total < 0 ||
    metric.covered < 0 ||
    metric.covered > metric.total ||
    !Number.isFinite(metric.pct) ||
    metric.pct < 0 ||
    metric.pct > 100
  ) {
    throw new Error(`Invalid coverage metric: ${name}`);
  }
}

async function main() {
  const outcome = process.env.COVERAGE_TEST_OUTCOME || "unknown";

  if (!Object.hasOwn(outcomeMessages, outcome)) {
    throw new Error(
      "COVERAGE_TEST_OUTCOME must be success, failure, cancelled, skipped, or unknown.",
    );
  }

  const sections = ["## Vitest coverage", "", outcomeMessages[outcome], ""];
  let coverageUnavailable = false;

  try {
    const report = JSON.parse(await readFile(summaryPath, "utf8"));

    const rows = metrics.map(([key, label]) => {
      const metric = report?.total?.[key];
      validateMetric(metric, key);

      const percentage =
        metric.total === 0 ? "N/A" : `${metric.pct.toFixed(2)}%`;

      return `| ${label} | ${metric.covered} | ${metric.total} | ${percentage} |`;
    });

    sections.push(
      "| Metric | Covered | Total | Coverage |",
      "| --- | ---: | ---: | ---: |",
      ...rows,
      "",
      "Coverage describes the configured source scope. No baseline comparison was performed.",
    );
  } catch (error) {
    coverageUnavailable = true;

    sections.push(
      "> **Coverage unavailable:** the JSON summary is missing, unreadable, or invalid.",
      "",
      "Check the coverage test step and its generated output.",
    );

    console.error(`Cannot read coverage summary: ${error.message}`);
  }

  const markdown = `${sections.join("\n")}\n`;
  process.stdout.write(markdown);

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  }

  if (coverageUnavailable) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Coverage reporting failed: ${error.message}`);
  process.exitCode = 1;
});