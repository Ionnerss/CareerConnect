import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

const COVER_LETTERS = "cover_letters";
const PROJECT_IMAGES = "project-images";

assert.equal(
  URL,
  "http://127.0.0.1:54321",
  "Point TEST_SUPABASE_URL to local Supabase."
);

assert.ok(
  KEY?.startsWith("sb_publishable_"),
  "Set TEST_SUPABASE_PUBLISHABLE_KEY to the local publishable key."
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

function checked(result, step) {
  if (result.error) {
    throw new Error(`${step}: ${result.error.message}`);
  }

  return result.data;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function createAccount(label, email, accountType) {
  const supabase = client();
  const password = randomUUID();

  const data = checked(
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `Local MFA audit ${label}`,
          account_type: accountType,
        },
      },
    }),
    `${label} signup`
  );

  assert.ok(
    data?.user && data?.session,
    `${label} needs a confirmed local session.`
  );

  const profile = checked(
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single(),
    `${label} profile`
  );

  assert.equal(
    profile.role,
    accountType === "recruiter" ? "recruiter" : "job_seeker",
    `${label} has an unexpected role.`
  );

  return {
    supabase,
    id: data.user.id,
    email,
    password,
  };
}

async function rpc(supabase, applicantId, step) {
  const value = checked(
    await supabase.rpc("recruiter_can_view_profile", {
      profile_id: applicantId,
    }),
    step
  );

  assert.equal(typeof value, "boolean", `${step}: expected a boolean.`);
  return value;
}

async function assurance(supabase, step) {
  return checked(
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    step
  );
}

function makePdf(marker) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\nendstream",
  ];

  let document = `%PDF-1.4\n% ${marker}\n`;
  const offsets = [];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(document));
    document += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(document);

  document += `xref\n0 ${objects.length + 1}\n`;
  document += "0000000000 65535 f \n";

  for (const offset of offsets) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  document +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(document, "ascii");
}

function makePng() {
  // Valid 1×1 PNG with no personal data.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
    "AAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
    "base64"
  );
}

async function assertCanReadFile(
  supabase,
  bucket,
  path,
  expected,
  label
) {
  const download = checked(
    await supabase.storage.from(bucket).download(path),
    `${label}: direct download`
  );

  assert.ok(download, `${label}: download returned no file.`);

  assert.deepEqual(
    Buffer.from(await download.arrayBuffer()),
    expected,
    `${label}: downloaded bytes differ.`
  );

  const signed = checked(
    await supabase.storage.from(bucket).createSignedUrl(path, 60),
    `${label}: signed URL creation`
  );

  assert.ok(signed?.signedUrl, `${label}: no signed URL returned.`);

  // Keep the signed URL in memory; never print it.
  const response = await fetch(signed.signedUrl, {
    cache: "no-store",
  });

  assert.equal(
    response.status,
    200,
    `${label}: signed download returned HTTP ${response.status}.`
  );

  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    expected,
    `${label}: signed download bytes differ.`
  );
}

async function assertCannotReadFile(supabase, bucket, path, label) {
  const download = await supabase.storage
    .from(bucket)
    .download(path);

  assert.ok(
    download.error || !download.data,
    `SECURITY FAILURE: ${label} downloaded the file.`
  );

  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  assert.ok(
    signed.error || !signed.data?.signedUrl,
    `SECURITY FAILURE: ${label} received a new signed URL.`
  );
}

async function main() {
  const run = randomUUID();

  const recruiter = await createAccount(
    "owning recruiter",
    `mfa-rpc-owner-${run}@concordia.ca`,
    "recruiter"
  );

  const applicant = await createAccount(
    "applicant",
    `mfa-rpc-applicant-${run}@example.com`,
    "job_seeker"
  );

  const unrelated = await createAccount(
    "unrelated recruiter",
    `mfa-rpc-unrelated-${run}@concordia.ca`,
    "recruiter"
  );

  pass("Disposable local accounts have the expected roles");

  const job = checked(
    await recruiter.supabase
      .from("job")
      .insert({
        recruiter_id: recruiter.id,
        title: "Local MFA RPC audit fixture",
        description: "Disposable local authorization test",
        firm_name: "Local Test",
        location: "Montreal, QC",
        status: "open",
      })
      .select("id")
      .single(),
    "Create recruiter job"
  );

  // Metadata-only resume fixture for the application submission rule.
  const resume = checked(
    await applicant.supabase
      .from("resumes")
      .insert({
        user_id: applicant.id,
        file_path: `${applicant.id}/${run}-resume-fixture.pdf`,
        file_name: "resume-fixture.pdf",
      })
      .select("id")
      .single(),
    "Create applicant resume record"
  );

  const application = checked(
    await applicant.supabase
      .from("applications")
      .insert({
        job_id: job.id,
        applicant_id: applicant.id,
        resume_id: resume.id,
      })
      .select("id")
      .single(),
    "Create application"
  );

  pass("Applicant applied to the owning recruiter's job");

  // Attach a real cover-letter PDF using the production path shape.
  const pdf = makePdf(run);
  const coverLetterPath =
    `${applicant.id}/${application.id}/${randomUUID()}.pdf`;

  checked(
    await applicant.supabase.storage
      .from(COVER_LETTERS)
      .upload(coverLetterPath, pdf, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      }),
    "Upload applicant cover letter"
  );

  const attached = checked(
    await applicant.supabase
      .from("applications")
      .update({ cover_letter_path: coverLetterPath })
      .eq("id", application.id)
      .eq("applicant_id", applicant.id)
      .is("cover_letter_path", null)
      .select("cover_letter_path")
      .single(),
    "Attach cover letter to application"
  );

  assert.equal(attached.cover_letter_path, coverLetterPath);
  pass("Applicant uploaded and attached a real cover-letter PDF");

  // Create the applicant's project and upload a real PNG.
  const project = checked(
    await applicant.supabase
      .from("profile_projects")
      .insert({
        profile_id: applicant.id,
        name: `Local MFA audit ${run.slice(0, 8)}`,
        short_description: "Disposable project-image access fixture",
      })
      .select("id")
      .single(),
    "Create applicant project"
  );

  const png = makePng();
  const imagePath =
    `${applicant.id}/${project.id}/${randomUUID()}.png`;

  checked(
    await applicant.supabase.storage
      .from(PROJECT_IMAGES)
      .upload(imagePath, png, {
        contentType: "image/png",
        cacheControl: "0",
        upsert: false,
      }),
    "Upload applicant project image"
  );

  const image = checked(
    await applicant.supabase
      .from("profile_project_images")
      .insert({
        project_id: project.id,
        storage_path: imagePath,
        alt_text: "Disposable MFA audit image",
      })
      .select("id, storage_path")
      .single(),
    "Save applicant project-image record"
  );

  assert.equal(image.storage_path, imagePath);
  pass("Applicant uploaded and recorded a real project PNG");

  assert.equal(
    await rpc(
      recruiter.supabase,
      applicant.id,
      "Owner before MFA enrollment"
    ),
    true
  );

  assert.equal(
    await rpc(
      unrelated.supabase,
      applicant.id,
      "Unrelated recruiter before MFA enrollment"
    ),
    false
  );

  pass("RPC preserves job ownership before MFA enrollment");

  for (const file of [
    {
      bucket: COVER_LETTERS,
      path: coverLetterPath,
      bytes: pdf,
      name: "cover letter",
    },
    {
      bucket: PROJECT_IMAGES,
      path: imagePath,
      bytes: png,
      name: "project image",
    },
  ]) {
    await assertCanReadFile(
      applicant.supabase,
      file.bucket,
      file.path,
      file.bytes,
      `Applicant without MFA: ${file.name}`
    );

    await assertCanReadFile(
      recruiter.supabase,
      file.bucket,
      file.path,
      file.bytes,
      `Owning recruiter before MFA: ${file.name}`
    );

    await assertCannotReadFile(
      unrelated.supabase,
      file.bucket,
      file.path,
      `Unrelated recruiter: ${file.name}`
    );
  }

  pass("Direct private-file access preserves applicant and recruiter ownership");

  const factor = checked(
    await recruiter.supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Local RPC audit ${run.slice(0, 8)}`,
    }),
    "Enroll owning recruiter MFA"
  );

  assert.ok(factor?.id && factor.totp?.secret);

  console.log(
    "\nAdd this LOCAL disposable factor to your authenticator:"
  );
  console.log(factor.totp.secret);
  console.log("Do not share its seed or code.\n");

  const rl = createInterface({ input: stdin, output: stdout });
  let code;

  try {
    code = (
      await rl.question("Enter its current six-digit code: ")
    ).trim();
  } finally {
    rl.close();
  }

  assert.match(code, /^\d{6}$/, "Enter a six-digit TOTP code.");

  checked(
    await recruiter.supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    }),
    "Verify recruiter MFA"
  );

  assert.equal(
    (await assurance(recruiter.supabase, "AAL2 assurance")).currentLevel,
    "aal2"
  );

  pass("Owning recruiter reached AAL2");

  const passwordOnly = client();

  checked(
    await passwordOnly.auth.signInWithPassword({
      email: recruiter.email,
      password: recruiter.password,
    }),
    "Fresh recruiter password-only sign-in"
  );

  assert.equal(
    (
      await assurance(
        passwordOnly,
        "Fresh recruiter session assurance"
      )
    ).currentLevel,
    "aal1"
  );

  assert.equal(
    await rpc(passwordOnly, applicant.id, "Owner at AAL1"),
    false,
    "SECURITY FAILURE: AAL1 recruiter inferred the applicant relationship."
  );

  for (const file of [
    { bucket: COVER_LETTERS, path: coverLetterPath, name: "cover letter" },
    { bucket: PROJECT_IMAGES, path: imagePath, name: "project image" },
  ]) {
    await assertCannotReadFile(
      passwordOnly,
      file.bucket,
      file.path,
      `Owning recruiter at AAL1: ${file.name}`
    );
  }

  pass("Fresh recruiter AAL1 cannot use RPC or access either private file");

  assert.equal(
    await rpc(recruiter.supabase, applicant.id, "Owner at AAL2"),
    true,
    "AAL2 recruiter lost access to their applicant."
  );

  await assertCanReadFile(
    recruiter.supabase,
    COVER_LETTERS,
    coverLetterPath,
    pdf,
    "Owning recruiter at AAL2: cover letter"
  );

  await assertCanReadFile(
    recruiter.supabase,
    PROJECT_IMAGES,
    imagePath,
    png,
    "Owning recruiter at AAL2: project image"
  );

  pass("Recruiter AAL2 restores RPC and both private files");

  assert.equal(
    await rpc(
      unrelated.supabase,
      applicant.id,
      "Unrelated recruiter after MFA enrollment"
    ),
    false
  );

  await assertCannotReadFile(
    unrelated.supabase,
    COVER_LETTERS,
    coverLetterPath,
    "Unrelated recruiter: cover letter"
  );

  await assertCannotReadFile(
    unrelated.supabase,
    PROJECT_IMAGES,
    imagePath,
    "Unrelated recruiter: project image"
  );

  pass("Unrelated recruiter remains denied for both private files");

  console.log(
    "DONE: Local RPC, cover-letter, and project-image tests passed."
  );
  console.log(
    "Disposable accounts and fixture data remain in local Supabase."
  );
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});