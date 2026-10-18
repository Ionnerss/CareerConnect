import {
  COMPARISON_ERROR_STATUS,
  getJobRequirements,
  saveJobRequirements,
} from "@/lib/recruiter/candidate-comparison-service";

type Context = { params: Promise<{ jobId: string }> };

// The requirements the signed-in recruiter has saved on one of their postings.
export async function GET(_request: Request, context: Context) {
  const { jobId } = await context.params;
  const result = await getJobRequirements(jobId);

  return Response.json(result, {
    status: result.success ? 200 : COMPARISON_ERROR_STATUS[result.code],
  });
}

// Replaces the posting's requirements. Body: { requirements: [{ text, kind?, weight? }] }.
export async function PUT(request: Request, context: Context) {
  const { jobId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, code: "INVALID_INPUT", error: "Please send a valid JSON body." },
      { status: 400 },
    );
  }

  const requirements =
    typeof body === "object" && body !== null && "requirements" in body
      ? (body as { requirements: unknown }).requirements
      : undefined;

  const result = await saveJobRequirements(jobId, requirements);

  return Response.json(result, {
    status: result.success ? 200 : COMPARISON_ERROR_STATUS[result.code],
  });
}
