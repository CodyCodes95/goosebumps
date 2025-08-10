// Anonymous route - no auth required
type PlayPageProps = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function PlayPage({ params }: PlayPageProps) {
  const { quizId } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Playing Quiz</h1>
        <p className="text-muted-foreground">Quiz ID: {quizId}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Player view will be implemented in Milestone 4+ */}
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Player view coming in Milestone 4+...
          </p>
        </div>
      </div>
    </div>
  );
}
