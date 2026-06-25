// Strip BOM (U+FEFF) that sometimes appears when env vars are pasted in Vercel
const strip = (s: string | undefined): string => {
  const str = s ?? "";
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
};

export const getSupabaseConfig = () => ({
  url: strip(process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: strip(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
});
