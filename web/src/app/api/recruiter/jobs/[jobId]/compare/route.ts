import {
  COMPARISON_ERROR_STATUS,
  compareJobCandidates,
} from "@/lib/recruiter/candidate-comparison-service";

// Server only. Compares the applicants of one of the signed-in recruiter's postings
// against its saved requirements. Body (optional JSON): { limit?, includeOrganizations?, refresh? }.
export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;

  let options: unknown = {};
  const text = await request.text();
  if (text.trim() !== "") {
    try {
      options = JSON.parse(text);
    } catch {
      return Response.json(
        { success: false, code: "INVALID_INPUT", error: "Please send a valid JSON body." },
        { status: 400 },
      );
    }
  }

  const result = await compareJobCandidates(jobId, options);

  return Response.json(result, {
    status: result.success ? 200 : COMPARISON_ERROR_STATUS[result.code],
  });
}
