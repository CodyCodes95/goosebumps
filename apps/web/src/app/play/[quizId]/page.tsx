import { PlayerView } from "./_components/player-view";

// Anonymous route - no auth required
type PlayPageProps = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function PlayPage({ params }: PlayPageProps) {
  const { quizId } = await params;

  return <PlayerView quizId={quizId} />;
}
