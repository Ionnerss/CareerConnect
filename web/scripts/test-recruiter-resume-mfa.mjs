
import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const MODE = process.argv[2];

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const APPLICANT = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};

const RECRUITER = {
  email: process.env.TEST_RECRUITER_EMAIL,
  password: process.env.TEST_RECRUITER_PASSWORD,
};

const SUBMITTED_ID = "33333333-3333-4333-8333-333333333333";
const UNSUBMITTED_ID = "44444444-4444-4444-8444-444444444444";
const BUCKET = "resumes";

assert.ok(
  ["seed", "baseline", "enroll", "enforced"].includes(MODE),
  "Usage: node scripts/test-recruiter-resume-mfa.mjs seed|baseline|enroll|enforced"
);

assert.ok(
  URL?.startsWith("https://") &&
    !URL.includes("supabase.com/dashboard"),
  "Use your isolated project's API URL."
);

assert.ok(
  KEY?.startsWith("sb_publishable_"),
  "Use the isolated project's publishable key, never a secret key."
);

assert.ok(
  APPLICANT.email &&
    APPLICANT.password &&
    RECRUITER.email &&
    RECRUITER.password,
  "Missing test-user credentials."
);

function newClient() {
  return createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function login(credentials) {
  const supabase = newClient();

  const { error } =
    await supabase.auth.signInWithPassword(credentials);

  if (error) throw error;

  const { data, error: userError } =
    await supabase.auth.getUser();

  if (userError || !data?.user) {
    throw userError ?? new Error("Missing authenticated user.");
  }

  return { supabase, id: data.user.id };
}

async function aal(supabase) {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    throw error ?? new Error("Unable to read AAL.");
  }

  return data;
}

async function codePrompt(who) {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const code = (
      await rl.question(
        `Enter ${who}'s six-digit authenticator code: `
      )
    ).trim();

    assert.match(code, /^\d{6}$/, "Enter six digits.");
    return code;
  } finally {
    rl.close();
  }
}

async function verifyTotp(supabase, who) {
  const { data, error } =
    await supabase.auth.mfa.listFactors();

  if (error) throw error;

  const factor = data.totp.find(
    (f) => f.status === "verified"
  );

  assert.ok(
    factor,
    `${who} must have a verified TOTP factor.`
  );

  const code = await codePrompt(who);

  const { error: verifyError } =
    await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });

  if (verifyError) throw verifyError;

  assert.equal(
    (await aal(supabase)).currentLevel,
    "aal2"
  );
}

function testPdf(label) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let pdf = `%PDF-1.4\n% ${label}\n`;
  const offsets = [0];

  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const xref = Buffer.byteLength(pdf);

  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const off of offsets.slice(1)) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

async function visibleResumeIds(supabase) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id")
    .in("id", [SUBMITTED_ID, UNSUBMITTED_ID]);

  if (error) throw error;

  return data.map((x) => x.id).sort();
}

function expectIds(ids, expected, why) {
  assert.deepEqual(ids, [...expected].sort(), why);
  console.log(`PASS: ${why}`);
}

async function signedBytes(supabase, path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);

  if (error) throw error;

  assert.ok(data?.signedUrl, "No signed URL returned.");

  const response = await fetch(data.signedUrl, {
    cache: "no-store",
  });

  assert.ok(
    response.ok,
    `Signed download failed: HTTP ${response.status}`
  );

  return Buffer.from(await response.arrayBuffer());
}

async function expectSignedDenied(supabase, path, description) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);

  assert.ok(
    error || !data?.signedUrl,
    `SECURITY FAILURE: ${description}`
  );

  console.log(`PASS: ${description}`);
}

async function expectDownloadDenied(supabase, path, description) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  assert.ok(error, `SECURITY FAILURE: ${description}`);
  console.log(`PASS: ${description}`);
}

async function expectUpdateDenied(supabase, path, description) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .update(path, testPdf("UNAUTHORIZED"), {
      contentType: "application/pdf",
      cacheControl: "0",
    });

  assert.ok(error, `SECURITY FAILURE: ${description}`);
  console.log(`PASS: ${description}`);
}

async function tryDelete(supabase, path) {
  // Storage may return success with zero deleted rows.
  // Later, verify that the applicant's file still exists.
  await supabase.storage.from(BUCKET).remove([path]);
}

async function run() {
  const submittedPdf = testPdf("SUBMITTED-MFA-TEST");
  const unsubmittedPdf = testPdf("UNSUBMITTED-MFA-TEST");

  // ----------------------------------------
  // MODE 1: Seed actual Storage files.
  // ----------------------------------------

  if (MODE === "seed") {
    const applicant = await login(APPLICANT);

    const submittedPath =
      `${applicant.id}/recruiter-test-submitted.pdf`;

    const unsubmittedPath =
      `${applicant.id}/recruiter-test-unsubmitted.pdf`;

    expectIds(
      await visibleResumeIds(applicant.supabase),
      [SUBMITTED_ID, UNSUBMITTED_ID],
      "Both applicant metadata rows exist"
    );

    assert.equal(
      (await aal(applicant.supabase)).nextLevel,
      "aal2"
    );

    await verifyTotp(applicant.supabase, "User A");

    for (const [path, pdf] of [
      [submittedPath, submittedPdf],
      [unsubmittedPath, unsubmittedPdf],
    ]) {
      const { error } = await applicant.supabase.storage
        .from(BUCKET)
        .upload(path, pdf, {
          contentType: "application/pdf",
          cacheControl: "0",
          upsert: true,
        });

      if (error) throw error;

      assert.deepEqual(
        await signedBytes(applicant.supabase, path),
        pdf
      );
    }

    console.log(
      "PASS: Both applicant PDFs uploaded and verified"
    );

    return;
  }

  const recruiter = await login(RECRUITER);
  const recruiterAal = await aal(recruiter.supabase);

  const applicant = await login(APPLICANT);

  const submittedPath =
    `${applicant.id}/recruiter-test-submitted.pdf`;

  const unsubmittedPath =
    `${applicant.id}/recruiter-test-unsubmitted.pdf`;

  // ----------------------------------------
  // MODE 2: Recruiter without MFA.
  // ----------------------------------------

  if (MODE === "baseline") {
    assert.equal(recruiterAal.currentLevel, "aal1");

    assert.equal(
      recruiterAal.nextLevel,
      "aal1",
      "Recruiter must NOT enroll MFA before baseline."
    );

    expectIds(
      await visibleResumeIds(recruiter.supabase),
      [SUBMITTED_ID],
      "Recruiter without MFA sees only submitted resume metadata"
    );

    assert.deepEqual(
      await signedBytes(recruiter.supabase, submittedPath),
      submittedPdf
    );

    console.log(
      "PASS: Recruiter without MFA can read submitted PDF"
    );

    await expectSignedDenied(
      recruiter.supabase,
      unsubmittedPath,
      "Recruiter cannot sign an unsubmitted PDF"
    );

    await expectDownloadDenied(
      recruiter.supabase,
      unsubmittedPath,
      "Recruiter cannot download an unsubmitted PDF"
    );

    await expectUpdateDenied(
      recruiter.supabase,
      submittedPath,
      "Recruiter cannot replace applicant PDF without MFA"
    );

    await tryDelete(recruiter.supabase, submittedPath);

    assert.deepEqual(
      await signedBytes(recruiter.supabase, submittedPath),
      submittedPdf
    );

    console.log(
      "PASS: Recruiter cannot delete submitted PDF"
    );

    return;
  }

  // ----------------------------------------
  // MODE 3: Enroll recruiter in TOTP.
  // ----------------------------------------

  if (MODE === "enroll") {
    if (recruiterAal.nextLevel === "aal2") {
      console.log(
        "Recruiter already has MFA enrolled. Nothing to do."
      );
      return;
    }

    assert.equal(recruiterAal.currentLevel, "aal1");

    const { data, error } =
      await recruiter.supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Recruiter RLS test",
      });

    if (error || !data?.totp?.secret) {
      throw error ?? new Error("TOTP secret missing.");
    }

    console.log(
      "Enter this test-only TOTP secret in your authenticator:"
    );
    console.log(data.totp.secret);

    const code = await codePrompt("Recruiter");

    const { error: verifyError } =
      await recruiter.supabase.auth.mfa.challengeAndVerify({
        factorId: data.id,
        code,
      });

    if (verifyError) throw verifyError;

    assert.equal(
      (await aal(recruiter.supabase)).currentLevel,
      "aal2"
    );

    console.log(
      "PASS: Recruiter enrolled and verified TOTP"
    );

    return;
  }

  // ----------------------------------------
  // MODE 4: Enforce MFA on recruiter access.
  // ----------------------------------------

  assert.equal(recruiterAal.currentLevel, "aal1");

  assert.equal(
    recruiterAal.nextLevel,
    "aal2",
    "Run enroll mode first."
  );

  // Password-only recruiter must be blocked.
  expectIds(
    await visibleResumeIds(recruiter.supabase),
    [],
    "MFA-enabled recruiter at AAL1 cannot view submitted metadata"
  );

  await expectSignedDenied(
    recruiter.supabase,
    submittedPath,
    "AAL1 recruiter cannot generate submitted PDF signed URL"
  );

  await expectDownloadDenied(
    recruiter.supabase,
    submittedPath,
    "AAL1 recruiter cannot download submitted PDF"
  );

  await expectUpdateDenied(
    recruiter.supabase,
    submittedPath,
    "AAL1 recruiter cannot replace submitted PDF"
  );

  await tryDelete(recruiter.supabase, submittedPath);

  // Complete MFA for recruiter.
  await verifyTotp(recruiter.supabase, "Recruiter");

  expectIds(
    await visibleResumeIds(recruiter.supabase),
    [SUBMITTED_ID],
    "AAL2 recruiter can view submitted metadata only"
  );

  assert.deepEqual(
    await signedBytes(recruiter.supabase, submittedPath),
    submittedPdf
  );

  console.log(
    "PASS: AAL2 recruiter can download authorized submitted PDF"
  );

  await expectSignedDenied(
    recruiter.supabase,
    unsubmittedPath,
    "AAL2 recruiter still cannot sign unsubmitted PDF"
  );

  await expectDownloadDenied(
    recruiter.supabase,
    unsubmittedPath,
    "AAL2 recruiter still cannot download unsubmitted PDF"
  );

  await expectUpdateDenied(
    recruiter.supabase,
    submittedPath,
    "AAL2 recruiter still cannot replace applicant PDF"
  );

  await tryDelete(recruiter.supabase, submittedPath);

  // Independently verify applicant's original files.
  await verifyTotp(applicant.supabase, "User A");

  assert.deepEqual(
    await signedBytes(applicant.supabase, submittedPath),
    submittedPdf
  );

  assert.deepEqual(
    await signedBytes(applicant.supabase, unsubmittedPath),
    unsubmittedPdf
  );

  console.log(
    "PASS: Applicant PDFs unchanged after recruiter write attempts"
  );

  // Fresh password-only session must remain blocked.
  const freshRecruiter = await login(RECRUITER);

  assert.equal(
    (await aal(freshRecruiter.supabase)).currentLevel,
    "aal1"
  );

  expectIds(
    await visibleResumeIds(freshRecruiter.supabase),
    [],
    "Fresh recruiter password-only session cannot see submitted metadata"
  );

  await expectSignedDenied(
    freshRecruiter.supabase,
    submittedPath,
    "Fresh recruiter AAL1 session cannot create signed URL"
  );

  console.log(
    "\nPASS: Recruiter metadata, Storage, and MFA enforcement verified."
  );
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
