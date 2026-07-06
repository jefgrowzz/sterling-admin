import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PROTECTED_PREFIX = "/dashboard";
const LOGIN_PATH = "/";

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

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = request.nextUrl.pathname.startsWith(PROTECTED_PREFIX);
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  if (isProtected && !user) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL(PROTECTED_PREFIX, request.url));
  }

  return response;
}
