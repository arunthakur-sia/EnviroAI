// CR01 5.1: the lessons capture became the universal Add Knowledge entry point.
import { redirect } from "next/navigation";

export default async function LessonsNewRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/add`);
}
