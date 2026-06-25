import { redirect } from "next/navigation";

type SearchParams = { [key: string]: string | string[] | undefined };

export default function RootPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const code = typeof searchParams.code === "string" ? searchParams.code : undefined;
  if (code) {
    redirect(`/api/auth/callback?code=${code}`);
  }
  redirect("/tarefas");
}
