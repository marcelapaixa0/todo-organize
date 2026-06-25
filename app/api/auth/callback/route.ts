import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  console.log("[callback] origin:", origin, "| code present:", !!code);

  if (code) {
    const response = NextResponse.redirect(`${origin}/tarefas`);

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[callback] exchangeCodeForSession error:", error?.message ?? "none");
    if (!error) return response;
    return NextResponse.redirect(`${origin}/entrar?error=${encodeURIComponent(error.message)}`);
  }

  console.log("[callback] no code — redirecting to /entrar");
  return NextResponse.redirect(`${origin}/entrar`);
}
