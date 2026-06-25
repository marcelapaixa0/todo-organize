const strip = (s: string | undefined) => (s ?? "").replace(/^﻿/, "");

export const supabaseUrl = strip(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = strip(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
