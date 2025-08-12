"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useGameTransition, useMotion } from "@/components/motion-provider";
import { useGameSounds } from "./audio-manager";

type CountdownProps = {
  from: number;
  to?: number;
  onComplete?: () => void;
  onTick?: (currentNumber: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "text-6xl",
  md: "text-8xl",
  lg: "text-9xl",
  xl: "text-[12rem] leading-none",
};

const glowClasses = {
  sm: "shadow-[0_0_20px_currentColor]",
  md: "shadow-[0_0_40px_currentColor]",
  lg: "shadow-[0_0_60px_currentColor]",
  xl: "shadow-[0_0_100px_currentColor]",
};

export function Countdown({
  from,
  to = 0,
  onComplete,
  onTick,
  size = "xl",
  showGlow = true,
  className,
}: CountdownProps) {
  const [currentNumber, setCurrentNumber] = useState(from);
  const [isActive, setIsActive] = useState(false);
  const transition = useGameTransition("bouncy");
  const { gameAnimations, prefersReducedMotion } = useMotion();
  const { playTick } = useGameSounds();

  useEffect(() => {
    if (currentNumber <= to) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setCurrentNumber((prev) => prev - 1);
      onTick?.(currentNumber - 1);
      playTick(); // Play tick sound
    }, gameAnimations.countdownDuration);

    return () => clearTimeout(timer);
  }, [currentNumber, to, onComplete, onTick, gameAnimations.countdownDuration]);

  useEffect(() => {
    setIsActive(true);
  }, []);

  if (currentNumber <= to) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {currentNumber > to ? `${currentNumber}` : "Go!"}
      </div>

      {/* Background pulse effect */}
      <motion.div
        className="absolute inset-0 bg-primary/10"
        animate={
          showGlow && !prefersReducedMotion
            ? {
                opacity: [0, 0.3, 0],
                scale: [1, 1.1, 1],
              }
            : {}
        }
        transition={{
          type: "tween",
          duration: gameAnimations.countdownDuration / 1000,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* Countdown number */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentNumber}
          className={cn(
            "font-bold font-display text-primary select-none",
            "flex items-center justify-center",
            sizeClasses[size],
            showGlow && glowClasses[size]
          )}
          initial={{
            scale: 0,
            opacity: 0,
            rotateY: -90,
          }}
          animate={{
            scale: 1,
            opacity: 1,
            rotateY: 0,
          }}
          exit={{
            scale: 0,
            opacity: 0,
            rotateY: 90,
          }}
          transition={{
            ...transition,
            scale: {
              type: "tween",
              duration: 0.6,
              ease: [0.34, 1.56, 0.64, 1], // Custom easing for bounce effect
            },
          }}
        >
          {currentNumber}
        </motion.div>
      </AnimatePresence>

      {/* Ripple effect */}
      {showGlow && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          key={`ripple-${currentNumber}`}
        >
          <motion.div
            className="w-32 h-32 border-2 border-primary/30 rounded-full"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{
              duration: gameAnimations.countdownDuration / 1000,
              ease: "easeOut",
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

// Timer countdown component for question time limits
export function TimerCountdown({
  timeLeft,
  totalTime,
  onComplete,
  size = "md",
  showProgress = true,
  className,
}: {
  timeLeft: number;
  totalTime: number;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  className?: string;
}) {
  const transition = useGameTransition("fast");
  const { prefersReducedMotion } = useMotion();

  const progress = (timeLeft / totalTime) * 100;
  const isUrgent = timeLeft <= 5;
  const isCritical = timeLeft <= 2;

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
    }
  }, [timeLeft, onComplete]);

  const sizeStyles = {
    sm: "w-16 h-16 text-lg",
    md: "w-24 h-24 text-2xl",
    lg: "w-32 h-32 text-4xl",
  };

  return (
    <div className={cn("relative", className)}>
      {/* Circular progress */}
      {showProgress && (
        <svg
          className="absolute inset-0 -rotate-90 drop-shadow-lg"
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className={cn(
              "transition-colors duration-300",
              isCritical
                ? "text-destructive"
                : isUrgent
                  ? "text-warning"
                  : "text-primary"
            )}
            style={{
              strokeDasharray: "283", // 2π * 45
              strokeDashoffset: `${283 - (progress / 100) * 283}`,
            }}
            animate={
              isCritical && !prefersReducedMotion
                ? {
                    strokeWidth: [6, 8, 6],
                  }
                : {}
            }
            transition={{
              type: "tween",
              duration: 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </svg>
      )}

      {/* Timer display */}
      <motion.div
        className={cn(
          "flex items-center justify-center rounded-full",
          "font-bold font-display text-foreground",
          "border-2 border-border/20 bg-card/50 backdrop-blur-sm",
          sizeStyles[size],
          isCritical && "game-glow-accent",
          isUrgent && !isCritical && "game-glow-primary"
        )}
        animate={
          isCritical && !prefersReducedMotion
            ? {
                scale: [1, 1.05, 1],
              }
            : {}
        }
        transition={{
          type: "tween",
          duration: 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {timeLeft}
      </motion.div>
    </div>
  );
}

// Progress bar for phases
export function PhaseProgress({
  currentPhase,
  totalPhases,
  phaseNames = [],
  className,
}: {
  currentPhase: number;
  totalPhases: number;
  phaseNames?: string[];
  className?: string;
}) {
  const progress = (currentPhase / totalPhases) * 100;
  const transition = useGameTransition("gentle");

  return (
    <div className={cn("w-full max-w-md", className)}>
      {/* Phase indicator */}
      {phaseNames.length > 0 && (
        <motion.div
          className="text-sm text-muted-foreground text-center mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
        >
          {phaseNames[currentPhase - 1]} ({currentPhase} of {totalPhases})
        </motion.div>
      )}

      {/* Progress bar */}
      <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={transition}
        />

        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
    </div>
  );
}
