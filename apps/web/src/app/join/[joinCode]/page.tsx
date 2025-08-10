import { JoinWithCodeForm } from "../../../components/join-with-code-form";

// Anonymous route - no auth required for players
type JoinCodePageProps = {
  params: Promise<{
    joinCode: string;
  }>;
};

export default async function JoinCodePage({ params }: JoinCodePageProps) {
  const { joinCode } = await params;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-md mx-auto">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold">Join Quiz</h1>
        <p className="text-muted-foreground">
          Quiz Code: <span className="font-mono font-bold">{joinCode}</span>
        </p>
      </div>

      <JoinWithCodeForm joinCode={joinCode} />
    </div>
  );
}
