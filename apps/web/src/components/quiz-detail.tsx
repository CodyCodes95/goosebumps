"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@goosebumps/backend";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Play,
  Save,
  Settings,
  Users,
  Clock,
  Timer,
  Link,
  Copy,
  ArrowLeft,
} from "lucide-react";
import type { Id } from "@goosebumps/backend";

type QuizDetailProps = {
  quizId: Id<"quizzes">;
};

export default function QuizDetail({ quizId }: QuizDetailProps) {
  const router = useRouter();
  const updateQuizConfig = useMutation(api.quizzes.updateQuizConfig);

  // Get specific quiz data
  const specificQuiz = useQuery(api.quizzes.getQuiz, { quizId });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [config, setConfig] = useState({
    totalRounds: 5,
    secondsPerQuestion: 30,
    secondsForPrompt: 30,
  });

  useEffect(() => {
    if (specificQuiz) {
      setName(specificQuiz.name);
      setConfig(specificQuiz.config);
    }
  }, [specificQuiz]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a quiz name");
      return;
    }

    if (config.totalRounds < 1 || config.totalRounds > 20) {
      toast.error("Total rounds must be between 1 and 20");
      return;
    }

    if (config.secondsPerQuestion < 10 || config.secondsPerQuestion > 120) {
      toast.error("Question time must be between 10 and 120 seconds");
      return;
    }

    if (config.secondsForPrompt < 15 || config.secondsForPrompt > 180) {
      toast.error("Prompt time must be between 15 and 180 seconds");
      return;
    }

    try {
      setIsSaving(true);
      await updateQuizConfig({
        quizId,
        config,
      });

      toast.success("Quiz settings saved successfully!");
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save quiz settings");
      console.error("Save quiz error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresent = () => {
    router.push(`/present/${quizId}`);
  };

  const handleCopyJoinCode = async (joinCode: string) => {
    try {
      await navigator.clipboard.writeText(joinCode);
      toast.success("Join code copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy join code");
    }
  };

  const handleCopyJoinLink = async (joinLinkSlug: string) => {
    try {
      const joinUrl = `${window.location.origin}/join/${joinLinkSlug}`;
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Join link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy join link");
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    return "Just now";
  };

  const getPhaseStatus = (phase: string) => {
    switch (phase) {
      case "lobby":
        return {
          label: "Ready to start",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        };
      case "finished":
        return {
          label: "Completed",
          color: "text-green-600",
          bgColor: "bg-green-50",
        };
      case "prompting":
        return {
          label: "Prompting",
          color: "text-purple-600",
          bgColor: "bg-purple-50",
        };
      case "generating":
        return {
          label: "Generating",
          color: "text-amber-600",
          bgColor: "bg-amber-50",
        };
      case "answering":
        return {
          label: "Answering",
          color: "text-orange-600",
          bgColor: "bg-orange-50",
        };
      case "reveal":
        return {
          label: "Revealing",
          color: "text-pink-600",
          bgColor: "bg-pink-50",
        };
      case "scoreboard":
        return {
          label: "Scoreboard",
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
        };
      default:
        return {
          label: "Unknown",
          color: "text-gray-600",
          bgColor: "bg-gray-50",
        };
    }
  };

  if (!specificQuiz) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const status = getPhaseStatus(specificQuiz.phase);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/quizzes")}
          className="hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to quizzes
        </Button>

        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{specificQuiz.name}</h1>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full ${status.color} ${status.bgColor}`}
            >
              {status.label}
            </span>
          </div>
          <p className="text-muted-foreground">
            Created {formatTimeAgo(specificQuiz.createdAt)} • Last updated{" "}
            {formatTimeAgo(specificQuiz.updatedAt)}
          </p>
        </div>

        {specificQuiz.phase === "lobby" && (
          <Button
            onClick={handlePresent}
            className="transition-all hover:scale-105"
          >
            <Play className="h-4 w-4 mr-2" />
            Present Quiz
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quiz Settings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quiz Settings
              </CardTitle>
              <CardDescription>Configure your quiz parameters</CardDescription>
            </div>
            {specificQuiz.phase === "lobby" && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="transition-all hover:scale-105"
              >
                Edit
              </Button>
            )}
          </CardHeader>

          <form onSubmit={handleSave}>
            <CardContent className="flex flex-col gap-4">
              {isEditing ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="quiz-name">Quiz Name</Label>
                    <Input
                      id="quiz-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="transition-colors focus:border-primary"
                      disabled={specificQuiz.phase !== "lobby"}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="total-rounds">Total Rounds</Label>
                      <Input
                        id="total-rounds"
                        type="number"
                        min={1}
                        max={20}
                        value={config.totalRounds}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            totalRounds: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="transition-colors focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="question-time">Question Time (s)</Label>
                      <Input
                        id="question-time"
                        type="number"
                        min={10}
                        max={120}
                        value={config.secondsPerQuestion}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            secondsPerQuestion: parseInt(e.target.value) || 30,
                          }))
                        }
                        className="transition-colors focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="prompt-time">Prompt Time (s)</Label>
                      <Input
                        id="prompt-time"
                        type="number"
                        min={15}
                        max={180}
                        value={config.secondsForPrompt}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            secondsForPrompt: parseInt(e.target.value) || 30,
                          }))
                        }
                        className="transition-colors focus:border-primary"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {specificQuiz.config.totalRounds}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Total Rounds
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {specificQuiz.config.secondsPerQuestion}s
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Per Question
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Timer className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {specificQuiz.config.secondsForPrompt}s
                      </span>
                      <span className="text-xs text-muted-foreground">
                        For Prompts
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {isEditing && (
              <CardFooter className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  className="transition-all hover:scale-105"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setName(specificQuiz.name);
                    setConfig(specificQuiz.config);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        {/* Join Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Join Information
            </CardTitle>
            <CardDescription>
              Share these with participants to join your quiz
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Join Code</span>
                  <span className="text-2xl font-mono font-bold tracking-wider">
                    {specificQuiz.joinCode}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyJoinCode(specificQuiz.joinCode)}
                  className="transition-all hover:scale-105"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Join Link</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    /join/{specificQuiz.joinLinkSlug}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyJoinLink(specificQuiz.joinLinkSlug)}
                  className="transition-all hover:scale-105"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Players can join by entering the code at <strong>/join</strong>{" "}
                or by visiting the direct link.
                {specificQuiz.phase !== "lobby" &&
                  " This quiz has already started."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
