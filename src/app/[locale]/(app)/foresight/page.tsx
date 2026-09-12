// CR01 2.1: the Foresight preview became Trends and Signals at /trends.
// This route stays only as a redirect so old links keep working.
import { redirect } from "next/navigation";

export default async function ForesightRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/trends`);
}
