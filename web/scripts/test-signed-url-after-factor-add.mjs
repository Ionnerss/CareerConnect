import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_USER_A_EMAIL;
const password = process.env.TEST_USER_A_PASSWORD;

assert.equal(
  url,
  "http://127.0.0.1:54321",
  "Point TEST_SUPABASE_URL to local Supabase."
);
assert.ok(
  key?.startsWith("sb_publishable_"),
  "Use the local publishable key."
);
assert.ok(email && password, "Set Account A's TEST_* credentials.");

const EXPIRES_IN = 600; // Test-only: time to complete manual enrollment.

function client() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(supabase) {
  const result = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (result.error) {
    throw new Error(
      `Sign-in failed: ${result.error.code ?? "authentication error"}`
    );
  }

  const user = await supabase.auth.getUser();
  assert.ok(user.data?.user?.id, "Could not identify Account A.");
  return user.data.user.id;
}

async function verifiedFactors(supabase) {
  const result = await supabase.auth.mfa.listFactors();
  if (result.error || !result.data) {
    throw new Error("Could not list MFA factors.");
  }
  return result.data.totp.filter(
    (factor) => factor.status === "verified"
  );
}

async function hiddenCode() {
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({
    input: stdin,
    output: mutedOutput,
    terminal: true,
  });

  try {
    stdout.write("Enter Account A's current TOTP code (hidden): ");
    const code = (await rl.question("")).trim();
    stdout.write("\n");
    assert.match(code, /^\d{6}$/, "Enter exactly six digits.");
    return code;
  } finally {
    rl.close();
  }
}

async function waitForBrowserEnrollment() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await rl.question(
      "\nAfter the app reports the backup is verified, press Enter here. "
    );
  } finally {
    rl.close();
  }
}

function testPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let pdf = "%PDF-1.4\n% FACTOR-CHANGE-TEST\n";
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

async function fetchSigned(label, signedUrl, expected, issuedAt) {
  let response;
  try {
    response = await fetch(signedUrl, { cache: "no-store" });
  } catch {
    throw new Error(`Network request failed during ${label}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const result = {
    check: label,
    elapsedSeconds: Number(
      ((Date.now() - issuedAt) / 1000).toFixed(1)
    ),
    status: response.status,
    matchesPdf: response.ok && bytes.equals(expected),
    cacheControl: response.headers.get("cache-control"),
    age: response.headers.get("age"),
    cfCacheStatus: response.headers.get("cf-cache-status"),
  };

  // Never print the URL or response body.
  console.log(JSON.stringify(result));
  return result;
}

async function main() {
  const aal2Client = client();
  const userId = await signIn(aal2Client);

  const before = await verifiedFactors(aal2Client);
  assert.ok(before.length >= 1, "Account A needs an existing factor.");

  console.log(
    `Starting with ${before.length} verified authenticator(s).`
  );

  const code = await hiddenCode();
  const verification =
    await aal2Client.auth.mfa.challengeAndVerify({
      factorId: before[0].id,
      code,
    });

  if (verification.error) {
    throw new Error(
      `MFA failed: ${verification.error.code ?? "verification error"}`
    );
  }

  const assurance =
    await aal2Client.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.equal(
    assurance.data?.currentLevel,
    "aal2",
    "The script did not reach AAL2."
  );

  const path =
    `${userId}/${randomUUID()}-signed-factor-change.pdf`;
  const pdf = testPdf();

  const upload = await aal2Client.storage
    .from("resumes")
    .upload(path, pdf, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });

  if (upload.error) {
    throw new Error(
      `Upload failed: ${upload.error.statusCode ?? "storage error"}`
    );
  }

  const signed = await aal2Client.storage
    .from("resumes")
    .createSignedUrl(path, EXPIRES_IN);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error("Could not issue the original signed URL.");
  }

  const issuedAt = Date.now();
  const signedUrl = signed.data.signedUrl;

  const initial = await fetchSigned(
    "before factor addition",
    signedUrl,
    pdf,
    issuedAt
  );
  assert.equal(initial.status, 200);
  assert.equal(initial.matchesPdf, true);

  console.log(
    "\nIn the LOCAL app, sign in as Account A, complete MFA, " +
    "and add and verify a backup at /account/security."
  );
  console.log(
    "Keep the existing factor enrolled. The test URL expires " +
    "10 minutes after issuance."
  );

  await waitForBrowserEnrollment();

  const freshAal1Client = client();
  await signIn(freshAal1Client);

  const after = await verifiedFactors(freshAal1Client);
  const beforeIds = new Set(before.map((factor) => factor.id));
  const afterIds = new Set(after.map((factor) => factor.id));

  assert.ok(
    before.every((factor) => afterIds.has(factor.id)),
    "An existing verified factor was removed; stop."
  );
  assert.ok(
    after.some((factor) => !beforeIds.has(factor.id)),
    "No newly verified backup factor was found."
  );

  console.log(
    `PASS: Verified factor count increased from ` +
      `${before.length} to ${after.length}; old factor remains.`
  );

  assert.ok(
    Date.now() - issuedAt < EXPIRES_IN * 1000,
    "Original URL already expired; rerun to test factor-change behavior."
  );

  const oldUrl = await fetchSigned(
    "after factor addition, before expiry",
    signedUrl,
    pdf,
    issuedAt
  );

  const freshAssurance =
    await freshAal1Client.auth.mfa
      .getAuthenticatorAssuranceLevel();
  assert.equal(freshAssurance.data?.currentLevel, "aal1");
  assert.equal(freshAssurance.data?.nextLevel, "aal2");

  const newUrl = await freshAal1Client.storage
    .from("resumes")
    .createSignedUrl(path, 60);

  assert.ok(
    newUrl.error || !newUrl.data?.signedUrl,
    "SECURITY FAILURE: AAL1 issued a new resume URL."
  );

  console.log(
    "PASS: Fresh AAL1 session cannot issue a new signed URL."
  );
  console.log(
    `DONE: Old URL status after factor addition was ${oldUrl.status}.`
  );
  console.log(
    "Disposable PDF remains in the local resumes bucket."
  );
}

main().catch((error) => {
  console.error(
    "FAIL:",
    error instanceof Error ? error.message : "Unexpected error"
  );
  process.exitCode = 1;
});