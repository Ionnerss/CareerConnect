import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const users = {
  A: {
    email: process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_USER_A_PASSWORD,
  },
  B: {
    email: process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_USER_B_PASSWORD,
  },
};

if (!url || !key || Object.values(users).some((user) => !user.email || !user.password)) {
  console.error("FAIL: Set all six TEST_* environment variables.");
  process.exit(1);
}

if (!new URL(url).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
  console.error("FAIL: This setup script only accepts a local Supabase URL.");
  process.exit(1);
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

async function createAndSignIn(label, credentials) {
  const supabase = newClient();

  const signup = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        full_name: `Local MFA Test ${label}`,
        account_type: "job_seeker",
      },
    },
  });

  if (signup.error) {
    throw new Error(`Account ${label} signup: ${signup.error.message}`);
  }

  const signin = await supabase.auth.signInWithPassword(credentials);

  if (signin.error || !signin.data.user) {
    throw new Error(
      `Account ${label} sign-in: ${signin.error?.message ?? "No user returned"}`
    );
  }

  const profile = await supabase
    .from("profiles")
    .select("id, bio")
    .eq("id", signin.data.user.id)
    .single();

  if (profile.error) {
    throw new Error(`Account ${label} profile: ${profile.error.message}`);
  }

  assert.equal(profile.data.id, signin.data.user.id);

  console.log(`PASS: Account ${label} exists and can read its local profile`);
  return supabase;
}

async function main() {
  const a = await createAndSignIn("A", users.A);
  const b = await createAndSignIn("B", users.B);

  const bLevel = await b.auth.mfa.getAuthenticatorAssuranceLevel();
  if (bLevel.error) throw bLevel.error;
  assert.equal(bLevel.data.currentLevel, "aal1");
  assert.equal(bLevel.data.nextLevel, "aal1");
  console.log("PASS: Account B has no MFA factor");

  const listed = await a.auth.mfa.listFactors();
  if (listed.error) throw listed.error;

  if (listed.data.totp.some((factor) => factor.status === "verified")) {
    console.log("PASS: Account A already has verified TOTP");
    return;
  }

  const enrollment = await a.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Local profile MFA test",
  });

  if (enrollment.error || !enrollment.data?.totp?.secret) {
    throw enrollment.error ?? new Error("TOTP enrollment secret was not returned");
  }

  console.log("\nAdd this secret to your authenticator app:");
  console.log(enrollment.data.totp.secret);
  console.log("Keep it private. Do not paste it into chat, commits, or logs.\n");

  const rl = createInterface({ input: stdin, output: stdout });
  let code;
  try {
    code = (await rl.question("Enter Account A's current six-digit code: ")).trim();
  } finally {
    rl.close();
  }

  assert.match(code, /^\d{6}$/, "Expected a six-digit authenticator code");

  const verification = await a.auth.mfa.challengeAndVerify({
    factorId: enrollment.data.id,
    code,
  });

  if (verification.error) throw verification.error;

  const aLevel = await a.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aLevel.error) throw aLevel.error;
  assert.equal(aLevel.data.currentLevel, "aal2");

  console.log("PASS: Account A has verified TOTP and reached AAL2");
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});