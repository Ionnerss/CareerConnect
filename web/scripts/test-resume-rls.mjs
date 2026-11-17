import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const accountA = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};

const accountB = {
  email: process.env.TEST_USER_B_EMAIL,
  password: process.env.TEST_USER_B_PASSWORD,
};

function pass(message) {
  console.log(`PASS: ${message}`);
}

function makeClient() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(credentials) {
  const client = makeClient();

  const { error: signInError } =
    await client.auth.signInWithPassword(credentials);

  if (signInError) throw signInError;

  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) {
    throw userError ?? new Error("Signed-in user was unavailable.");
  }

  return { client, userId: data.user.id };
}

async function getAal(client) {
  const { data, error } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    throw error ?? new Error("Unable to determine assurance level.");
  }

  return data;
}

async function readResumes(client) {
  const { data, error } = await client
    .from("resumes")
    .select("id, user_id");

  if (error) throw error;
  return data ?? [];
}

async function readResumeById(client, id) {
  const { data, error } = await client
    .from("resumes")
    .select("id")
    .eq("id", id);

  if (error) throw error;
  return data ?? [];
}

async function askCode() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    return (await rl.question(
      "Enter Account A's current authenticator code: "
    )).trim();
  } finally {
    rl.close();
  }
}

async function run() {
  assert.ok(
    url && key &&
    accountA.email && accountA.password &&
    accountB.email && accountB.password,
    "Set all six TEST_* environment variables."
  );

  const a = await signIn(accountA);
  const b = await signIn(accountB);

  assert.notEqual(
    a.userId,
    b.userId,
    "Accounts A and B must be different users."
  );

  const aAal = await getAal(a.client);
  const bAal = await getAal(b.client);

  assert.equal(aAal.currentLevel, "aal1");
  assert.equal(aAal.nextLevel, "aal2");
  assert.equal(bAal.currentLevel, "aal1");
  assert.equal(bAal.nextLevel, "aal1");
  pass("Account A requires MFA; Account B does not");

  // A has a verified factor but has only signed in with a password.
  const aBeforeMfa = await readResumes(a.client);
  assert.equal(
    aBeforeMfa.length,
    0,
    "SECURITY FAILURE: AAL1 Account A can read protected resumes."
  );
  pass("Account A at AAL1 cannot read resumes");

  // B has no MFA and should retain access to B's own records.
  const bResumes = await readResumes(b.client);
  assert.ok(
    bResumes.length > 0,
    "Account B needs at least one resume for this test."
  );
  assert.ok(
    bResumes.every((row) => row.user_id === b.userId),
    "SECURITY FAILURE: Account B can read another user's resume."
  );
  pass("Account B can read only its own resumes");

  const { data: factors, error: factorError } =
    await a.client.auth.mfa.listFactors();

  if (factorError || !factors) {
    throw factorError ?? new Error("Unable to list Account A's factors.");
  }

  const factor = factors.totp.find(
    (item) => item.status === "verified"
  );

  assert.ok(factor, "Account A needs a verified TOTP factor.");

  const code = await askCode();
  assert.match(code, /^\d{6}$/, "Enter a six-digit code.");

  const { error: verifyError } =
    await a.client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });

  if (verifyError) throw verifyError;

  assert.equal((await getAal(a.client)).currentLevel, "aal2");
  pass("Account A reached AAL2");

  const aAfterMfa = await readResumes(a.client);
  assert.ok(
    aAfterMfa.length > 0,
    "Account A needs at least one resume for this test."
  );
  assert.ok(
    aAfterMfa.every((row) => row.user_id === a.userId),
    "SECURITY FAILURE: Account A can read another user's resume."
  );
  pass("Account A at AAL2 can read only its own resumes");

  // Check both directions explicitly using real resume IDs.
  assert.equal(
    (await readResumeById(a.client, bResumes[0].id)).length,
    0,
    "SECURITY FAILURE: Account A can read Account B's resume."
  );
  assert.equal(
    (await readResumeById(b.client, aAfterMfa[0].id)).length,
    0,
    "SECURITY FAILURE: Account B can read Account A's resume."
  );
  pass("Cross-user resume reads are denied");
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});