"use client";

import { useQuery } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import Loader from "./loader";
import { Users, Clock, Play, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type PlayerViewProps = {
  quizId: string;
};

// Get device fingerprint (must match the one used in join)
function getDeviceFingerprint(): string {
  return localStorage.getItem("goosebumps-device-id") || "";
}

export function PlayerView({ quizId }: PlayerViewProps) {
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");

  // Set device fingerprint on client side
  useEffect(() => {
    setDeviceFingerprint(getDeviceFingerprint());
  }, []);

  // Get public quiz data by ID first to get the join code
  const quiz = useQuery(api.quizzes.getQuizPublic, {
    quizId: quizId as Id<"quizzes">,
  });

  // Get live quiz data with players
  const liveData = useQuery(api.quizzes.getQuizLive, {
    joinCode: quiz?.joinCode || "",
  });

  if (quiz === undefined || liveData === undefined || !deviceFingerprint) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader />
        </div>
      </div>
    );
  }

  if (!quiz || !liveData?.quiz) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="font-medium mb-2">Quiz Not Found</h3>
            <p className="text-sm text-muted-foreground">
              This quiz doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { players = [] } = liveData;
  const myPlayer = players.find(
    (p) => p.deviceFingerprint === deviceFingerprint && !p.isHost
  );

  if (!myPlayer) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-4">🚫</div>
            <h3 className="font-medium mb-2">Not Joined</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't joined this quiz yet.
            </p>
            <a
              href={`/join/${quiz.joinCode}`}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Join Quiz
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nonHostPlayers = players.filter((p) => !p.isHost);

  const getPhaseDisplay = () => {
    switch (quiz.phase) {
      case "lobby":
        return {
          text: "Waiting to Start",
          color: "bg-blue-500",
          icon: Users,
          description: "Waiting for the host to start the quiz...",
        };
      case "prompting":
        return {
          text: "Getting Prompt",
          color: "bg-yellow-500",
          icon: Clock,
          description: "Someone is writing a question...",
        };
      case "generating":
        return {
          text: "Generating Questions",
          color: "bg-purple-500",
          icon: Zap,
          description: "AI is creating answer choices...",
        };
      case "answering":
        return {
          text: "Answer Time!",
          color: "bg-green-500",
          icon: Play,
          description: "Choose your answer quickly!",
        };
      case "reveal":
        return {
          text: "Revealing Answer",
          color: "bg-orange-500",
          icon: Clock,
          description: "Let's see the correct answer...",
        };
      case "scoreboard":
        return {
          text: "Scoreboard",
          color: "bg-indigo-500",
          icon: Users,
          description: "How did everyone do?",
        };
      case "finished":
        return {
          text: "Quiz Complete",
          color: "bg-gray-500",
          icon: Users,
          description: "Thanks for playing!",
        };
      default:
        return {
          text: quiz.phase,
          color: "bg-gray-500",
          icon: Clock,
          description: "",
        };
    }
  };

  const phaseDisplay = getPhaseDisplay();
  const PhaseIcon = phaseDisplay.icon;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-top-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Welcome, {myPlayer.name}!</h1>
          <div className="flex items-center gap-2">
            <PhaseIcon className="w-4 h-4" />
            <Badge
              className={`${phaseDisplay.color} text-white transition-all duration-300`}
            >
              {phaseDisplay.text}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Round {quiz.currentRoundIndex + 1} of {quiz.config.totalRounds}
        </p>
      </div>

      {/* Main Phase Content */}
      <Card
        className="animate-in fade-in-0 slide-in-from-bottom-2"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <CardHeader>
          <CardTitle className="text-center">{phaseDisplay.text}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <PhaseIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground transition-all duration-500" />
          <p className="text-muted-foreground mb-4">
            {phaseDisplay.description}
          </p>

          {quiz.phase === "lobby" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {nonHostPlayers.length}{" "}
                {nonHostPlayers.length === 1 ? "player" : "players"} in lobby
              </p>
              {nonHostPlayers.length < 2 && (
                <p className="text-xs text-muted-foreground">
                  Waiting for more players to join...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Stats */}
      {quiz.phase !== "lobby" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-2xl font-bold">{myPlayer.score}</div>
                <p className="text-sm text-muted-foreground">Your Score</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {nonHostPlayers.findIndex((p) => p._id === myPlayer._id) + 1}
                </div>
                <p className="text-sm text-muted-foreground">Your Position</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {nonHostPlayers.length}
                </div>
                <p className="text-sm text-muted-foreground">Total Players</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Players List (Lobby Only) */}
      {quiz.phase === "lobby" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Players in Lobby ({nonHostPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nonHostPlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No other players yet...
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {nonHostPlayers.map((player, index) => (
                  <div
                    key={player._id}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 hover:scale-[1.02] animate-in fade-in-0 slide-in-from-left-2 ${
                      player._id === myPlayer._id
                        ? "bg-primary/10 border-primary"
                        : "bg-card hover:bg-card/80"
                    }`}
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
                        {player._id === myPlayer._id && (
                          <span className="text-xs text-primary ml-1">
                            (You)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz Info */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold">{quiz.config.totalRounds}</div>
              <p className="text-xs text-muted-foreground">Rounds</p>
            </div>
            <div>
              <div className="text-lg font-bold">
                {quiz.config.secondsPerQuestion}s
              </div>
              <p className="text-xs text-muted-foreground">Answer Time</p>
            </div>
            <div>
              <div className="text-lg font-bold">
                {quiz.config.secondsForPrompt}s
              </div>
              <p className="text-xs text-muted-foreground">Prompt Time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
