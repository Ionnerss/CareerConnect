
import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const MODE = process.argv[2];

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

const RESUME_A = "11111111-1111-4111-8111-111111111111";
const RESUME_B = "22222222-2222-4222-8222-222222222222";

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

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;

  return supabase;
}

async function visibleResumes(supabase) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id")
    .in("id", [RESUME_A, RESUME_B]);

  if (error) throw error;

  return data.map((row) => row.id).sort();
}

function expectVisible(actual, expected, description) {
  assert.deepEqual(actual, [...expected].sort(), description);
  console.log(`PASS: ${description}`);
}

async function askCode() {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    return (
      await rl.question("Enter User A's current authenticator code: ")
    ).trim();
  } finally {
    rl.close();
  }
}

async function getAal(supabase) {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    throw error ?? new Error("Unable to determine AAL.");
  }

  return data;
}

async function run() {
  if (!URL || !KEY || !USER_A.email || !USER_A.password ||
      !USER_B.email || !USER_B.password) {
    throw new Error("Missing test environment variables.");
  }

  if (!["baseline", "enroll", "enforced"].includes(MODE)) {
    throw new Error(
      "Usage: node test-resume-rls.mjs baseline|enroll|enforced"
    );
  }

  if (MODE === "baseline") {
    const a = await signIn(USER_A);
    const b = await signIn(USER_B);

    expectVisible(
      await visibleResumes(a),
      [RESUME_A],
      "User A can only see their resume"
    );

    expectVisible(
      await visibleResumes(b),
      [RESUME_B],
      "User B can only see their resume"
    );

    return;
  }

  if (MODE === "enroll") {
    const a = await signIn(USER_A);

    const { data: existing, error: listError } =
      await a.auth.mfa.listFactors();

    if (listError) throw listError;

    if (existing.totp.some((factor) => factor.status === "verified")) {
      console.log("User A already has verified TOTP MFA.");
      return;
    }

    const { data, error } = await a.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "RLS Test Authenticator",
    });

    if (error || !data?.totp?.secret) {
      throw error ?? new Error("Enrollment data unavailable.");
    }

    // For a disposable test account only.
    console.log("Enter this key into your authenticator app:");

    const code = await askCode();

    assert.match(code, /^\d{6}$/, "Enter a six-digit code.");

    const result = await a.auth.mfa.challengeAndVerify({
      factorId: data.id,
      code,
    });

    if (result.error) throw result.error;

    assert.equal((await getAal(a)).currentLevel, "aal2");
    console.log("PASS: User A's TOTP MFA is verified.");

    return;
  }

  if (MODE === "enforced") {
    const a = await signIn(USER_A);
    const b = await signIn(USER_B);

    const aLevel = await getAal(a);
    const bLevel = await getAal(b);

    assert.equal(aLevel.currentLevel, "aal1");
    assert.equal(aLevel.nextLevel, "aal2");

    assert.equal(bLevel.currentLevel, "aal1");
    assert.equal(bLevel.nextLevel, "aal1");

    expectVisible(
      await visibleResumes(a),
      [],
      "User A at AAL1 cannot read protected resumes"
    );

    expectVisible(
      await visibleResumes(b),
      [RESUME_B],
      "User B without MFA keeps existing access"
    );

    const { data: factors, error: factorsError } =
      await a.auth.mfa.listFactors();

    if (factorsError) throw factorsError;

    const factor = factors.totp.find(
      (item) => item.status === "verified"
    );

    assert.ok(factor, "User A needs a verified TOTP factor.");

    const code = await askCode();

    assert.match(code, /^\d{6}$/, "Enter a six-digit code.");

    const { error: verifyError } =
      await a.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });

    if (verifyError) throw verifyError;

    assert.equal((await getAal(a)).currentLevel, "aal2");

    expectVisible(
      await visibleResumes(a),
      [RESUME_A],
      "User A at AAL2 can read their resume, but not User B's"
    );
  }
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
