import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Present Quiz</h1>
        <p className="text-muted-foreground">Quiz ID: {quizId}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Presenter view will be implemented in Milestone 4 */}
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Presenter view coming in Milestone 4...
          </p>
        </div>
      </div>
    </div>
  );
}
