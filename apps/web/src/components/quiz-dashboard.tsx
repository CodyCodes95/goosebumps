"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
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
import { Plus, Settings, Play, Users } from "lucide-react";

export default function QuizDashboard() {
  const router = useRouter();
  const quizzes = useQuery(api.quizzes.listQuizzesForUser);
  const createQuiz = useMutation(api.quizzes.createQuiz);

  const [isCreating, setIsCreating] = useState(false);
  const [newQuizName, setNewQuizName] = useState("");
  const [config, setConfig] = useState({
    totalRounds: 5,
    secondsPerQuestion: 30,
    secondsForPrompt: 30,
  });

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newQuizName.trim()) {
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
      setIsCreating(true);
      const result = await createQuiz({
        name: newQuizName.trim(),
        config,
      });

      toast.success("Quiz created successfully!");
      setNewQuizName("");
      setConfig({
        totalRounds: 5,
        secondsPerQuestion: 30,
        secondsForPrompt: 30,
      });

      // Navigate to the new quiz detail page
      router.push(`/quizzes/${result.quizId}`);
    } catch (error) {
      toast.error("Failed to create quiz. Please try again.");
      console.error("Create quiz error:", error);
    } finally {
      setIsCreating(false);
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
        return { label: "Ready to start", color: "text-blue-600" };
      case "finished":
        return { label: "Completed", color: "text-green-600" };
      default:
        return { label: "In progress", color: "text-amber-600" };
    }
  };

  if (quizzes === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create Quiz Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Quiz
          </CardTitle>
          <CardDescription>
            Set up your interactive quiz experience
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateQuiz}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2 lg:col-span-2">
                <Label htmlFor="quiz-name">Quiz Name</Label>
                <Input
                  id="quiz-name"
                  placeholder="Enter quiz name..."
                  value={newQuizName}
                  onChange={(e) => setNewQuizName(e.target.value)}
                  className="transition-colors focus:border-primary"
                  required
                />
              </div>

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
                  required
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
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Time players have to submit their question prompt
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={isCreating || !newQuizName.trim()}
              className="transition-all hover:scale-105"
            >
              {isCreating ? "Creating..." : "Create Quiz"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Quiz List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Quizzes</h2>
          <span className="text-sm text-muted-foreground">
            {quizzes?.length || 0} quiz{quizzes?.length === 1 ? "" : "es"}
          </span>
        </div>

        {quizzes?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No quizzes yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first interactive quiz to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes?.map((quiz) => {
              const status = getPhaseStatus(quiz.phase);
              return (
                <Card
                  key={quiz._id}
                  className="group transition-all hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                        {quiz.name}
                      </CardTitle>
                      <span className={`text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <CardDescription>
                      Created {formatTimeAgo(quiz.createdAt)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{quiz.config.totalRounds} rounds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span>{quiz.config.secondsPerQuestion}s per Q</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Join code:{" "}
                      <span className="font-mono font-medium">
                        {quiz.joinCode}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/quizzes/${quiz._id}`)}
                      className="transition-all hover:scale-105"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {quiz.phase === "lobby" && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/present/${quiz._id}`)}
                        className="transition-all hover:scale-105"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Present
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
