"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Transition } from "framer-motion";

type MotionConfig = {
  // Spring configurations for different interaction types
  springs: {
    default: Transition;
    gentle: Transition;
    bouncy: Transition;
    fast: Transition;
  };
  // Duration presets
  durations: {
    fast: number;
    normal: number;
    slow: number;
    slower: number;
  };
  // Reduced motion state
  prefersReducedMotion: boolean;
  // Game-specific animation settings
  gameAnimations: {
    countdownDuration: number;
    cardFlipDuration: number;
    scoreboardDelay: number;
    confettiDuration: number;
  };
};

const defaultMotionConfig: MotionConfig = {
  springs: {
    default: {
      type: "spring",
      stiffness: 320,
      damping: 28,
      mass: 1,
    },
    gentle: {
      type: "spring",
      stiffness: 200,
      damping: 30,
      mass: 1,
    },
    bouncy: {
      type: "spring",
      stiffness: 420,
      damping: 24,
      mass: 0.8,
    },
    fast: {
      type: "spring",
      stiffness: 500,
      damping: 30,
      mass: 0.6,
    },
  },
  durations: {
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
  },
  prefersReducedMotion: false,
  gameAnimations: {
    countdownDuration: 1000, // 1 second per countdown number
    cardFlipDuration: 600, // Answer card reveal
    scoreboardDelay: 300, // Delay between scoreboard entries
    confettiDuration: 3000, // Confetti celebration duration
  },
};

const MotionContext = createContext<MotionConfig>(defaultMotionConfig);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Performance monitoring
  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;
    let currentPerformanceMode = performanceMode; // Capture current value

    const checkPerformance = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        // Enable performance mode if FPS is consistently low
        if (fps < 45 && !currentPerformanceMode) {
          setPerformanceMode(true);
          currentPerformanceMode = true;
        } else if (fps > 55 && currentPerformanceMode) {
          // Disable performance mode if FPS improves
          setPerformanceMode(false);
          currentPerformanceMode = false;
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(checkPerformance);
    };

    // Only monitor performance in development or when explicitly enabled
    if (process.env.NODE_ENV === "development") {
      animationId = requestAnimationFrame(checkPerformance);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []); // Remove performanceMode dependency to prevent infinite loop

  // Adjust motion config based on reduced motion preference and performance
  const shouldReduceMotion = prefersReducedMotion || performanceMode;

  const motionConfig: MotionConfig = {
    ...defaultMotionConfig,
    prefersReducedMotion: shouldReduceMotion,
    springs: shouldReduceMotion
      ? {
          // Use instant transitions for reduced motion or performance mode
          default: { duration: 0.01 },
          gentle: { duration: 0.01 },
          bouncy: { duration: 0.01 },
          fast: { duration: 0.01 },
        }
      : performanceMode
        ? {
            // Use simpler springs for performance mode
            default: { duration: 0.2 },
            gentle: { duration: 0.15 },
            bouncy: { duration: 0.25 },
            fast: { duration: 0.1 },
          }
        : defaultMotionConfig.springs,
    durations: shouldReduceMotion
      ? {
          fast: 10,
          normal: 10,
          slow: 10,
          slower: 10,
        }
      : performanceMode
        ? {
            fast: 100,
            normal: 150,
            slow: 200,
            slower: 300,
          }
        : defaultMotionConfig.durations,
    gameAnimations: shouldReduceMotion
      ? {
          countdownDuration: 100,
          cardFlipDuration: 50,
          scoreboardDelay: 50,
          confettiDuration: 100,
        }
      : performanceMode
        ? {
            countdownDuration: 800,
            cardFlipDuration: 400,
            scoreboardDelay: 200,
            confettiDuration: 2000,
          }
        : defaultMotionConfig.gameAnimations,
  };

  return (
    <MotionContext.Provider value={motionConfig}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion() {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error("useMotion must be used within a MotionProvider");
  }
  return context;
}

// Convenience hooks for common animation patterns
export function useGameTransition(
  type: keyof MotionConfig["springs"] = "default"
) {
  const { springs, prefersReducedMotion } = useMotion();

  if (prefersReducedMotion) {
    return { duration: 0.01 };
  }

  return springs[type];
}

export function useGameDuration(
  type: keyof MotionConfig["durations"] = "normal"
) {
  const { durations, prefersReducedMotion } = useMotion();

  if (prefersReducedMotion) {
    return 10; // 10ms for reduced motion
  }

  return durations[type];
}

// Animation variants for common game UI patterns
export const gameVariants = {
  // Page/screen transitions
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },

  // Card entrance animations
  cardEntrance: {
    initial: { opacity: 0, scale: 0.8, y: 50 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: -50 },
  },

  // Answer card selection
  answerCard: {
    idle: { scale: 1, rotateZ: 0 },
    hover: { scale: 1.02, rotateZ: -1 },
    selected: { scale: 1.05, rotateZ: 0 },
    correct: { scale: 1.1, rotateZ: 2 },
    incorrect: { scale: 0.95, rotateZ: -2 },
  },

  // Countdown animations
  countdown: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    pulse: {
      scale: 1.1,
      opacity: 0.9,
      transition: {
        type: "tween",
        duration: 0.8,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut",
      },
    },
    exit: { scale: 0, opacity: 0 },
  },

  // Scoreboard entries
  scoreboardEntry: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  },

  // Button interactions
  gameButton: {
    idle: { scale: 1, y: 0 },
    hover: { scale: 1.02, y: -2 },
    tap: { scale: 0.98, y: 0 },
  },

  // Floating elements (like particles)
  float: {
    animate: {
      y: [-10, 10, -10],
      transition: {
        type: "tween",
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
};
