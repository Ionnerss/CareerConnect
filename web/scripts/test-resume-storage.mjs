
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const USERS = [
  {
    email: process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_USER_A_PASSWORD,
  },
  {
    email: process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_USER_B_PASSWORD,
  },
];

if (!URL || !KEY || USERS.some((u) => !u.email || !u.password)) {
  throw new Error("Missing test environment configuration.");
}

if (
  !URL.startsWith("https://") ||
  URL.includes("supabase.com/dashboard") ||
  KEY.startsWith("sb_secret_")
) {
  throw new Error(
    "Use the test project's API URL and publishable key."
  );
}

function client() {
  return createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(user) {
  const supabase = client();

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) throw error;

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    throw userError ?? new Error("Authenticated user missing.");
  }

  return {
    supabase,
    userId: data.user.id,
  };
}

// Generate a valid, disposable, blank one-page PDF.
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

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function upload(supabase, path, pdf) {
  return supabase.storage.from("resumes").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
}

async function expectUploadAllowed(supabase, path, pdf, description) {
  const { error } = await upload(supabase, path, pdf);

  if (error) throw error;

  pass(description);
}

async function expectUploadDenied(supabase, path, pdf, description) {
  const { error } = await upload(supabase, path, pdf);

  assert.ok(error, `Upload unexpectedly succeeded: ${description}`);

  pass(description);
}

async function expectDownloadAllowed(supabase, path, pdf, description) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .download(path);

  if (error) throw error;

  assert.ok(data, "Download returned no data.");

  const downloaded = Buffer.from(await data.arrayBuffer());

  assert.deepEqual(downloaded, pdf);

  pass(description);
}

async function expectDownloadDenied(supabase, path, description) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .download(path);

  assert.ok(error, `Unauthorized download succeeded: ${description}`);
  assert.equal(data, null);

  pass(description);
}

async function expectSignedUrlAllowed(supabase, path, description) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60);

  if (error) throw error;

  assert.ok(data?.signedUrl);

  pass(description);
}

async function expectSignedUrlDenied(supabase, path, description) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60);

  assert.ok(error, `Unauthorized signed URL created: ${description}`);
  assert.ok(!data?.signedUrl);

  pass(description);
}

async function main() {
  const a = await signIn(USERS[0]);
  const b = await signIn(USERS[1]);

  assert.notEqual(a.userId, b.userId);

  const pdf = createTestPdf();
  const runId = randomUUID();

  const aPath = `${a.userId}/${runId}-a.pdf`;
  const bPath = `${b.userId}/${runId}-b.pdf`;

  const unauthorizedPath = `${a.userId}/${runId}-unauthorized.pdf`;

  console.log("Testing resume Storage ownership...\n");

  // Users can upload into their own folders.
  await expectUploadAllowed(
    a.supabase,
    aPath,
    pdf,
    "User A can upload into their own folder"
  );

  await expectUploadAllowed(
    b.supabase,
    bPath,
    pdf,
    "User B can upload into their own folder"
  );

  // User B cannot upload into User A's folder.
  await expectUploadDenied(
    b.supabase,
    unauthorizedPath,
    pdf,
    "User B cannot upload into User A's folder"
  );

  // Users can download their own PDFs.
  await expectDownloadAllowed(
    a.supabase,
    aPath,
    pdf,
    "User A can download their own PDF"
  );

  await expectDownloadAllowed(
    b.supabase,
    bPath,
    pdf,
    "User B can download their own PDF"
  );

  // Cross-user downloads must be denied.
  await expectDownloadDenied(
    a.supabase,
    bPath,
    "User A cannot download User B's PDF"
  );

  await expectDownloadDenied(
    b.supabase,
    aPath,
    "User B cannot download User A's PDF"
  );

  // The same ownership rules apply to signed URL creation.
  await expectSignedUrlAllowed(
    a.supabase,
    aPath,
    "User A can create a signed URL for their PDF"
  );

  await expectSignedUrlAllowed(
    b.supabase,
    bPath,
    "User B can create a signed URL for their PDF"
  );

  await expectSignedUrlDenied(
    a.supabase,
    bPath,
    "User A cannot create a signed URL for User B's PDF"
  );

  await expectSignedUrlDenied(
    b.supabase,
    aPath,
    "User B cannot create a signed URL for User A's PDF"
  );

  console.log("\nAll baseline Storage tests passed.");
  console.log("Test files remain in the isolated Storage bucket.");
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
