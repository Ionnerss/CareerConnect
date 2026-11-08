import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const A = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};

const B = {
  email: process.env.TEST_USER_B_EMAIL,
  password: process.env.TEST_USER_B_PASSWORD,
};

const RESUMES = "resumes";
const OTHER = "mfa-unrelated-test";

assert.ok(
  URL?.startsWith("https://") &&
    !URL.includes("supabase.com/dashboard"),
  "Use your isolated test project's API URL."
);

assert.ok(
  KEY?.startsWith("sb_publishable_"),
  "Use a publishable key, never a secret key."
);

assert.ok(
  A.email && A.password && B.email && B.password,
  "Missing test-user credentials."
);

function client() {
  return createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(credentials) {
  const supabase = client();

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
    throw error ?? new Error("Unable to determine MFA level.");
  }

  return data;
}

async function verifyTotp(supabase) {
  const { data, error } =
    await supabase.auth.mfa.listFactors();

  if (error || !data) {
    throw error ?? new Error("Unable to list MFA factors.");
  }

  const factor = data.totp.find(
    (item) => item.status === "verified"
  );

  assert.ok(
    factor,
    "User A needs a verified TOTP factor."
  );

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  let code;

  try {
    code = (
      await rl.question("Enter User A's current TOTP code: ")
    ).trim();
  } finally {
    rl.close();
  }

  assert.match(code, /^\d{6}$/, "Enter a six-digit code.");

  const { error: verifyError } =
    await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });

  if (verifyError) throw verifyError;

  assert.equal((await aal(supabase)).currentLevel, "aal2");
  pass("User A reached AAL2");
}

function pdf(marker) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let result = `%PDF-1.4\n% ${marker}\n`;
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(result);

  result += `xref\n0 ${objects.length + 1}\n`;
  result += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    result +=
      `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  result +=
    `trailer\n<< /Size ${objects.length + 1} ` +
    `/Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(result, "ascii");
}

async function upload(supabase, bucket, path, content) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, content, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });

  if (error) throw error;
}

async function replace(supabase, path, content) {
  return supabase.storage
    .from(RESUMES)
    .update(path, content, {
      contentType: "application/pdf",
      cacheControl: "0",
    });
}

async function remove(supabase, path) {
  return supabase.storage.from(RESUMES).remove([path]);
}

async function bytes(supabase, bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw error ?? new Error(`Cannot download ${path}.`);
  }

  return Buffer.from(await data.arrayBuffer());
}

async function freshSignedBytes(supabase, bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error) throw error;
  assert.ok(data?.signedUrl, "Signed URL was not generated.");

  // Fetch the file through a newly issued URL.
  // Do not print the URL or the file contents.
  const response = await fetch(data.signedUrl, {
    cache: "no-store",
  });

  assert.equal(
    response.ok,
    true,
    `Signed download failed: HTTP ${response.status}.`
  );

  return Buffer.from(await response.arrayBuffer());
}

async function exists(supabase, bucket, path) {
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, {
      search: filename,
      limit: 100,
    });

  if (error) throw error;

  return data.some((file) => file.name === filename);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function main() {
  console.log("\nTesting Storage MFA regression cases...\n");

  const a = await signIn(A);
  const b = await signIn(B);

  assert.notEqual(a.id, b.id);

  const aInitial = await aal(a.supabase);
  const bInitial = await aal(b.supabase);

  assert.equal(aInitial.currentLevel, "aal1");
  assert.equal(aInitial.nextLevel, "aal2");
  assert.equal(bInitial.currentLevel, "aal1");
  assert.equal(bInitial.nextLevel, "aal1");

  pass("Initial MFA levels are correct");

  const runId = randomUUID();
  const aPath = `${a.id}/${runId}-a.pdf`;
  const bPath = `${b.id}/${runId}-b.pdf`;
  const otherPath = `${a.id}/${runId}-other.pdf`;

  const original = pdf(`original-${runId}`);
  const updated = pdf(`updated-${runId}`);
  const unauthorized = pdf(`unauthorized-${runId}`);

  // AAL1 remains usable in a bucket unrelated to protected resumes.
  await upload(a.supabase, OTHER, otherPath, original);

  assert.deepEqual(
    await bytes(a.supabase, OTHER, otherPath),
    original
  );

  pass("AAL1 access to unrelated bucket is unaffected");

  // User B has no MFA and can manage B's own resume.
  await upload(b.supabase, RESUMES, bPath, original);

  let result = await replace(b.supabase, bPath, updated);
  if (result.error) throw result.error;

  assert.deepEqual(
    await bytes(b.supabase, RESUMES, bPath),
    updated
  );

  pass("User B without MFA can replace own resume");

  result = await remove(b.supabase, bPath);
  if (result.error) throw result.error;

  assert.equal(
    await exists(b.supabase, RESUMES, bPath),
    false,
    "User B's file still exists after deletion."
  );

  pass("User B without MFA can delete own resume");

  // A completes MFA and creates a protected test file.
  await verifyTotp(a.supabase);
  await upload(a.supabase, RESUMES, aPath, original);

  assert.deepEqual(
    await bytes(a.supabase, RESUMES, aPath),
    original
  );

  pass("User A at AAL2 can upload own resume");

  // A new password-only session must not replace the file.
  const freshA = await signIn(A);

  assert.equal((await aal(freshA.supabase)).currentLevel, "aal1");

  const deniedReplace = await replace(
    freshA.supabase,
    aPath,
    unauthorized
  );

  assert.ok(
    deniedReplace.error,
    "SECURITY FAILURE: AAL1 replacement was accepted."
  );

  assert.deepEqual(
    await freshSignedBytes(a.supabase, RESUMES, aPath),
    original,
    "AAL1 replacement modified the file."
  );

  pass("Fresh AAL1 cannot replace protected resume");

  // Perform the deletion attempt, then check the file itself.
  // A denied Storage remove may report no error and delete zero files.
  await remove(freshA.supabase, aPath);

  assert.equal(
    await exists(a.supabase, RESUMES, aPath),
    true,
    "SECURITY FAILURE: AAL1 deleted the protected resume."
  );

  assert.deepEqual(
    await freshSignedBytes(a.supabase, RESUMES, aPath),
    original,
    "AAL1 deletion changed or removed the file."
  );

  pass("Fresh AAL1 cannot delete protected resume");

  // User B cannot alter A's file, even though B can use B's own files.
  await replace(b.supabase, aPath, unauthorized);

  assert.deepEqual(
    await freshSignedBytes(a.supabase, RESUMES, aPath),
    original,
    "User B replaced User A's file."
  );

  pass("User B cannot replace User A's resume");

  await remove(b.supabase, aPath);

  assert.equal(
    await exists(a.supabase, RESUMES, aPath),
    true,
    "SECURITY FAILURE: User B deleted User A's file."
  );

  pass("User B cannot delete User A's resume");

  // AAL2 restores A's ability to replace the file.
  result = await replace(a.supabase, aPath, updated);
  if (result.error) throw result.error;

  assert.deepEqual(
    await freshSignedBytes(a.supabase, RESUMES, aPath),
    updated,
    "AAL2 replacement did not produce the updated PDF."
  );

  pass("AAL2 can replace own resume");

  // Actually delete the file and verify that it is gone.
  result = await remove(a.supabase, aPath);
  if (result.error) throw result.error;

  assert.equal(
    await exists(a.supabase, RESUMES, aPath),
    false,
    "AAL2 deletion returned success, but the file still exists."
  );

  pass("AAL2 can delete own resume");

  console.log("\nAll Storage MFA regression tests passed.");
  console.log(
    "One disposable file remains in mfa-unrelated-test. " +
    "Remove it from the isolated test project."
  );
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
