
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const USER_A = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};

const USER_B = {
  email: process.env.TEST_USER_B_EMAIL,
  password: process.env.TEST_USER_B_PASSWORD,
};

const BUCKET = "resumes";

if (
  !URL?.startsWith("https://") ||
  URL.includes("supabase.com/dashboard") ||
  !KEY?.startsWith("sb_publishable_") ||
  !USER_A.email ||
  !USER_A.password ||
  !USER_B.email ||
  !USER_B.password
) {
  throw new Error(
    "Configure the isolated project's API URL, " +
    "publishable key, and test-user credentials."
  );
}

function createTestClient() {
  return createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(credentials) {
  const supabase = createTestClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;

  const { data, error: userError } =
    await supabase.auth.getUser();

  if (userError || !data.user) {
    throw userError ?? new Error("User not found.");
  }

  return {
    supabase,
    userId: data.user.id,
  };
}

async function getAal(supabase) {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    throw error ?? new Error("Unable to read MFA level.");
  }

  return data;
}

function createTestPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf);

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} ` +
    `/Root 1 0 R >>\n`;

  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function expectDenied(operation, description) {
  const { error } = await operation();

  assert.ok(
    error,
    `Expected access denial, but operation succeeded: ${description}`
  );

  pass(description);
}

async function expectUpload(supabase, path, pdf, description) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;

  pass(description);
}

async function expectDownload(supabase, path, pdf, description) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (error) throw error;

  assert.ok(data, "Download returned no file.");

  const downloaded = Buffer.from(await data.arrayBuffer());

  assert.deepEqual(downloaded, pdf);

  pass(description);
}

async function expectSignedUrl(supabase, path, description) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);

  if (error) throw error;

  assert.ok(data?.signedUrl, "Signed URL missing.");

  pass(description);
}

async function verifyTotp(supabase) {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) throw error;

  const factor = data.totp.find(
    (item) => item.status === "verified"
  );

  assert.ok(
    factor,
    "User A must have verified TOTP MFA enabled."
  );

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  let code;

  try {
    code = (
      await rl.question(
        "Enter User A's current six-digit TOTP code: "
      )
    ).trim();
  } finally {
    rl.close();
  }

  assert.match(code, /^\d{6}$/, "Invalid code format.");

  const { error: verifyError } =
    await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });

  if (verifyError) throw verifyError;

  const aal = await getAal(supabase);

  assert.equal(aal.currentLevel, "aal2");

  pass("User A completed MFA and reached AAL2");
}

async function main() {
  console.log("\nTesting Storage MFA enforcement...\n");

  const a = await signIn(USER_A);
  const b = await signIn(USER_B);

  assert.notEqual(a.userId, b.userId);

  const aAal = await getAal(a.supabase);
  const bAal = await getAal(b.supabase);

  // A has MFA enabled but has not completed it.
  assert.equal(aAal.currentLevel, "aal1");
  assert.equal(aAal.nextLevel, "aal2");

  // B has no verified MFA factor.
  assert.equal(bAal.currentLevel, "aal1");
  assert.equal(bAal.nextLevel, "aal1");

  pass("Initial MFA levels are correct");

  const pdf = createTestPdf();
  const runId = randomUUID();

  const aPath = `${a.userId}/${runId}-a.pdf`;
  const bPath = `${b.userId}/${runId}-b.pdf`;

  // ----------------------------------------
  // TEST 1: MFA-enabled AAL1 cannot upload.
  // ----------------------------------------

  await expectDenied(
    () =>
      a.supabase.storage
        .from(BUCKET)
        .upload(aPath, pdf, {
          contentType: "application/pdf",
          upsert: false,
        }),
    "User A at AAL1 cannot upload their own PDF"
  );

  // ----------------------------------------
  // TEST 2: Non-MFA user retains access.
  // ----------------------------------------

  await expectUpload(
    b.supabase,
    bPath,
    pdf,
    "User B without MFA can upload"
  );

  await expectDownload(
    b.supabase,
    bPath,
    pdf,
    "User B without MFA can download"
  );

  await expectSignedUrl(
    b.supabase,
    bPath,
    "User B without MFA can create a signed URL"
  );

  // ----------------------------------------
  // TEST 3: User A completes MFA.
  // ----------------------------------------

  await verifyTotp(a.supabase);

  // ----------------------------------------
  // TEST 4: AAL2 restores authorized access.
  // ----------------------------------------

  await expectUpload(
    a.supabase,
    aPath,
    pdf,
    "User A at AAL2 can upload"
  );

  await expectDownload(
    a.supabase,
    aPath,
    pdf,
    "User A at AAL2 can download"
  );

  await expectSignedUrl(
    a.supabase,
    aPath,
    "User A at AAL2 can create a signed URL"
  );

  // ----------------------------------------
  // TEST 5: MFA does not bypass ownership.
  // ----------------------------------------

  await expectDenied(
    () =>
      a.supabase.storage
        .from(BUCKET)
        .download(bPath),
    "User A at AAL2 cannot download User B's PDF"
  );

  await expectDenied(
    () =>
      b.supabase.storage
        .from(BUCKET)
        .download(aPath),
    "User B cannot download User A's PDF"
  );

  await expectDenied(
    () =>
      a.supabase.storage
        .from(BUCKET)
        .createSignedUrl(bPath, 60),
    "User A cannot sign User B's PDF"
  );

  // ----------------------------------------
  // TEST 6: Fresh AAL1 session loses access.
  // ----------------------------------------

  const freshA = await signIn(USER_A);

  const freshLevel = await getAal(freshA.supabase);

  assert.equal(freshLevel.currentLevel, "aal1");
  assert.equal(freshLevel.nextLevel, "aal2");

  await expectDenied(
    () =>
      freshA.supabase.storage
        .from(BUCKET)
        .download(aPath),
    "Fresh AAL1 session cannot download User A's PDF"
  );

  await expectDenied(
    () =>
      freshA.supabase.storage
        .from(BUCKET)
        .createSignedUrl(aPath, 60),
    "Fresh AAL1 session cannot create a signed URL"
  );

  console.log("\nAll Storage MFA tests passed.");
  console.log(
    "Disposable test PDFs remain in the isolated bucket."
  );
}

main().catch((error) => {
  console.error("\nFAIL:", error.message);
  process.exitCode = 1;
});
