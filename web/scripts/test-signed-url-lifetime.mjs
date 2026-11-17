import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_USER_A_EMAIL;
const password = process.env.TEST_USER_A_PASSWORD;

assert.ok(
  url?.startsWith("https://") &&
    !url.includes("supabase.com/dashboard"),
  "Use the hosted isolated project's API URL."
);
assert.ok(
  key?.startsWith("sb_publishable_"),
  "Use a publishable key, never a secret key."
);
assert.ok(email && password, "Set Account A's TEST_* credentials.");

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function promptForCode() {
  // Send readline's output to a sink so the entered code is not echoed.
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
    stdout.write("Enter Account A's current six-digit code (hidden): ");
    const code = (await rl.question("")).trim();
    stdout.write("\n");
    assert.match(code, /^\d{6}$/, "Enter exactly six digits.");
    return code;
  } finally {
    rl.close();
  }
}

function testPdf(marker) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let result = `%PDF-1.4\n% ${marker}\n`;
  const offsets = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n`;
  result += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    result += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  result +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`;

  return Buffer.from(result, "ascii");
}

async function observe(label, signedUrl, expectedBytes, issuedAt) {
  let response;
  try {
    // No Authorization header or Supabase client is used for this download.
    response = await fetch(signedUrl, { cache: "no-store" });
  } catch {
    throw new Error(`Network request failed during ${label}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const result = {
    check: label,
    elapsedSeconds: Number(((Date.now() - issuedAt) / 1000).toFixed(1)),
    status: response.status,
    matchesPdf: response.ok && bytes.equals(expectedBytes),
    cacheControl: response.headers.get("cache-control"),
    age: response.headers.get("age"),
    cfCacheStatus: response.headers.get("cf-cache-status"),
  };

  // Deliberately exclude the signed URL, response body, and tokens.
  console.log(JSON.stringify(result));
  return result;
}

async function main() {
  const signIn = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signIn.error) {
    throw new Error(
      `Sign-in failed: ${signIn.error.code ?? "authentication error"}`
    );
  }

  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) {
    throw new Error("Could not identify Account A.");
  }
  const userId = userResult.data.user.id;

  const factorResult = await supabase.auth.mfa.listFactors();
  if (factorResult.error || !factorResult.data) {
    throw new Error("Could not list Account A's factors.");
  }

  const factor = factorResult.data.totp.find(
    (item) => item.status === "verified"
  );
  assert.ok(factor, "Account A needs a verified TOTP factor.");

  console.log(
    `Using authenticator: ${factor.friendly_name ?? "Unnamed"} ` +
      `(${factor.id.slice(0, 8)})`
  );

  const code = await promptForCode();
  const verification = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verification.error) {
    throw new Error(
      `MFA failed: ${verification.error.code ?? "verification error"}`
    );
  }

  const assurance =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.equal(
    assurance.data?.currentLevel,
    "aal2",
    "Account A did not reach AAL2."
  );

  const path = `${userId}/${randomUUID()}-signed-url-lifetime.pdf`;
  const pdf = testPdf("SIGNED-URL-LIFETIME-TEST");

  const upload = await supabase.storage.from("resumes").upload(
    path,
    pdf,
    {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    }
  );
  if (upload.error) {
    throw new Error(
      `Upload failed: ${upload.error.statusCode ?? "storage error"}`
    );
  }

  const signed = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 30);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error("Could not create a 30-second signed URL.");
  }

  const issuedAt = Date.now();
  const signedUrl = signed.data.signedUrl;

  const initial = await observe("before logout", signedUrl, pdf, issuedAt);
  assert.equal(initial.status, 200, "Initial signed download failed.");
  assert.equal(initial.matchesPdf, true, "Initial PDF bytes did not match.");

  const signOut = await supabase.auth.signOut({ scope: "local" });
  if (signOut.error) {
    throw new Error(
      `Sign-out failed: ${signOut.error.code ?? "authentication error"}`
    );
  }

  const afterLogout = await observe(
    "after logout, before expiry",
    signedUrl,
    pdf,
    issuedAt
  );
  assert.ok(
    afterLogout.elapsedSeconds < 30,
    "The post-logout check ran after the URL expired; rerun the test."
  );

  // Wait until at least 35 seconds after URL issuance.
  await delay(Math.max(0, 35_000 - (Date.now() - issuedAt)));

  await observe("after expiry", signedUrl, pdf, issuedAt);

  console.log(
    "DONE: Disposable PDF remains in the isolated project's resumes bucket."
  );
  console.log(`Local cleanup path (do not include in shared results): ${path}`);
}

main().catch((error) => {
  console.error(
    "FAIL:",
    error instanceof Error ? error.message : "Unexpected error"
  );
  process.exitCode = 1;
});