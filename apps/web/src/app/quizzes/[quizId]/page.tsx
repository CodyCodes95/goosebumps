import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Quiz Details</h1>
        <p className="text-muted-foreground">Quiz ID: {quizId}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Quiz detail view and editing will be implemented in Milestone 3 */}
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Quiz detail and editing coming in Milestone 3...
          </p>
        </div>
      </div>
    </div>
  );
}
