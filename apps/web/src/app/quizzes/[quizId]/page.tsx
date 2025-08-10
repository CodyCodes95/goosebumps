import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import QuizDetail from "@/components/quiz-detail";
import type { Id } from "../../../../../packages/backend/convex/_generated/dataModel";

type QuizDetailPageProps = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizDetailPage({ params }: QuizDetailPageProps) {
  // Page-level auth guard for author routes
  const { userId } = await auth();

  if (!userId) {
    redirect("/signin");
  }

  const { quizId } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <QuizDetail quizId={quizId as Id<"quizzes">} />
    </div>
  );
}
