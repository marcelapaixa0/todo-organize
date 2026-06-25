import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });
}
