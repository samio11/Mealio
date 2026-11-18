import { redirect } from "next/navigation";

/** `/m/<messId>` always lands on the dashboard for that mess. */
export default async function MessIndexPage({ params }: { params: Promise<{ messId: string }> }) {
  const { messId } = await params;
  redirect(`/m/${messId}/dashboard`);
}
