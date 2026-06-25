import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    console.error("[middleware] Supabase env vars missing");
    return supabaseResponse;
  }

  let user = null;
  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("[middleware] Supabase error:", err);
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/entrar");
  const isApiRoute = pathname.startsWith("/api");

  if (isApiRoute) return supabaseResponse;
  if (!user && !isAuthRoute) return NextResponse.redirect(new URL("/entrar", request.url));
  if (user && isAuthRoute) return NextResponse.redirect(new URL("/tarefas", request.url));

  return supabaseResponse;
}
