import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  return (
    <div className="h-dvh flex flex-col max-w-2xl mx-auto overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
