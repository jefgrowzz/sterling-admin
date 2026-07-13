import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PROTECTED_PREFIX = "/dashboard";
const LOGIN_PATH = "/";

function isAuthApiError(error: unknown): boolean {
  return !!error && typeof error === "object" && "__isAuthError" in error;
}

// Optimistic auth check for proxy.ts: only reads/refreshes the session
// cookie, no database round-trip. The real account_role check happens in
// app/dashboard/lib/dal.ts, close to the data it protects.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() throws (rather than returning a null user) when the refresh
  // token cookie is stale/revoked, e.g. after a password reset or a
  // long-idle session. Treat that the same as "not signed in".
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (error) {
    if (!isAuthApiError(error)) throw error;
  }

  const isProtected = request.nextUrl.pathname.startsWith(PROTECTED_PREFIX);
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  if (isProtected && !user) {
    const redirect = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    response.cookies.getAll()
      .filter(({ name }) => name.startsWith("sb-"))
      .forEach(({ name }) => redirect.cookies.delete(name));
    return redirect;
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL(PROTECTED_PREFIX, request.url));
  }

  return response;
}
