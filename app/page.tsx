import { redirect } from "next/navigation";

export default function RootPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string };
}) {
  if (searchParams.code) {
    redirect(`/api/auth/callback?code=${searchParams.code}`);
  }
  redirect("/tarefas");
}
