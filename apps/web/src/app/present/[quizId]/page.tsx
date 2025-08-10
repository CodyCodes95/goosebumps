import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PresenterView } from "../../../components/presenter-view";

type PresentPageProps = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function PresentPage({ params }: PresentPageProps) {
  // Page-level auth guard for author routes
  const { userId } = await auth();

  if (!userId) {
    redirect("/signin");
  }

  const { quizId } = await params;

  return <PresenterView quizId={quizId} />;
}
