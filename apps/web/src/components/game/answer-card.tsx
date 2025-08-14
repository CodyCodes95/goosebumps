"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, Zap, Heart, Clover } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameTransition, gameVariants } from "@/components/motion-provider";
import { useGameSounds } from "./audio-manager";
import type { LucideIcon } from "lucide-react";

export type AnswerOption = {
  id: string;
  text: string;
  isCorrect?: boolean;
};

type AnswerCardVariant = "star" | "bolt" | "heart" | "clover";

type AnswerCardProps = {
  option: AnswerOption;
  variant: AnswerCardVariant;
  index: number;
  isSelected?: boolean;
  isRevealed?: boolean;
  isCorrect?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  className?: string;
};

const cardConfig: Record<
  AnswerCardVariant,
  {
    icon: LucideIcon;
    bgColor: string;
    textColor: string;
    hoverColor: string;
    selectedColor: string;
    correctColor: string;
    incorrectColor: string;
  }
> = {
  star: {
    icon: Star,
    bgColor: "bg-answer-star",
    textColor: "text-answer-star-foreground",
    hoverColor: "hover:bg-answer-star/90",
    selectedColor: "bg-answer-star/80",
    correctColor: "bg-success game-glow-success",
    incorrectColor: "bg-muted/50 opacity-60",
  },
  bolt: {
    icon: Zap,
    bgColor: "bg-answer-bolt",
    textColor: "text-answer-bolt-foreground",
    hoverColor: "hover:bg-answer-bolt/90",
    selectedColor: "bg-answer-bolt/80",
    correctColor: "bg-success game-glow-success",
    incorrectColor: "bg-muted/50 opacity-60",
  },
  heart: {
    icon: Heart,
    bgColor: "bg-answer-heart",
    textColor: "text-answer-heart-foreground",
    hoverColor: "hover:bg-answer-heart/90",
    selectedColor: "bg-answer-heart/80",
    correctColor: "bg-success game-glow-success",
    incorrectColor: "bg-muted/50 opacity-60",
  },
  clover: {
    icon: Clover,
    bgColor: "bg-answer-clover",
    textColor: "text-answer-clover-foreground",
    hoverColor: "hover:bg-answer-clover/90",
    selectedColor: "bg-answer-clover/80",
    correctColor: "bg-success game-glow-success",
    incorrectColor: "bg-muted/50 opacity-60",
  },
};

export const AnswerCard = React.memo(function AnswerCard({
  option,
  variant,
  index,
  isSelected = false,
  isRevealed = false,
  isCorrect = false,
  isLocked = false,
  onClick,
  className,
}: AnswerCardProps) {
  const transition = useGameTransition("default");
  const { playSelect, playCorrect, playIncorrect } = useGameSounds();
  const config = cardConfig[variant];
  const Icon = config.icon;

  // Play sound effects when answer is revealed
  React.useEffect(() => {
    if (isRevealed && isSelected) {
      const timer = setTimeout(() => {
        if (isCorrect) {
          playCorrect();
        } else {
          playIncorrect();
        }
      }, 300); // Small delay for dramatic effect

      return () => clearTimeout(timer);
    }
  }, [isRevealed, isSelected, isCorrect, playCorrect, playIncorrect]);

  const getCardState = () => {
    if (isRevealed && isCorrect) return "correct";
    if (isRevealed && !isCorrect) return "incorrect";
    if (isSelected) return "selected";
    return "idle";
  };

  const cardState = getCardState();

  const getBackgroundClass = () => {
    if (isRevealed && isCorrect) return config.correctColor;
    if (isRevealed && !isCorrect) return config.incorrectColor;
    if (isSelected) return config.selectedColor;
    return config.bgColor;
  };

  const getTextClass = () => {
    if (isRevealed && !isCorrect) return "text-muted-foreground";
    return config.textColor;
  };

  return (
    <motion.button
      className={cn(
        "relative w-full min-h-[120px] rounded-2xl border-2 border-transparent",
        "flex flex-col items-center justify-center gap-3 p-6",
        "font-bold text-lg leading-tight",
        "transition-all duration-200 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2",
        "disabled:cursor-not-allowed",
        "game-button",
        getBackgroundClass(),
        getTextClass(),
        !isLocked && !isRevealed && config.hoverColor,
        className
      )}
      aria-label={`Answer option: ${option.text}${isSelected ? " (selected)" : ""}${isRevealed && isCorrect ? " (correct)" : isRevealed && !isCorrect ? " (incorrect)" : ""}`}
      aria-pressed={isSelected}
      aria-disabled={isLocked}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      variants={gameVariants.answerCard}
      initial="idle"
      animate={cardState}
      transition={transition}
      whileHover={!isLocked && !isRevealed ? "hover" : undefined}
      whileTap={!isLocked && !isRevealed ? "tap" : undefined}
      onClick={() => {
        if (!isLocked && !isRevealed) {
          playSelect();
          onClick?.();
        }
      }}
      disabled={isLocked}
      style={{
        // Add delay based on index for staggered entrance
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Icon */}
      <motion.div
        className="flex items-center justify-center"
        animate={isSelected ? { rotate: [0, -10, 10, 0] } : {}}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Icon
          className="w-8 h-8"
          fill={
            isSelected || (isRevealed && isCorrect) ? "currentColor" : "none"
          }
        />
      </motion.div>

      {/* Answer text */}
      <motion.span
        className="text-center break-words"
        animate={isSelected ? { scale: [1, 1.02, 1] } : {}}
        transition={{ type: "tween", duration: 0.2 }}
      >
        {option.text}
      </motion.span>

      {/* Selection indicator */}
      {isSelected && !isRevealed && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-white/40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      )}

      {/* Correct answer indicator */}
      {isRevealed && isCorrect && (
        <motion.div
          className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: "backOut" }}
        >
          <Star
            className="w-4 h-4 text-success-foreground"
            fill="currentColor"
          />
        </motion.div>
      )}

      {/* Shimmer effect for locked state */}
      {isLocked && (
        <div className="absolute inset-0 rounded-2xl animate-shimmer" />
      )}
    </motion.button>
  );
});

// Container for all answer cards with staggered animation
export const AnswerGrid = React.memo(function AnswerGrid({
  options,
  selectedOptionId,
  isRevealed = false,
  isLocked = false,
  onSelectOption,
  className,
}: {
  options: AnswerOption[];
  selectedOptionId?: string;
  isRevealed?: boolean;
  isLocked?: boolean;
  onSelectOption?: (optionId: string) => void;
  className?: string;
}) {
  const variants = ["star", "bolt", "heart", "clover"] as const;
  const transition = useGameTransition("gentle");

  return (
    <motion.div
      className={cn(
        // Force 2x2 grid on small screens to fit all answers without scroll
        // and tighten gaps. Revert to 2 columns on md+.
        "grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-4xl mx-auto",
        className
      )}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {options.map((option, index) => (
        <motion.div
          key={option.id}
          variants={gameVariants.cardEntrance}
          transition={transition}
        >
          <AnswerCard
            option={option}
            variant={variants[index % 4]}
            index={index}
            isSelected={selectedOptionId === option.id}
            isRevealed={isRevealed}
            isCorrect={option.isCorrect}
            isLocked={isLocked}
            onClick={() => onSelectOption?.(option.id)}
            className="min-h-[88px] p-4 text-base md:min-h-[120px] md:p-6 md:text-lg"
          />
        </motion.div>
      ))}
    </motion.div>
  );
});
