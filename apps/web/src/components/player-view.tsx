"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoaderContainer } from "./loader";
import {
  Users,
  Clock,
  Play,
  Zap,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PlayerViewProps = {
  quizId: string;
};

// Get device fingerprint (must match the one used in join)
function getDeviceFingerprint(): string {
  return localStorage.getItem("goosebumps-device-id") || "";
}

export function PlayerView({ quizId }: PlayerViewProps) {
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [promptText, setPromptText] = useState("");
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

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

  // Reset answer state when round changes
  useEffect(() => {
    setSelectedAnswer("");
    setHasAnswered(false);
  }, [liveData?.currentRound?._id]);

  // Mutations
  const submitPrompt = useMutation(api.quizzes.submitPrompt);
  const submitAnswer = useMutation(api.quizzes.submitAnswer);

  // Handle prompt submission
  const handleSubmitPrompt = async () => {
    if (!promptText.trim() || !liveData?.currentRound || isSubmittingPrompt) {
      return;
    }

    const trimmed = promptText.trim();
    if (trimmed.length < 5) {
      toast.error("Prompt must be at least 5 characters long");
      return;
    }
    if (trimmed.length > 500) {
      toast.error("Prompt must be 500 characters or less");
      return;
    }

    setIsSubmittingPrompt(true);
    try {
      await submitPrompt({
        quizId: liveData.quiz._id,
        roundId: liveData.currentRound._id,
        promptText: trimmed,
      });
      setPromptText("");
      toast.success("Prompt submitted! AI is generating questions...");
    } catch (error) {
      console.error("Error submitting prompt:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit prompt"
      );
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  // Handle answer submission
  const handleSubmitAnswer = async (optionId: string) => {
    if (!liveData?.currentRound || isSubmittingAnswer || hasAnswered) {
      return;
    }

    setIsSubmittingAnswer(true);
    try {
      const result = await submitAnswer({
        quizId: liveData.quiz._id,
        roundId: liveData.currentRound._id,
        selectedOptionId: optionId,
        deviceFingerprint,
      });

      setSelectedAnswer(optionId);
      setHasAnswered(true);

      if (result.isCorrect) {
        toast.success(`Correct! +${result.pointsEarned} points`);
      } else {
        toast.error("Incorrect answer");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit answer"
      );
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  if (quiz === undefined || liveData === undefined || !deviceFingerprint) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <LoaderContainer />
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

  // Check if current player is the selected prompter
  const isPrompter = liveData?.currentRound?.prompterPlayerId === myPlayer?._id;

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
          icon: MessageSquare,
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
        <CardContent className="py-8">
          {/* Prompting Phase - Show Input for Prompter, Standby for Others */}
          {quiz.phase === "prompting" ? (
            <div className="space-y-6">
              {isPrompter ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                    <h3 className="text-lg font-semibold mb-2">
                      Your Turn to Write a Prompt!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Write a topic or question that the AI will turn into a
                      multiple-choice trivia question
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prompt-input">Your Prompt</Label>
                      <Input
                        id="prompt-input"
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        placeholder="e.g., Famous landmarks in France"
                        maxLength={500}
                        disabled={isSubmittingPrompt}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitPrompt();
                          }
                        }}
                        className="text-center"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{promptText.length}/500 characters</span>
                        <span>Minimum 5 characters</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleSubmitPrompt}
                      disabled={
                        promptText.trim().length < 5 || isSubmittingPrompt
                      }
                      className="w-full"
                    >
                      {isSubmittingPrompt ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Prompt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <h3 className="text-lg font-semibold">Wait Your Turn</h3>
                  <p className="text-muted-foreground">
                    {liveData?.players.find(
                      (p) => p._id === liveData?.currentRound?.prompterPlayerId
                    )?.name || "Another player"}{" "}
                    is writing a question prompt
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    The AI will use their prompt to generate a trivia question
                    with multiple choice answers
                  </div>
                </div>
              )}
            </div>
          ) : quiz.phase === "generating" ? (
            <div className="text-center space-y-4">
              <Zap className="w-12 h-12 mx-auto mb-4 text-purple-500 animate-bounce" />
              <h3 className="text-lg font-semibold">AI is Working...</h3>
              <p className="text-muted-foreground">
                Creating a trivia question with multiple choice answers
              </p>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 text-sm text-muted-foreground">
                This usually takes a few seconds ⚡
              </div>
            </div>
          ) : quiz.phase === "answering" ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <Play className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-4">
                  {liveData?.currentRound?.promptText ||
                    "Answer this question!"}
                </h3>

                {/* Timer */}
                {liveData?.quiz.answerDeadlineAt && (
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-sm text-muted-foreground mb-4">
                    Time remaining:{" "}
                    {Math.max(
                      0,
                      Math.ceil(
                        (liveData.quiz.answerDeadlineAt - Date.now()) / 1000
                      )
                    )}
                    s
                  </div>
                )}
              </div>

              {/* Answer Options */}
              {liveData?.currentRound?.aiAnswerOptions && (
                <div className="grid gap-3 max-w-md mx-auto">
                  {liveData.currentRound.aiAnswerOptions.map(
                    (option, index) => {
                      const isSelected = selectedAnswer === option.id;
                      const showResult = hasAnswered && isSelected;

                      return (
                        <Button
                          key={option.id}
                          onClick={() =>
                            !hasAnswered &&
                            !isSubmittingAnswer &&
                            handleSubmitAnswer(option.id)
                          }
                          disabled={hasAnswered || isSubmittingAnswer}
                          className={`p-4 h-auto text-left justify-start transition-all duration-200 ${
                            isSelected && hasAnswered
                              ? "ring-2 ring-primary"
                              : ""
                          }`}
                          variant={
                            isSelected && hasAnswered ? "default" : "outline"
                          }
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isSelected && hasAnswered
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {String.fromCharCode(65 + index)}
                            </div>
                            <div className="flex-1 text-sm">{option.text}</div>
                          </div>
                        </Button>
                      );
                    }
                  )}
                </div>
              )}

              {/* Status Messages */}
              {hasAnswered ? (
                <div className="text-center">
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-sm text-blue-600 dark:text-blue-400">
                    ✅ Answer submitted! Waiting for other players...
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Select your answer quickly for bonus points!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <PhaseIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground transition-all duration-500" />
              <p className="text-muted-foreground mb-4">
                {phaseDisplay.description}
              </p>

              {quiz.phase === "lobby" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {nonHostPlayers.length}{" "}
                    {nonHostPlayers.length === 1 ? "player" : "players"} in
                    lobby
                  </p>
                  {nonHostPlayers.length < 2 && (
                    <p className="text-xs text-muted-foreground">
                      Waiting for more players to join...
                    </p>
                  )}
                </div>
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
