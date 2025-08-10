import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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

      <div className="flex flex-col gap-4">
        {/* Quiz list and create form will be implemented in Milestone 3 */}
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Quiz dashboard coming in Milestone 3...
          </p>
        </div>
      </div>
    </div>
  );
}
