import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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

function isAnonJwt(value) {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return payload.role === "anon";
  } catch {
    return false;
  }
}

function checkConfiguration() {
  assert.ok(
    url === "http://127.0.0.1:54321" ||
      url === "http://localhost:54321",
    "Use the local Supabase API URL from `npx supabase status`."
  );

  assert.ok(
    key?.startsWith("sb_publishable_") || (key && isAnonJwt(key)),
    "Use the local publishable or anon key, never a secret/service-role key."
  );

  assert.ok(
    accountA.email &&
      accountA.password &&
      accountB.email &&
      accountB.password,
    "Set all six TEST_* environment variables."
  );
}

function newClient() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(credentials) {
  const supabase = newClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  assert.ok(data.user?.id, "Sign-in did not return a user ID");

  return { supabase, userId: data.user.id };
}

async function getLevel(supabase) {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) throw error;
  assert.ok(data, "Could not determine MFA assurance level");

  return data;
}

async function readBio(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("bio")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data.bio;
}

async function attemptWrite(supabase, userId, bio) {
  return supabase
    .from("profiles")
    .update({ bio })
    .eq("id", userId);
}

async function writeAndVerify(supabase, userId, bio, description) {
  const { error } = await attemptWrite(supabase, userId, bio);
  if (error) throw error;

  assert.equal(
    await readBio(supabase, userId),
    bio,
    `${description}: the stored bio did not change`
  );

  pass(description);
}

async function promptForCode() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const code = (
      await rl.question("Enter Account A's current TOTP code: ")
    ).trim();

    assert.match(code, /^\d{6}$/, "Enter a six-digit TOTP code");
    return code;
  } finally {
    rl.close();
  }
}

async function verifyA(a) {
  const { data, error } = await a.supabase.auth.mfa.listFactors();
  if (error) throw error;

  const factor = data.totp.find((item) => item.status === "verified");
  assert.ok(factor, "Account A needs a verified TOTP factor");

  const code = await promptForCode();

  const result = await a.supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });

  if (result.error) throw result.error;

  assert.equal((await getLevel(a.supabase)).currentLevel, "aal2");
  pass("Account A reached AAL2");
}

async function main() {
  checkConfiguration();

  // Separate clients keep A's verified session distinct from its
  // fresh password-only session.
  const a = await signIn(accountA);
  const b = await signIn(accountB);

  const aBefore = await getLevel(a.supabase);
  const bLevel = await getLevel(b.supabase);

  assert.equal(aBefore.currentLevel, "aal1");
  assert.equal(aBefore.nextLevel, "aal2");
  assert.equal(bLevel.currentLevel, "aal1");
  assert.equal(bLevel.nextLevel, "aal1");

  await verifyA(a);

  const originalA = await readBio(a.supabase, a.userId);
  const originalB = await readBio(b.supabase, b.userId);

  // Sign in A again. This client stays at AAL1 even though A's
  // other client has completed MFA.
  const freshA = await signIn(accountA);
  assert.equal(freshA.userId, a.userId);

  const freshLevel = await getLevel(freshA.supabase);
  assert.equal(freshLevel.currentLevel, "aal1");
  assert.equal(freshLevel.nextLevel, "aal2");

  const blockedA = `blocked-aal1-${randomUUID()}`;
  const updatedB = `allowed-no-mfa-${randomUUID()}`;
  const updatedA = `allowed-aal2-${randomUUID()}`;
  const crossUser = `blocked-cross-user-${randomUUID()}`;

  try {
    // AAL1 may receive an error or an update affecting zero rows.
    // The stored value is the decisive check.
    await attemptWrite(freshA.supabase, a.userId, blockedA);

    assert.equal(
      await readBio(a.supabase, a.userId),
      originalA,
      "SECURITY FAILURE: A's AAL1 session changed A's bio"
    );
    pass("Account A at AAL1 cannot change its bio");

    await writeAndVerify(
      b.supabase,
      b.userId,
      updatedB,
      "Account B without MFA can change its bio"
    );

    await writeAndVerify(
      a.supabase,
      a.userId,
      updatedA,
      "Account A at AAL2 can change its bio"
    );

    // A is fully authenticated, but B is still a different user.
    await attemptWrite(a.supabase, b.userId, crossUser);

    assert.equal(
      await readBio(b.supabase, b.userId),
      updatedB,
      "SECURITY FAILURE: Account A changed Account B's bio"
    );
    pass("Account A cannot change Account B's bio");
  } finally {
    // Restore values even if an assertion in the test fails.
    await writeAndVerify(
      a.supabase,
      a.userId,
      originalA,
      "Account A's original bio was restored"
    );

    await writeAndVerify(
      b.supabase,
      b.userId,
      originalB,
      "Account B's original bio was restored"
    );
  }
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});