import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // This exact endpoint authenticates its server-to-server request
  // using RECOMMENDATION_WORKER_SECRET in its route handler.
  if (
    request.nextUrl.pathname ===
    "/api/internal/recommendations/refresh"
  ) {
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};