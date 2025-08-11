"use client";

import { useQuery, useMutation } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import Loader, { LoaderContainer } from "./loader";
import {
  Copy,
  Play,
  Users,
  Clock,
  Settings,
  Ban,
  SkipForward,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import usePresence from "@convex-dev/presence/react";

type PresenterViewProps = {
  quizId: string;
};

export function PresenterView({ quizId }: PresenterViewProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isLockingAnswers, setIsLockingAnswers] = useState(false);
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false);

  // Get quiz details
  const quiz = useQuery(api.quizzes.getQuiz, {
    quizId: quizId as Id<"quizzes">,
  });

  // Get live quiz data (includes players)
  const liveData = useQuery(api.quizzes.getQuizLive, {
    joinCode: quiz?.joinCode || "",
  });

  // Get leaderboard for scoreboard phase
  const leaderboard = useQuery(api.quizzes.getLeaderboard, {
    quizId: quiz?._id as Id<"quizzes">,
  });

  // Presence heartbeat for presenter (host)
  // const roomId = quiz?._id as unknown as string | undefined;
  // const presenterName = useMemo(() => "Host", []);
  // const presenceState =
  //   usePresence(api.presence, roomId ?? "", presenterName) ?? [];

  // Mutations
  const startGame = useMutation(api.quizzes.startGame);
  const lockAnswers = useMutation(api.quizzes.lockAnswers);
  const advancePhase = useMutation(api.quizzes.advancePhase);
  const kickPlayer = useMutation(api.quizzes.kickPlayer);
  const endQuiz = useMutation(api.quizzes.endQuiz);
  const skipRound = useMutation(api.quizzes.skipRound);

  if (quiz === undefined || liveData === undefined) {
    return <LoaderContainer />;
  }

  if (!quiz) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Quiz not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { players = [] } = liveData || {};
  const nonHostPlayers = players.filter((p) => !p.isHost);

  const handleCopyJoinCode = async () => {
    await navigator.clipboard.writeText(quiz.joinCode);
    toast.success("Join code copied to clipboard!");
  };

  const handleCopyJoinLink = async () => {
    const joinUrl = `${window.location.origin}/join/${quiz.joinCode}`;
    await navigator.clipboard.writeText(joinUrl);
    toast.success("Join link copied to clipboard!");
  };

  const handleStartGame = async () => {
    if (nonHostPlayers.length === 0) {
      toast.error("At least one player must join before starting!");
      return;
    }

    setIsStarting(true);
    try {
      await startGame({ quizId: quiz._id });
      toast.success("Game started!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start game"
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleLockAnswers = async () => {
    if (!liveData?.currentRound) {
      toast.error("No active round to lock answers for!");
      return;
    }

    setIsLockingAnswers(true);
    try {
      await lockAnswers({
        quizId: quiz._id,
        roundId: liveData.currentRound._id,
      });
      toast.success("Answers locked!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to lock answers"
      );
    } finally {
      setIsLockingAnswers(false);
    }
  };

  const handleAdvancePhase = async () => {
    setIsAdvancingPhase(true);
    try {
      const result = await advancePhase({ quizId: quiz._id });

      if (result.nextPhase === "scoreboard") {
        toast.success("Showing scoreboard!");
      } else if (result.nextPhase === "prompting") {
        toast.success(`Starting Round ${(result.nextRound || 0) + 1}!`);
      } else if (result.nextPhase === "finished") {
        toast.success("Quiz completed!");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to advance phase"
      );
    } finally {
      setIsAdvancingPhase(false);
    }
  };

  const getPhaseDisplay = () => {
    switch (quiz.phase) {
      case "lobby":
        return {
          text: "Waiting for Players",
          color: "bg-blue-500",
          icon: Users,
        };
      case "prompting":
        return { text: "Getting Prompt", color: "bg-yellow-500", icon: Clock };
      case "generating":
        return {
          text: "Generating Questions",
          color: "bg-purple-500",
          icon: Settings,
        };
      case "answering":
        return {
          text: "Players Answering",
          color: "bg-green-500",
          icon: Clock,
        };
      case "reveal":
        return {
          text: "Revealing Answer",
          color: "bg-orange-500",
          icon: Settings,
        };
      case "scoreboard":
        return { text: "Scoreboard", color: "bg-indigo-500", icon: Users };
      case "finished":
        return { text: "Quiz Complete", color: "bg-gray-500", icon: Settings };
      default:
        return { text: quiz.phase, color: "bg-gray-500", icon: Settings };
    }
  };

  const phaseDisplay = getPhaseDisplay();
  const PhaseIcon = phaseDisplay.icon;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-top-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{quiz.name}</h1>
          <div className="flex items-center gap-2">
            <PhaseIcon className="w-4 h-4 transition-all duration-300" />
            <Badge
              className={`${phaseDisplay.color} text-white transition-all duration-300`}
            >
              {phaseDisplay.text}
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground">
          Round {quiz.currentRoundIndex + 1} of {quiz.config.totalRounds}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Join Code Card */}
        <Card
          className="lg:col-span-1 animate-in fade-in-0 slide-in-from-left-2"
          style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Join Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-mono font-bold tracking-wider text-primary mb-2">
                {quiz.joinCode}
              </div>
              <p className="text-sm text-muted-foreground">
                Players can use this code at:
              </p>
              <p className="text-sm font-medium">
                {window.location.origin}/join
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleCopyJoinCode}
                className="w-full transition-all duration-200 hover:scale-[1.02]"
              >
                Copy Code
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyJoinLink}
                className="w-full transition-all duration-200 hover:scale-[1.02]"
              >
                Copy Join Link
              </Button>
            </div>

            {/* Phase Controls */}
            {quiz.phase === "answering" && (
              <Button
                onClick={handleLockAnswers}
                disabled={isLockingAnswers}
                className="w-full"
              >
                {isLockingAnswers ? (
                  <>
                    <Loader className="w-4 h-4 mr-2" />
                    Locking...
                  </>
                ) : (
                  "Lock Answers Early"
                )}
              </Button>
            )}

            {(quiz.phase === "reveal" || quiz.phase === "scoreboard") && (
              <Button
                onClick={handleAdvancePhase}
                disabled={isAdvancingPhase}
                className="w-full"
              >
                {isAdvancingPhase ? (
                  <>
                    <Loader className="w-4 h-4 mr-2" />
                    Advancing...
                  </>
                ) : quiz.phase === "reveal" ? (
                  "Show Scoreboard"
                ) : quiz.currentRoundIndex + 1 < quiz.config.totalRounds ? (
                  `Start Round ${quiz.currentRoundIndex + 2}`
                ) : (
                  "Finish Quiz"
                )}
              </Button>
            )}

            {/* Presenter extra controls */}
            {quiz.phase !== "finished" && (
              <div className="flex flex-col gap-2">
                {(quiz.phase === "prompting" ||
                  quiz.phase === "generating" ||
                  quiz.phase === "answering") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      try {
                        await skipRound({ quizId: quiz._id });
                        toast.success("Round skipped. Moving to reveal.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Failed to skip round"
                        );
                      }
                    }}
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip Current Round
                  </Button>
                )}

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await endQuiz({ quizId: quiz._id });
                      toast.success("Quiz ended");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to end quiz"
                      );
                    }
                  }}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  End Quiz
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players Card */}
        <Card
          className="lg:col-span-2 animate-in fade-in-0 slide-in-from-right-2"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Players ({nonHostPlayers.length})
              </div>
              {quiz.phase === "lobby" && (
                <Button
                  onClick={handleStartGame}
                  disabled={nonHostPlayers.length === 0 || isStarting}
                  size="sm"
                  className="transition-all duration-200 hover:scale-[1.05]"
                >
                  {isStarting ? (
                    <>
                      <Loader className="w-4 h-4 mr-2" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Game
                    </>
                  )}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nonHostPlayers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No players have joined yet.</p>
                <p className="text-sm">
                  Share the join code above to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {nonHostPlayers.map((player, index) => (
                  <div
                    key={player._id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-card animate-in fade-in-0 slide-in-from-bottom-2"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {player.name}
                      </p>
                      {quiz.phase !== "lobby" && (
                        <p className="text-xs text-muted-foreground">
                          Score: {player.score}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await kickPlayer({
                            quizId: quiz._id,
                            playerId: player._id,
                          });
                          toast.success(`Kicked ${player.name}`);
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to kick player"
                          );
                        }
                      }}
                      className="ml-auto"
                    >
                      <Ban className="w-3 h-3 mr-1" /> Kick
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quiz Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {quiz.config.totalRounds}
              </div>
              <p className="text-sm text-muted-foreground">Total Rounds</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {quiz.config.secondsPerQuestion}s
              </div>
              <p className="text-sm text-muted-foreground">Answer Time</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {quiz.config.secondsForPrompt}s
              </div>
              <p className="text-sm text-muted-foreground">Prompt Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {quiz.phase === "lobby" && nonHostPlayers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <h3 className="font-medium mb-2">Ready to start?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Players can join by going to{" "}
              <strong>{window.location.origin}/join</strong> and entering the
              code <strong>{quiz.joinCode}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              At least one player must join before you can start the game.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
