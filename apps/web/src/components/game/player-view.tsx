"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import { LoaderContainer } from "../loader";
import { useEffect, useState, useCallback } from "react";
import usePresence from "@convex-dev/presence/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Clock,
  Zap,
  Send,
  Loader2,
  MessageSquare,
  Trophy,
  Star,
  Target,
} from "lucide-react";

// Game components
import { AnimatedBackground, ConfettiExplosion } from "./animated-background";
import { AnswerGrid, type AnswerOption } from "./answer-card";
import { Countdown, TimerCountdown, PhaseProgress } from "./countdown";
import { useGameTransition, gameVariants } from "../motion-provider";
import { useGameSounds } from "./audio-manager";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "@/lib/utils";
import { PLAYER_EMOJIS } from "@/lib/emojis";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

type GamePlayerViewProps = {
  quizId: string;
};

// Get device fingerprint (must match the one used in join)
function getDeviceFingerprint(): string {
  return localStorage.getItem("goosebumps-device-id") || "";
}

type GamePlayerContentProps = {
  quiz: NonNullable<
    ReturnType<typeof useQuery<typeof api.quizzes.getQuizPublic>>
  >;
  liveData: NonNullable<
    ReturnType<typeof useQuery<typeof api.quizzes.getQuizLive>>
  >;
  deviceFingerprint: string;
};

function GamePlayerContent({
  quiz,
  liveData,
  deviceFingerprint,
}: GamePlayerContentProps) {
  const [promptText, setPromptText] = useState("");
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);

  const transition = useGameTransition("default");
  const { playCelebration } = useGameSounds();

  // Now players will have the correct type from liveData
  const { players } = liveData;
  const myPlayer = players.find(
    (p) => p.deviceFingerprint === deviceFingerprint && !p.isHost
  );

  // Get leaderboard for scoreboard phase
  const leaderboard = useQuery(
    api.quizzes.getLeaderboard,
    quiz._id ? { quizId: quiz._id as Id<"quizzes"> } : "skip"
  );

  // Player breakdown (only when we know myPlayer and quiz)
  const playerBreakdown = useQuery(
    api.quizzes.getPlayerBreakdown,
    quiz._id && myPlayer?._id
      ? {
          quizId: quiz._id as Id<"quizzes">,
          playerId: myPlayer._id as Id<"players">,
        }
      : "skip"
  );

  // Memoize countdown callbacks to prevent unnecessary re-renders
  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
  }, []);

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  // Presence heartbeat
  const roomId = quiz._id as unknown as string;
  const presenceDisplayName = myPlayer?.name || "Player";
  const presenceState =
    usePresence(api.presence, roomId, presenceDisplayName) ?? [];

  // Mutations
  const submitPrompt = useMutation(api.quizzes.submitPrompt);
  const submitAnswer = useMutation(api.quizzes.submitAnswer);
  const updatePlayerEmoji = useMutation(api.quizzes.updatePlayerEmoji);

  // Reset answer state when round changes
  useEffect(() => {
    setSelectedAnswer("");
    setHasAnswered(false);
  }, [liveData?.currentRound?._id]);

  // Countdown timer for answering phase
  const updateTimeRemaining = useCallback(() => {
    if (quiz?.phase === "answering" && liveData?.quiz.answerDeadlineAt) {
      const remaining = Math.max(
        0,
        Math.ceil((liveData.quiz.answerDeadlineAt - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
    } else if (quiz?.phase === "prompting" && liveData?.quiz.promptDeadlineAt) {
      const remaining = Math.max(
        0,
        Math.ceil((liveData.quiz.promptDeadlineAt - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
    } else {
      setTimeRemaining(0);
    }
  }, [
    quiz?.phase,
    liveData?.quiz.answerDeadlineAt,
    liveData?.quiz.promptDeadlineAt,
  ]);

  useEffect(() => {
    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [updateTimeRemaining]);

  // Show countdown when transitioning to answering phase
  useEffect(() => {
    if (quiz?.phase === "answering" && !showCountdown) {
      setShowCountdown(true);
    }
  }, [quiz?.phase]); // Remove showCountdown dependency to prevent infinite loop

  // Show confetti and play celebration sound on correct answer
  useEffect(() => {
    if (
      quiz?.phase === "reveal" &&
      hasAnswered &&
      selectedAnswer &&
      liveData?.currentRound?.aiAnswerOptions?.find(
        (o) => o.id === selectedAnswer
      )?.isCorrect
    ) {
      setShowConfetti(true);
      playCelebration();
    }
  }, [
    quiz?.phase,
    hasAnswered,
    selectedAnswer,
    liveData?.currentRound,
    playCelebration,
  ]);

  const handleSubmitPrompt = async () => {
    if (promptText.trim().length < 5) return;

    setIsSubmittingPrompt(true);
    try {
      await submitPrompt({
        quizId: quiz!._id,
        roundId: liveData!.currentRound!._id,
        promptText: promptText.trim(),
      });
      toast.success("Prompt submitted!");
      setPromptText("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit prompt"
      );
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  const handleSelectAnswer = async (optionId: string) => {
    if (hasAnswered || quiz?.phase !== "answering") return;

    setSelectedAnswer(optionId);
    setIsSubmittingAnswer(true);
    setHasAnswered(true);

    try {
      await submitAnswer({
        quizId: quiz!._id,
        roundId: liveData!.currentRound!._id,
        selectedOptionId: optionId,
        deviceFingerprint,
      });
      toast.success("Answer submitted!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit answer"
      );
      setHasAnswered(false);
      setSelectedAnswer("");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  if (!myPlayer) {
    return (
      <AnimatedBackground variant="lobby" intensity="medium">
        <div className="game-screen flex items-center justify-center">
          <motion.div
            className="text-center space-y-6 max-w-md mx-auto game-container"
            variants={gameVariants.pageTransition}
            initial="initial"
            animate="animate"
            transition={transition}
          >
            <div className="text-8xl animate-bounce-subtle">🎮</div>
            <h2 className="text-3xl font-bold text-foreground">
              Join the Game!
            </h2>
            <p className="text-muted-foreground">
              You haven't joined this quiz yet. Click below to jump in!
            </p>
            <Button asChild size="lg" className="game-button text-lg px-8 py-4">
              <a href={`/join/${quiz.joinCode}`}>
                <Users className="w-5 h-5 mr-2" />
                Join Quiz
              </a>
            </Button>
          </motion.div>
        </div>
      </AnimatedBackground>
    );
  }

  // At this point, myPlayer is guaranteed to be defined
  const typedMyPlayer = myPlayer; // TypeScript assertion helper
  const [showBreakdown, setShowBreakdown] = useState(false);

  const emojiOptions = PLAYER_EMOJIS as readonly string[];

  const getPlayerEmoji = (p: any) =>
    p?.emoji && typeof p.emoji === "string" ? p.emoji : "🎮";

  const handleChangeEmoji = async (emoji: string) => {
    try {
      await updatePlayerEmoji({
        quizId: quiz._id as Id<"quizzes">,
        playerId: typedMyPlayer._id as Id<"players">,
        deviceFingerprint,
        emoji,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update emoji"
      );
    }
  };

  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isPrompter =
    liveData?.currentRound?.prompterPlayerId === typedMyPlayer._id;

  // Convert API answer options to our component format
  const answerOptions: AnswerOption[] =
    liveData?.currentRound?.aiAnswerOptions?.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
    })) || [];

  const getBackgroundVariant = () => {
    switch (quiz.phase) {
      case "lobby":
        return "lobby";
      case "answering":
        return "countdown";
      case "reveal":
        return "celebration";
      default:
        return "default";
    }
  };

  return (
    <AnimatedBackground variant={getBackgroundVariant()} intensity="medium">
      {/* Countdown overlay */}
      <AnimatePresence>
        {showCountdown && quiz.phase === "answering" && (
          <Countdown from={3} onComplete={handleCountdownComplete} />
        )}
      </AnimatePresence>

      {/* Confetti celebration */}
      <ConfettiExplosion
        isActive={showConfetti}
        onComplete={handleConfettiComplete}
      />

      <div className="game-screen">
        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {quiz.phase === "lobby" && "Waiting in lobby"}
          {quiz.phase === "prompting" && "Someone is writing a question"}
          {quiz.phase === "generating" && "AI is generating answer choices"}
          {quiz.phase === "answering" && "Answer time! Choose your answer"}
          {quiz.phase === "reveal" && "Answer revealed"}
          {quiz.phase === "scoreboard" && "Showing scoreboard"}
          {quiz.phase === "finished" && "Game completed"}
        </div>

        <div className="game-container py-8">
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            variants={gameVariants.pageTransition}
            initial="initial"
            animate="animate"
            transition={transition}
          >
            {/* Phase progress */}
            <PhaseProgress
              currentPhase={quiz.currentRoundIndex + 1}
              totalPhases={quiz.config.totalRounds}
              phaseNames={Array.from(
                { length: quiz.config.totalRounds },
                (_, i) => `Round ${i + 1}`
              )}
              className="mx-auto"
            />
          </motion.div>

          {/* Main content based on phase */}
          <AnimatePresence mode="wait">
            <motion.div
              key={quiz.phase}
              variants={gameVariants.pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
              className="max-w-4xl mx-auto"
            >
              {renderPhaseContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AnimatedBackground>
  );

  function renderPhaseContent() {
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
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <Users className="w-20 h-20 mx-auto text-primary animate-pulse-glow" />
          <h2 className="text-3xl font-bold">Waiting for Game to Start</h2>
          <p className="text-xl text-muted-foreground">
            {nonHostPlayers.length}{" "}
            {nonHostPlayers.length === 1 ? "player" : "players"} ready
          </p>
        </div>

        {/* Player list */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-2xl mx-auto"
          variants={{
            animate: {
              transition: { staggerChildren: 0.1 },
            },
          }}
          initial="initial"
          animate="animate"
        >
          {nonHostPlayers.map((player) => (
            <motion.div
              key={player._id}
              className={cn(
                "game-card p-4 text-center",
                player._id === typedMyPlayer._id && "ring-2 ring-primary"
              )}
              variants={gameVariants.cardEntrance}
            >
              {player._id === typedMyPlayer._id ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="text-2xl mb-2 hover:scale-110 transition-transform"
                      aria-label="Change emoji"
                    >
                      {getPlayerEmoji(player as any)}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="p-2 max-h-64 overflow-y-auto"
                  >
                    <div className="grid grid-cols-8 gap-1">
                      {emojiOptions.map((e) => (
                        <button
                          key={e}
                          onClick={() => handleChangeEmoji(e)}
                          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted"
                        >
                          <span className="text-lg">{e}</span>
                        </button>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="text-[10px] text-muted-foreground text-center pt-1">
                      Tap to choose your emoji
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="text-2xl mb-2">
                  {getPlayerEmoji(player as any)}
                </div>
              )}
              <p className="font-medium text-sm truncate">{player.name}</p>
              {player._id === typedMyPlayer._id && (
                <p className="text-xs text-primary">(You)</p>
              )}
            </motion.div>
          ))}
        </motion.div>

        {nonHostPlayers.length < 2 && (
          <div className="game-card p-6 text-center max-w-md mx-auto">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Invite more friends to make it more fun!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Share code:{" "}
              <span className="font-bold text-primary">{quiz.joinCode}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderPrompting() {
    if (isPrompter) {
      return (
        <div className="text-center space-y-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            <MessageSquare className="w-20 h-20 mx-auto text-accent animate-pulse-glow" />
            <h2 className="text-3xl font-bold">Your Turn to Create!</h2>
            <p className="text-xl text-muted-foreground">
              Write a topic that AI will turn into a trivia question
            </p>
          </div>

          {/* Timer */}
          {timeRemaining > 0 && (
            <div className="flex justify-center">
              <TimerCountdown
                timeLeft={timeRemaining}
                totalTime={quiz.config.secondsForPrompt}
                size="lg"
              />
            </div>
          )}

          {/* Prompt input */}
          <div className="game-card p-8 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="prompt-input" className="text-lg font-semibold">
                Your Creative Prompt
              </Label>
              <Input
                id="prompt-input"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g., who won the 2024 geoguessr world cup?"
                maxLength={500}
                disabled={isSubmittingPrompt}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitPrompt();
                  }
                }}
                className="text-center text-lg h-14"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{promptText.length}/500 characters</span>
                <span>Minimum 5 characters</span>
              </div>
            </div>

            <Button
              onClick={handleSubmitPrompt}
              disabled={promptText.trim().length < 5 || isSubmittingPrompt}
              size="lg"
              className="w-full game-button text-lg h-14"
            >
              {isSubmittingPrompt ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Magic...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Prompt
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <Clock className="w-20 h-20 mx-auto text-muted-foreground animate-pulse" />
          <h2 className="text-3xl font-bold">Someone's Being Creative</h2>
          <p className="text-xl text-muted-foreground">
            {liveData?.players.find(
              (p) => p._id === liveData?.currentRound?.prompterPlayerId
            )?.name || "A player"}{" "}
            is writing the next question...
          </p>
        </div>

        <div className="game-card p-8 max-w-md mx-auto">
          <div className="animate-shimmer h-4 bg-muted/30 rounded mb-4"></div>
          <div className="animate-shimmer h-4 bg-muted/30 rounded w-3/4 mx-auto"></div>
        </div>
      </div>
    );
  }

  function renderGenerating() {
    return (
      <div className="flex min-h-[70dvh] md:min-h-0 items-center justify-center">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <Zap className="w-20 h-20 mx-auto text-primary animate-pulse-glow" />
            <h2 className="text-3xl font-bold">AI is Thinking...</h2>
            <p className="text-xl text-muted-foreground">
              Creating awesome answer choices for you!
            </p>
          </div>

          <div className="game-card p-8 max-w-md mx-auto">
            <div className="space-y-4">
              <div className="animate-shimmer h-6 bg-muted/30 rounded"></div>
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-shimmer h-4 bg-muted/30 rounded"
                    style={{ animationDelay: `${i * 200}ms` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderAnswering() {
    if (!liveData?.currentRound?.aiAnswerOptions) return null;

    return (
      <div className="space-y-8">
        {/* Question */}
        <motion.div
          className="text-center space-y-4"
          variants={gameVariants.cardEntrance}
          initial="initial"
          animate="animate"
        >
          <h2 className="text-2xl md:text-3xl font-bold max-w-3xl mx-auto leading-tight">
            {liveData.currentRound.promptText}
          </h2>

          {/* Timer */}
          {timeRemaining > 0 && (
            <div className="flex justify-center">
              <TimerCountdown
                timeLeft={timeRemaining}
                totalTime={quiz.config.secondsPerQuestion}
                size="lg"
                onComplete={() => {
                  if (!hasAnswered) {
                    toast.error("Time's up!");
                  }
                }}
              />
            </div>
          )}
        </motion.div>

        {/* Answer options */}
        <AnswerGrid
          options={answerOptions}
          selectedOptionId={selectedAnswer}
          isLocked={hasAnswered}
          onSelectOption={handleSelectAnswer}
        />

        {/* Status message */}
        <motion.div
          className="text-center"
          variants={gameVariants.pageTransition}
          initial="initial"
          animate="animate"
        >
          {hasAnswered ? (
            <div className="game-card p-4 max-w-md mx-auto bg-success/10 border-success/20">
              <Star className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-success font-semibold">
                Answer locked in! Waiting for others...
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Choose quickly for bonus points! ⚡
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  function renderReveal() {
    const correctOption = answerOptions.find((o) => o.isCorrect);

    return (
      <div className="space-y-8">
        {/* Question */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold max-w-3xl mx-auto leading-tight">
            {liveData?.currentRound?.promptText}
          </h2>
        </div>

        {/* Correct answer only */}
        {correctOption && (
          <motion.div
            className="max-w-2xl mx-auto"
            variants={gameVariants.cardEntrance}
            initial="initial"
            animate="animate"
          >
            <div className="game-card p-6 md:p-8 border-success/30 bg-success/10">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-success text-success-foreground flex items-center justify-center text-2xl">
                    ✓
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm uppercase tracking-wide text-success font-semibold mb-1">
                    Correct Answer
                  </p>
                  <p className="text-lg md:text-xl font-bold leading-snug">
                    {correctOption.text}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Fun fact / detail */}
        <motion.div
          className="max-w-2xl mx-auto"
          variants={gameVariants.cardEntrance}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.2 }}
        >
          <div className="game-card p-6 md:p-8">
            <p className="text-sm uppercase tracking-wide text-accent font-semibold mb-2">
              Fun fact
            </p>
            {liveData?.currentRound?.aiDetailText ? (
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                {liveData.currentRound.aiDetailText}
              </p>
            ) : (
              <div>
                <div className="animate-shimmer h-4 bg-muted/30 rounded mb-3"></div>
                <div className="animate-shimmer h-4 bg-muted/30 rounded w-11/12 mb-3"></div>
                <div className="animate-shimmer h-4 bg-muted/30 rounded w-10/12"></div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Fetching a fun fact...
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Result message */}
        <motion.div
          className="text-center"
          variants={gameVariants.cardEntrance}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.4 }}
        >
          <div
            className={cn(
              "game-card p-6 max-w-md mx-auto",
              hasAnswered &&
                selectedAnswer &&
                liveData?.currentRound?.aiAnswerOptions?.find(
                  (o) => o.id === selectedAnswer
                )?.isCorrect
                ? "bg-success/10 border-success/20"
                : "bg-destructive/10 border-destructive/20"
            )}
          >
            {hasAnswered && selectedAnswer ? (
              liveData?.currentRound?.aiAnswerOptions?.find(
                (o) => o.id === selectedAnswer
              )?.isCorrect ? (
                <>
                  <Trophy className="w-8 h-8 mx-auto mb-3 text-success" />
                  <p className="text-xl font-bold text-success mb-2">
                    Correct! 🎉
                  </p>
                  <p className="text-success">You earned points!</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">😔</div>
                  <p className="text-xl font-bold text-destructive mb-2">
                    Not quite!
                  </p>
                  <p className="text-destructive">Better luck next time!</p>
                </>
              )
            ) : (
              <>
                <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-xl font-bold text-muted-foreground mb-2">
                  Time's Up!
                </p>
                <p className="text-muted-foreground">
                  You didn't answer in time
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  function renderScoreboard() {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <Trophy className="w-20 h-20 mx-auto text-warning animate-pulse-glow" />
          <h2 className="text-3xl font-bold">Leaderboard</h2>
          <p className="text-xl text-muted-foreground">
            After Round {quiz.currentRoundIndex + 1}
          </p>
        </div>

        {/* Leaderboard */}
        {leaderboard && leaderboard.length > 0 ? (
          <motion.div
            className="space-y-3 max-w-2xl mx-auto"
            variants={{
              animate: {
                transition: { staggerChildren: 0.1 },
              },
            }}
            initial="initial"
            animate="animate"
          >
            {leaderboard.slice(0, 10).map((player) => {
              const isMe = player._id === myPlayer?._id;
              const position = player.position;

              return (
                <motion.div
                  key={player._id}
                  className={cn(
                    "game-card p-4 flex items-center gap-4",
                    isMe && "ring-2 ring-primary game-glow-primary",
                    position <= 3 && "bg-gradient-to-r",
                    position === 1 && "from-warning/20 to-warning/10",
                    position === 2 && "from-muted/30 to-muted/20",
                    position === 3 && "from-accent/20 to-accent/10"
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

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-semibold truncate",
                        isMe && "text-primary"
                      )}
                    >
                      <span className="mr-2">
                        {getPlayerEmoji(player as any)}
                      </span>
                      {player.name}
                      {isMe && <span className="text-primary ml-2">(You)</span>}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold">{player.score}</div>
                    <div className="text-sm text-muted-foreground">points</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="game-card p-8 text-center max-w-md mx-auto">
            <p className="text-muted-foreground">No scores yet</p>
          </div>
        )}

        {/* Next round info */}
        <motion.div
          className="text-center"
          variants={gameVariants.pageTransition}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.8 }}
        >
          {quiz.currentRoundIndex + 1 < quiz.config.totalRounds ? (
            <div className="game-card p-4 max-w-md mx-auto bg-primary/10 border-primary/20">
              <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-primary font-semibold">
                Get ready for Round {quiz.currentRoundIndex + 2}!
              </p>
            </div>
          ) : (
            <div className="game-card p-4 max-w-md mx-auto bg-success/10 border-success/20">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-success font-semibold">
                Final results coming up!
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  function renderFinished() {
    return (
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <div className="text-8xl animate-bounce-subtle">🏆</div>
          <h2 className="text-4xl font-bold">Game Complete!</h2>
          <p className="text-xl text-muted-foreground">
            Thanks for playing, {typedMyPlayer.name}!
          </p>
        </div>

        {/* Your final score */}
        {leaderboard && (
          <div className="game-card p-8 max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-4">Your Final Score</h3>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">
                {typedMyPlayer.score} points
              </div>
              <div className="text-muted-foreground">
                Position:{" "}
                {leaderboard?.find((p) => p._id === typedMyPlayer._id)
                  ?.position || "N/A"}
              </div>
            </div>
          </div>
        )}

        {/* Full final leaderboard (scrollable) */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="game-card p-6 max-w-2xl mx-auto text-left">
            <h3 className="text-xl font-bold mb-4">Final Leaderboard</h3>
            <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
              {leaderboard.map((player) => {
                const isMe = player._id === typedMyPlayer._id;
                const position = player.position;
                return (
                  <div
                    key={player._id}
                    className={cn(
                      "p-3 rounded-lg border flex items-center gap-4",
                      isMe
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                        : "bg-card border-border",
                      position <= 3 && "bg-gradient-to-r",
                      position === 1 && "from-warning/20 to-warning/10",
                      position === 2 && "from-muted/30 to-muted/20",
                      position === 3 && "from-accent/20 to-accent/10"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
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
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-medium truncate",
                          isMe && "text-primary"
                        )}
                      >
                        <span className="mr-2">
                          {getPlayerEmoji(player as any)}
                        </span>
                        {player.name}
                        {isMe && (
                          <span className="ml-2 text-primary">(You)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{player.score}</div>
                      <div className="text-xs text-muted-foreground">
                        points
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Play again / CTA */}
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          <Button
            asChild
            size="lg"
            className="text-lg px-8 py-6 transition-transform hover:scale-105 hover:shadow-lg"
          >
            <a href="/quizzes">Create Quiz</a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6 transition-transform hover:scale-105 hover:shadow-md"
          >
            <a href="/join">Join Game</a>
          </Button>
        </div>

        {/* Breakdown CTA */}
        <div className="max-w-2xl mx-auto">
          <div className="game-card p-6 text-left space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Your Breakdown</h3>
              <Button
                onClick={() => setShowBreakdown((v) => !v)}
                size="sm"
                className="game-button"
              >
                {showBreakdown ? "Hide" : "View"}
              </Button>
            </div>
            {showBreakdown && (
              <div className="space-y-4">
                {playerBreakdown === undefined && (
                  <div className="text-sm text-muted-foreground">
                    Loading your results…
                  </div>
                )}
                {playerBreakdown && (
                  <>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="px-2 py-1 rounded bg-secondary">
                        Questions: {playerBreakdown.totals.totalQuestions}
                      </span>
                      <span className="px-2 py-1 rounded bg-secondary">
                        Answered: {playerBreakdown.totals.totalAnswered}
                      </span>
                      <span className="px-2 py-1 rounded bg-secondary">
                        Correct: {playerBreakdown.totals.totalCorrect}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-2">
                      {playerBreakdown.rounds.map((r) => (
                        <div
                          key={r.roundIndex}
                          className={cn(
                            "p-4 rounded-lg border",
                            r.answered
                              ? r.isCorrect
                                ? "bg-success/10 border-success/20"
                                : "bg-destructive/10 border-destructive/20"
                              : "bg-muted/20 border-muted/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                Round {r.roundIndex + 1}
                              </p>
                              <p className="font-semibold truncate">
                                {r.question || "Question"}
                              </p>
                            </div>
                            <div
                              className={cn(
                                "text-xs font-semibold px-2 py-1 rounded",
                                r.answered
                                  ? r.isCorrect
                                    ? "bg-success text-success-foreground"
                                    : "bg-destructive text-destructive-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {r.answered
                                ? r.isCorrect
                                  ? "Correct"
                                  : "Wrong"
                                : "No Answer"}
                            </div>
                          </div>
                          <div className="mt-2 text-sm grid gap-1">
                            {r.correctAnswerText && (
                              <div className="text-success">
                                Correct: {r.correctAnswerText}
                              </div>
                            )}
                            {r.selectedAnswerText && (
                              <div className="text-muted-foreground">
                                Your answer: {r.selectedAnswerText}
                              </div>
                            )}
                            {!r.selectedAnswerText && !r.answered && (
                              <div className="text-muted-foreground">
                                You didn't answer
                              </div>
                            )}
                            {r.detailText && (
                              <div className="text-muted-foreground">
                                {r.detailText}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderDefault() {
    return (
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <Clock className="w-20 h-20 mx-auto text-muted-foreground animate-pulse" />
          <h2 className="text-3xl font-bold">Game in Progress</h2>
          <p className="text-xl text-muted-foreground">
            Something exciting is happening...
          </p>
        </div>
      </div>
    );
  }
}

export function GamePlayerView({ quizId }: GamePlayerViewProps) {
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
  const liveData = useQuery(
    api.quizzes.getQuizLive,
    quiz?.joinCode ? { joinCode: quiz.joinCode } : "skip"
  );

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
            transition={useGameTransition("default")}
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

  // Only render the main content when we have both quiz and liveData
  if (!liveData) {
    return (
      <AnimatedBackground variant="default" intensity="low">
        <div className="game-screen flex items-center justify-center">
          <LoaderContainer />
        </div>
      </AnimatedBackground>
    );
  }

  return (
    <GamePlayerContent
      quiz={quiz}
      liveData={liveData}
      deviceFingerprint={deviceFingerprint}
    />
  );
}
