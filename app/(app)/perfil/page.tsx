import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilClient from "./perfil-client";

export default async function PerfilPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  let familyGroup = null;
  let members: any[] = [];
  let categories: any[] = [];

  if (profile?.family_group_id) {
    const [groupRes, membersRes, categoriesRes] = await Promise.all([
      supabase.from("family_groups").select("*").eq("id", profile.family_group_id).single(),
      supabase.from("profiles").select("*").eq("family_group_id", profile.family_group_id),
      supabase.from("categories").select("*").eq("family_group_id", profile.family_group_id).order("name"),
    ]);
    familyGroup = groupRes.data;
    members = membersRes.data ?? [];
    categories = categoriesRes.data ?? [];
  }

  return (
    <PerfilClient
      profile={profile}
      familyGroup={familyGroup}
      members={members}
      categories={categories}
    />
  );
}
