import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import QuizDashboard from "@/components/quiz-dashboard";

export default async function QuizzesPage() {
  // Page-level auth guard for author routes
  const { userId } = await auth();

  if (!userId) {
    redirect("/signin");
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">My Quizzes</h1>
        <p className="text-muted-foreground">
          Create and manage your interactive quiz experiences
        </p>
      </div>

      <QuizDashboard />
    </div>
  );
}
