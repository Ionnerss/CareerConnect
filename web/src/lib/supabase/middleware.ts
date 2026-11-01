import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/upload-resume",
  "/jobs",
  "/profile",
  "/recruiter",
  "/application-status",
];

function isProtectedPath(pathname: string): boolean {
  return protectedRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );
}

/**
 * Exception for the audited resume Server Actions.
 *
 * All seven resume actions must call requireMfaForAction()
 * before accessing the database or Storage.
 *
 * This is request classification, NOT authorization.
 * Never use the Next-Action header as proof of identity.
 */
function isAuditedResumeServerAction(
  request: NextRequest
): boolean {
  return (
    request.method === "POST" &&
    request.nextUrl.pathname === "/upload-resume" &&
    request.headers.has("next-action")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  // Validate/refresh the session before applying route logic.
  const { data, error } = await supabase.auth.getClaims();

  function withSessionCookies(response: NextResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    response.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return response;
  }

  // Resume Server Actions are independently protected by
  // requireMfaForAction() and Supabase RLS.
  //
  // Do not redirect their POST requests from Proxy:
  // a 307 changes the expected Server Action response flow.
  if (isAuditedResumeServerAction(request)) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return supabaseResponse;
  }

  // Public routes remain accessible.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return supabaseResponse;
  }

  // Protected page requests require authentication.
  if (error || !data?.claims?.sub) {
    const url = request.nextUrl.clone();

    url.pathname = "/auth/login";
    url.search = "";

    return withSessionCookies(
      NextResponse.redirect(url)
    );
  }

  // Protected page requests also require completed MFA
  // when the user has enrolled an authenticator.
  let assurance;

  try {
    assurance =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  } catch {
    return withSessionCookies(
      NextResponse.json(
        {
          error: "Unable to verify authentication level.",
        },
        { status: 503 }
      )
    );
  }

  if (assurance.error || !assurance.data) {
    return withSessionCookies(
      NextResponse.json(
        {
          error: "Unable to verify authentication level.",
        },
        { status: 503 }
      )
    );
  }

  const { currentLevel, nextLevel } = assurance.data;

  // No MFA enrolled.
  if (
    currentLevel === "aal1" &&
    nextLevel === "aal1"
  ) {
    return supabaseResponse;
  }

  // MFA already completed.
  if (
    currentLevel === "aal2" &&
    nextLevel === "aal2"
  ) {
    return supabaseResponse;
  }

  // Enrolled MFA has not yet been completed.
  if (
    currentLevel === "aal1" &&
    nextLevel === "aal2"
  ) {
    const url = request.nextUrl.clone();

    url.pathname = "/auth/mfa";
    url.search = "";

    return withSessionCookies(
      NextResponse.redirect(url)
    );
  }

  // Unrecognized or stale authentication state.
  return withSessionCookies(
    NextResponse.json(
      {
        error: "Your authentication session is invalid.",
      },
      { status: 403 }
    )
  );
}
