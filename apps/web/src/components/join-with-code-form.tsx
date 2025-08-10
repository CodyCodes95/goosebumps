"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Loader from "./loader";
import { toast } from "sonner";
import { Users, Clock } from "lucide-react";

type JoinWithCodeFormProps = {
  joinCode: string;
};

// Simple device fingerprinting
function getDeviceFingerprint(): string {
  // Check if we already have a fingerprint in localStorage
  const existing = localStorage.getItem("goosebumps-device-id");
  if (existing) {
    return existing;
  }

  // Generate a new fingerprint
  const fingerprint = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem("goosebumps-device-id", fingerprint);
  return fingerprint;
}

export function JoinWithCodeForm({ joinCode }: JoinWithCodeFormProps) {
  const [playerName, setPlayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Get live quiz data to check if it exists and is joinable
  const liveData = useQuery(api.quizzes.getQuizLive, { joinCode });

  // Join quiz mutation
  const joinQuiz = useMutation(api.quizzes.joinQuiz);

  const quiz = liveData?.quiz;
  const players = liveData?.players || [];
  const nonHostPlayers = players.filter((p) => !p.isHost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!quiz) {
      toast.error("Quiz not found");
      return;
    }

    setIsSubmitting(true);

    try {
      const deviceFingerprint = getDeviceFingerprint();

      const result = await joinQuiz({
        joinCode,
        name: playerName.trim(),
        deviceFingerprint,
      });

      toast.success("Joined quiz successfully!");

      // Redirect to the play page
      router.push(`/play/${result.quizId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to join quiz"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limit to 20 characters as per backend validation
    const value = e.target.value.slice(0, 20);
    setPlayerName(value);
  };

  if (liveData === undefined) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quiz) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="font-medium mb-2">Quiz Not Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The quiz code <strong>{joinCode}</strong> doesn't exist or is no
              longer active.
            </p>
            <Button onClick={() => router.push("/join")} variant="outline">
              Try Another Code
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quiz.phase !== "lobby") {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⏰</div>
            <h3 className="font-medium mb-2">Quiz Already Started</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This quiz has already begun. You can only join quizzes that are
              still in the lobby.
            </p>
            <Button onClick={() => router.push("/join")} variant="outline">
              Try Another Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Quiz Status */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {nonHostPlayers.length}{" "}
                {nonHostPlayers.length === 1 ? "player" : "players"} joined
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Lobby Open</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Join Form */}
      <Card>
        <CardHeader>
          <CardTitle>Enter Your Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playerName">Display Name</Label>
              <Input
                id="playerName"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={handleNameChange}
                disabled={isSubmitting}
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This name will be visible to other players ({playerName.length}
                /20)
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!playerName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 mr-2" />
                  Joining...
                </>
              ) : (
                "Join Quiz"
              )}
            </Button>
          </form>

          {/* Show current players if any */}
          {nonHostPlayers.length > 0 && (
            <div className="mt-6 pt-6 border-t animate-in fade-in-0 slide-in-from-bottom-2">
              <h4 className="text-sm font-medium mb-3">Players in lobby:</h4>
              <div className="space-y-2">
                {nonHostPlayers.slice(0, 5).map((player, index) => (
                  <div
                    key={player._id}
                    className="flex items-center gap-2 animate-in fade-in-0 slide-in-from-left-2"
                    style={{
                      animationDelay: `${index * 75}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm">{player.name}</span>
                  </div>
                ))}
                {nonHostPlayers.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {nonHostPlayers.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Warning */}
      {nonHostPlayers.length >= 45 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-800">
              <strong>Almost full!</strong> This quiz can hold up to 50 players.
              {50 - nonHostPlayers.length} spots remaining.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
