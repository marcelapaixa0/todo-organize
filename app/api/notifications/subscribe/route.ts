import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient as createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const { endpoint, p256dh, auth } = await req.json();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const serviceSupabase = createServiceClient();
  const { error } = await serviceSupabase.from("push_subscriptions").upsert(
    { profile_id: profile.id, endpoint, p256dh, auth },
    { onConflict: "profile_id,endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
