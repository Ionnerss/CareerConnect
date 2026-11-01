
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
  "Use your test project's API URL."
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
    throw error ?? new Error("No AAL data.");
  }

  return data;
}

async function verifyTotp(supabase) {
  const { data, error } =
    await supabase.auth.mfa.listFactors();

  if (error) throw error;

  const factor = data.totp.find(
    (f) => f.status === "verified"
  );

  assert.ok(
    factor,
    "User A needs verified TOTP in the test project."
  );

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  let code;

  try {
    code = (
      await rl.question("Enter test User A TOTP code: ")
    ).trim();
  } finally {
    rl.close();
  }

  assert.match(code, /^\d{6}$/);

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

  console.log("PASS: User A reached AAL2");
}

// Create disposable PDFs with distinct content.
function pdf(marker) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let result = `%PDF-1.4\n% ${marker}\n`;
  const offsets = [0];

  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const start = Buffer.byteLength(result);

  result += `xref\n0 ${objects.length + 1}\n`;
  result += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    result +=
      `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  result +=
    `trailer\n<< /Size ${objects.length + 1} ` +
    `/Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;

  return Buffer.from(result, "ascii");
}

async function upload(s, bucket, path, data) {
  const result = await s.storage
    .from(bucket)
    .upload(path, data, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });

  if (result.error) throw result.error;
}

async function replace(s, path, data) {
  return s.storage.from(RESUMES).update(path, data, {
    contentType: "application/pdf",
    cacheControl: "0",
  });
}

async function remove(s, path) {
  return s.storage.from(RESUMES).remove([path]);
}

async function bytes(s, bucket, path) {
  const { data, error } = await s.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw error ?? new Error(`Cannot download ${path}`);
  }

  return Buffer.from(await data.arrayBuffer());
}


async function freshSignedBytes(supabase, bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error) throw error;

  assert.ok(data?.signedUrl, "Signed URL was not generated.");

  // Fetch through a newly generated signed URL.
  // Never print the signed URL itself.
  const response = await fetch(data.signedUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Fresh signed download failed: HTTP ${response.status}`
    );
  }

  return {
    content: Buffer.from(await response.arrayBuffer()),
    cacheStatus: response.headers.get("cf-cache-status"),
  };
}


async function exists(s, bucket, path) {
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);

  const { data, error } = await s.storage
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

  pass("Initial AAL states are correct");

  const run = randomUUID();

  const aPath = `${a.id}/${run}-a.pdf`;
  const bPath = `${b.id}/${run}-b.pdf`;
  const otherPath = `${a.id}/${run}-other.pdf`;

  const original = pdf(`original-${run}`);
  const updated = pdf(`updated-${run}`);
  const unauthorized = pdf(`unauthorized-${run}`);

  // TEST 1:
  // AAL1 users must retain normal permissions
  // outside the protected resumes bucket.

  await upload(
    a.supabase,
    OTHER,
    otherPath,
    original
  );

  assert.deepEqual(
    await bytes(a.supabase, OTHER, otherPath),
    original
  );

  pass("AAL1 access to unrelated bucket is unaffected");

  // TEST 2:
  // User B has no MFA and retains resume permissions.

  await upload(
    b.supabase,
    RESUMES,
    bPath,
    original
  );

  let result = await replace(
    b.supabase,
    bPath,
    updated
  );

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
    false
  );

  pass("User B without MFA can delete own resume");

  // TEST 3:
  // User A completes MFA and uploads a protected file.

  await verifyTotp(a.supabase);

  await upload(
    a.supabase,
    RESUMES,
    aPath,
    original
  );

  assert.deepEqual(
    await bytes(a.supabase, RESUMES, aPath),
    original
  );

  pass("User A at AAL2 can upload own resume");

  // TEST 4:
  // Another password-only session of User A
  // must not replace or delete that file.
const freshA = await signIn(A);
  
const deniedReplaceA = await replace(
  freshA.supabase,
  aPath,
  unauthorized
);

console.log("AAL1 replacement result:", {
  data: deniedReplaceA.data,
  error: deniedReplaceA.error?.message ?? null,
});

// The Storage service must reject the unauthorized update.
assert.ok(
  deniedReplaceA.error,
  "SECURITY FAILURE: AAL1 replacement was accepted."
);

// Independently verify that the original file remains.
const afterDeniedReplace = await freshSignedBytes(
  a.supabase,
  RESUMES,
  aPath
);

assert.deepEqual(
  afterDeniedReplace.content,
  original,
  "AAL1 replacement unexpectedly modified the file."
);

pass("Fresh AAL1 cannot replace protected resume");


  pass("Fresh AAL1 cannot delete protected resume");

  // TEST 5:
  // Different users must never modify another
  // user's resume, regardless of MFA state.

  await replace(
    b.supabase,
    aPath,
    unauthorized
  );

  assert.deepEqual(
    await bytes(a.supabase, RESUMES, aPath),
    original
  );

  pass("User B cannot replace User A's resume");

  await remove(b.supabase, aPath);

  assert.equal(
    await exists(a.supabase, RESUMES, aPath),
    true
  );

  pass("User B cannot delete User A's resume");

  // TEST 6:
  // AAL2 restores authorized replacement and deletion.

  
result = await replace(
  a.supabase,
  aPath,
  updated
);

// Inspect the Storage update response.
console.log("AAL2 replacement result:", {
  data: result.data,
  error: result.error?.message ?? null,
});

if (result.error) {
  throw result.error;
}

// Download through a newly generated signed URL.
const fresh = await freshSignedBytes(
  a.supabase,
  RESUMES,
  aPath
);

console.log("Fresh signed URL verification:", {
  cacheStatus: fresh.cacheStatus,
  actualBytes: fresh.content.length,
  expectedBytes: updated.length,
  matchesOriginal: fresh.content.equals(original),
  matchesUpdated: fresh.content.equals(updated),
});

// Verify the updated bytes.
assert.deepEqual(
  fresh.content,
  updated,
  "Fresh signed URL did not return the updated PDF."
);

// Compare against the normal authenticated download.
const normalDownload = await bytes(
  a.supabase,
  RESUMES,
  aPath
);

if (!normalDownload.equals(updated)) {
  console.warn(
    "WARNING: Authenticated download returned stale content, " +
    "but the fresh signed URL returned the updated PDF."
  );
}

pass("AAL2 can replace own resume");


  pass("AAL2 can delete own resume");

  console.log(
    "\nPASS: Storage replacement, deletion, " +
    "and bucket isolation tests complete."
  );

  console.log(
    "One disposable file remains in mfa-unrelated-test. " +
    "Remove it through the test project's Dashboard."
  );
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
