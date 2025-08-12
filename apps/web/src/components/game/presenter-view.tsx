"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import { LoaderContainer } from "../loader";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Play,
  Lock,
  ArrowRight,
  Copy,
  Share,
  Settings,
  Trophy,
  Clock,
  Zap,
  MessageSquare,
  SkipForward,
  StopCircle,
  UserX,
} from "lucide-react";

// Game components
import { AnimatedBackground, ConfettiExplosion } from "./animated-background";
import { AnswerGrid, type AnswerOption } from "./answer-card";
import { TimerCountdown, PhaseProgress } from "./countdown";
import { useGameTransition, gameVariants } from "../motion-provider";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

type GamePresenterViewProps = {
  quizId: string;
};

export function GamePresenterView({ quizId }: GamePresenterViewProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isLockingAnswers, setIsLockingAnswers] = useState(false);
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const transition = useGameTransition("default");

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

  // Mutations
  const startGame = useMutation(api.quizzes.startGame);
  const lockAnswers = useMutation(api.quizzes.lockAnswers);
  const advancePhase = useMutation(api.quizzes.advancePhase);
  const kickPlayer = useMutation(api.quizzes.kickPlayer);
  const endQuiz = useMutation(api.quizzes.endQuiz);
  const skipRound = useMutation(api.quizzes.skipRound);

  // Timer for answering phase
  useEffect(() => {
    if (quiz?.phase === "answering" && liveData?.quiz.answerDeadlineAt) {
      const updateTimer = () => {
        const remaining = Math.max(
          0,
          Math.ceil((liveData.quiz.answerDeadlineAt! - Date.now()) / 1000)
        );
        setTimeRemaining(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(0);
    }
  }, [quiz?.phase, liveData?.quiz.answerDeadlineAt]);

  // Show confetti when game finishes
  useEffect(() => {
    if (quiz?.phase === "finished") {
      setShowConfetti(true);
    }
  }, [quiz?.phase]);

  // Keyboard shortcuts for presenter
  useEffect(() => {
    if (!quiz) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { players = [] } = liveData || {};
      const nonHostPlayers = players.filter((p) => !p.isHost);

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          if (quiz.phase === "lobby" && nonHostPlayers.length > 0) {
            handleStartGame();
          }
          break;
        case "l":
          event.preventDefault();
          if (quiz.phase === "answering") {
            handleLockAnswers();
          }
          break;
        case "r":
        case "arrowright":
          event.preventDefault();
          if (quiz.phase === "reveal" || quiz.phase === "scoreboard") {
            handleAdvancePhase();
          }
          break;
        case "s":
          event.preventDefault();
          if (quiz.phase === "prompting") {
            handleSkipRound();
          }
          break;
        case "e":
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) {
            handleEndQuiz();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [quiz, liveData]);

  if (quiz === undefined || liveData === undefined) {
    return (
      <AnimatedBackground variant="default" intensity="low">
        <div className="game-screen flex items-center justify-center">
          <LoaderContainer />
        </div>
      </AnimatedBackground>
    );
  }

  if (!quiz) {
    return (
      <AnimatedBackground variant="default" intensity="low">
        <div className="game-screen flex items-center justify-center">
          <motion.div
            className="text-center space-y-4"
            variants={gameVariants.pageTransition}
            initial="initial"
            animate="animate"
            transition={transition}
          >
            <div className="text-6xl">🚫</div>
            <h2 className="text-2xl font-bold text-foreground">
              Quiz Not Found
            </h2>
            <p className="text-muted-foreground">
              This quiz doesn't exist or has been deleted.
            </p>
          </motion.div>
        </div>
      </AnimatedBackground>
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

  const handleKickPlayer = async (playerId: string) => {
    try {
      await kickPlayer({
        quizId: quiz._id,
        playerId: playerId as Id<"players">,
      });
      toast.success("Player removed from quiz");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to kick player"
      );
    }
  };

  const handleEndQuiz = async () => {
    try {
      await endQuiz({ quizId: quiz._id });
      toast.success("Quiz ended");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to end quiz"
      );
    }
  };

  const handleSkipRound = async () => {
    if (!liveData?.currentRound || !quiz) return;

    try {
      await skipRound({
        quizId: quiz._id,
      });
      toast.success("Round skipped");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to skip round"
      );
    }
  };

  // Convert API answer options to our component format
  const answerOptions: AnswerOption[] =
    liveData?.currentRound?.aiAnswerOptions?.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
    })) || [];

  const getPhaseInfo = () => {
    switch (quiz.phase) {
      case "lobby":
        return {
          title: "Lobby",
          description: "Waiting for players to join",
          icon: Users,
          color: "text-primary",
          bgVariant: "lobby" as const,
        };
      case "prompting":
        return {
          title: "Getting Prompt",
          description: "Player is writing a question prompt",
          icon: MessageSquare,
          color: "text-warning",
          bgVariant: "default" as const,
        };
      case "generating":
        return {
          title: "AI Generating",
          description: "Creating answer choices",
          icon: Zap,
          color: "text-accent",
          bgVariant: "default" as const,
        };
      case "answering":
        return {
          title: "Answer Time!",
          description: "Players are choosing their answers",
          icon: Clock,
          color: "text-success",
          bgVariant: "countdown" as const,
        };
      case "reveal":
        return {
          title: "Revealing Answer",
          description: "Showing the correct answer",
          icon: Trophy,
          color: "text-warning",
          bgVariant: "celebration" as const,
        };
      case "scoreboard":
        return {
          title: "Scoreboard",
          description: "Current standings",
          icon: Trophy,
          color: "text-primary",
          bgVariant: "default" as const,
        };
      case "finished":
        return {
          title: "Game Complete!",
          description: "Final results",
          icon: Trophy,
          color: "text-success",
          bgVariant: "celebration" as const,
        };
      default:
        return {
          title: "Game in Progress",
          description: "",
          icon: Clock,
          color: "text-muted-foreground",
          bgVariant: "default" as const,
        };
    }
  };

  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;

  return (
    <AnimatedBackground variant={phaseInfo.bgVariant} intensity="low">
      {/* Confetti celebration */}
      <ConfettiExplosion
        isActive={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      <div className="game-screen overflow-y-auto">
        <div className="game-container py-6 min-h-full">
          {/* Header */}
          <motion.div
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8"
            variants={gameVariants.pageTransition}
            initial="initial"
            animate="animate"
            transition={transition}
          >
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                {quiz.name}
              </h1>
              <div className="flex items-center gap-3">
                <PhaseIcon className={cn("w-5 h-5", phaseInfo.color)} />
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {phaseInfo.title}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Join code display */}
              <div className="game-card p-4 flex items-center gap-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Join Code</p>
                  <p className="text-2xl font-bold text-primary">
                    {quiz.joinCode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyJoinCode}
                    className="game-button"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyJoinLink}
                    className="game-button"
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress indicator */}
          <motion.div
            className="mb-8"
            variants={gameVariants.pageTransition}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.1 }}
          >
            <PhaseProgress
              currentPhase={quiz.currentRoundIndex + 1}
              totalPhases={quiz.config.totalRounds}
              phaseNames={Array.from(
                { length: quiz.config.totalRounds },
                (_, i) => `Round ${i + 1}`
              )}
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main content area */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={quiz.phase}
                  variants={gameVariants.pageTransition}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  {renderPhaseContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sidebar */}
            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              {/* Player list */}
              <motion.div
                className="game-card p-6"
                variants={gameVariants.cardEntrance}
                initial="initial"
                animate="animate"
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Players ({nonHostPlayers.length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {nonHostPlayers.map((player) => (
                    <motion.div
                      key={player._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                      variants={gameVariants.cardEntrance}
                      layout
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {player.score} points
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleKickPlayer(player._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}

                  {nonHostPlayers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No players yet</p>
                      <p className="text-sm">
                        Share the join code to get started!
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Controls */}
              <motion.div
                className="game-card p-6"
                variants={gameVariants.cardEntrance}
                initial="initial"
                animate="animate"
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Controls
                </h3>

                <div className="space-y-3">{renderControls()}</div>
              </motion.div>

              {/* Keyboard shortcuts */}
              <motion.div
                className="game-card p-6"
                variants={gameVariants.cardEntrance}
                initial="initial"
                animate="animate"
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-lg font-semibold mb-4">
                  Keyboard Shortcuts
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Space</span>
                    <span>Start Game</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">L</span>
                    <span>Lock Answers</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">R / →</span>
                    <span>Advance</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">S</span>
                    <span>Skip Round</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ctrl+E</span>
                    <span>End Quiz</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedBackground>
  );

  function renderPhaseContent() {
    if (!quiz) return null;

    switch (quiz.phase) {
      case "lobby":
        return renderLobby();
      case "prompting":
        return renderPrompting();
      case "generating":
        return renderGenerating();
      case "answering":
        return renderAnswering();
      case "reveal":
        return renderReveal();
      case "scoreboard":
        return renderScoreboard();
      case "finished":
        return renderFinished();
      default:
        return renderDefault();
    }
  }

  function renderLobby() {
    return (
      <div className="space-y-8">
        {/* Main lobby card */}
        <div className="game-card p-8 text-center space-y-6">
          <div className="space-y-4">
            <Users className="w-20 h-20 mx-auto text-primary animate-pulse-glow" />
            <h2 className="text-3xl font-bold">Waiting for Players</h2>
            <p className="text-xl text-muted-foreground">
              {nonHostPlayers.length}{" "}
              {nonHostPlayers.length === 1 ? "player" : "players"} in lobby
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <p className="text-muted-foreground mb-4">
              Share the join code or link to invite players
            </p>

            {nonHostPlayers.length === 0 ? (
              <div className="bg-muted/30 rounded-lg p-4 text-muted-foreground">
                Waiting for at least one player to join...
              </div>
            ) : (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-success">
                Ready to start! Players are waiting for you to begin the game.
              </div>
            )}
          </div>
        </div>

        {/* Prominent Start Game Button */}
        {nonHostPlayers.length > 0 && (
          <div className="game-card p-6 text-center">
            <h3 className="text-xl font-semibold mb-4">Ready to Begin?</h3>
            <Button
              onClick={handleStartGame}
              disabled={isStarting}
              className="w-full max-w-md mx-auto game-button text-xl py-6"
              size="lg"
            >
              {isStarting ? (
                <>
                  <Clock className="w-6 h-6 mr-3 animate-spin" />
                  Starting Game...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 mr-3" />
                  Start Game
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Or press{" "}
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> on
              your keyboard
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderPrompting() {
    const prompter = liveData?.players.find(
      (p) => p._id === liveData?.currentRound?.prompterPlayerId
    );

    return (
      <div className="game-card p-8 text-center space-y-6">
        <div className="space-y-4">
          <MessageSquare className="w-20 h-20 mx-auto text-warning animate-pulse" />
          <h2 className="text-3xl font-bold">Getting Creative</h2>
          <p className="text-xl text-muted-foreground">
            {prompter?.name || "A player"} is writing the next question prompt
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-muted/30 rounded-lg p-6">
            <div className="animate-shimmer h-4 bg-muted/50 rounded mb-3"></div>
            <div className="animate-shimmer h-4 bg-muted/50 rounded w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  function renderGenerating() {
    return (
      <div className="game-card p-8 text-center space-y-6">
        <div className="space-y-4">
          <Zap className="w-20 h-20 mx-auto text-accent animate-pulse-glow" />
          <h2 className="text-3xl font-bold">AI is Thinking</h2>
          <p className="text-xl text-muted-foreground">
            Creating awesome answer choices...
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-muted/30 rounded-lg p-4 h-24"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="animate-shimmer h-4 bg-muted/50 rounded mb-2"></div>
                <div className="animate-shimmer h-4 bg-muted/50 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderAnswering() {
    if (!liveData?.currentRound?.aiAnswerOptions) return null;

    const answeredCount = 0; // Note: playerAnswers not available in current round data structure
    const totalPlayers = nonHostPlayers.length;

    return (
      <div className="space-y-6">
        {/* Question */}
        <div className="game-card p-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {liveData.currentRound.promptText || "Question"}
          </h2>

          {/* Timer and progress */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            {timeRemaining > 0 && (
              <TimerCountdown
                timeLeft={timeRemaining}
                totalTime={quiz?.config.secondsPerQuestion || 30}
                size="lg"
              />
            )}

            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {answeredCount}/{totalPlayers}
              </p>
              <p className="text-sm text-muted-foreground">answered</p>
            </div>
          </div>
        </div>

        {/* Answer options preview */}
        <div className="game-card p-6">
          <h3 className="text-lg font-semibold mb-4">Answer Options</h3>
          <AnswerGrid
            options={answerOptions}
            isLocked={true}
            className="pointer-events-none opacity-75"
          />
        </div>
      </div>
    );
  }

  function renderReveal() {
    return (
      <div className="space-y-6">
        {/* Question */}
        <div className="game-card p-6 text-center">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl md:text-3xl font-bold">
            {liveData?.currentRound?.promptText}
          </h2>
        </div>

        {/* Answer reveal */}
        <div className="game-card p-6">
          <h3 className="text-lg font-semibold mb-4">Correct Answer</h3>
          <AnswerGrid
            options={answerOptions}
            isRevealed={true}
            isLocked={true}
          />
        </div>
      </div>
    );
  }

  function renderScoreboard() {
    return (
      <div className="space-y-6">
        <div className="game-card p-6 text-center">
          <Trophy className="w-16 h-16 mx-auto text-warning mb-4 animate-pulse-glow" />
          <h2 className="text-3xl font-bold">Leaderboard</h2>
          <p className="text-muted-foreground">
            After Round {(quiz?.currentRoundIndex || 0) + 1}
          </p>
        </div>

        {/* Leaderboard */}
        {leaderboard && leaderboard.length > 0 ? (
          <div className="game-card p-6">
            <motion.div
              className="space-y-3"
              variants={{
                animate: {
                  transition: { staggerChildren: 0.1 },
                },
              }}
              initial="initial"
              animate="animate"
            >
              {leaderboard.slice(0, 10).map((player) => {
                const position = player.position;

                return (
                  <motion.div
                    key={player._id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg",
                      "bg-gradient-to-r",
                      position === 1 && "from-warning/20 to-warning/10",
                      position === 2 && "from-muted/30 to-muted/20",
                      position === 3 && "from-accent/20 to-accent/10",
                      position > 3 && "from-secondary/50 to-secondary/30"
                    )}
                    variants={gameVariants.cardEntrance}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                        position === 1 && "bg-warning text-warning-foreground",
                        position === 2 && "bg-muted text-muted-foreground",
                        position === 3 && "bg-accent text-accent-foreground",
                        position > 3 && "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {position <= 3
                        ? position === 1
                          ? "🥇"
                          : position === 2
                            ? "🥈"
                            : "🥉"
                        : position}
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold">{player.name}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold">{player.score}</div>
                      <div className="text-sm text-muted-foreground">
                        points
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        ) : (
          <div className="game-card p-8 text-center">
            <p className="text-muted-foreground">No scores yet</p>
          </div>
        )}
      </div>
    );
  }

  function renderFinished() {
    return (
      <div className="game-card p-8 text-center space-y-6">
        <div className="space-y-4">
          <div className="text-8xl animate-bounce-subtle">🏆</div>
          <h2 className="text-4xl font-bold">Game Complete!</h2>
          <p className="text-xl text-muted-foreground">
            Thanks for hosting an awesome quiz!
          </p>
        </div>

        {/* Final leaderboard preview */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-semibold mb-4">Final Winners</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 3).map((player, index) => (
                <div
                  key={player._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-warning/20 to-warning/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </span>
                    <span className="font-semibold">{player.name}</span>
                  </div>
                  <span className="font-bold">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDefault() {
    return (
      <div className="game-card p-8 text-center space-y-6">
        <Clock className="w-20 h-20 mx-auto text-muted-foreground animate-pulse" />
        <h2 className="text-3xl font-bold">Game in Progress</h2>
        <p className="text-xl text-muted-foreground">{phaseInfo.description}</p>
      </div>
    );
  }

  function renderControls() {
    if (!quiz) return null;

    switch (quiz.phase) {
      case "lobby":
        return (
          <Button
            onClick={handleStartGame}
            disabled={nonHostPlayers.length === 0 || isStarting}
            className="w-full game-button"
            size="lg"
          >
            {isStarting ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Game
              </>
            )}
          </Button>
        );

      case "answering":
        return (
          <>
            <Button
              onClick={handleLockAnswers}
              disabled={isLockingAnswers}
              variant="secondary"
              className="w-full game-button"
            >
              {isLockingAnswers ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Answers
                </>
              )}
            </Button>
          </>
        );

      case "reveal":
      case "scoreboard":
        return (
          <Button
            onClick={handleAdvancePhase}
            disabled={isAdvancingPhase}
            className="w-full game-button"
          >
            {isAdvancingPhase ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Advancing...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                {quiz.phase === "scoreboard"
                  ? quiz.currentRoundIndex + 1 < (quiz.config?.totalRounds || 1)
                    ? "Next Round"
                    : "Final Results"
                  : "Show Scoreboard"}
              </>
            )}
          </Button>
        );

      case "prompting":
        return (
          <Button
            onClick={handleSkipRound}
            variant="secondary"
            className="w-full game-button"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Skip Round
          </Button>
        );

      default:
        return null;
    }
  }
}
