"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/components/motion-provider";

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  direction: number;
  opacity: number;
};

type AnimatedBackgroundProps = {
  variant?: "default" | "celebration" | "countdown" | "lobby";
  intensity?: "low" | "medium" | "high";
  className?: string;
  children?: React.ReactNode;
};

const gradientConfigs = {
  default: {
    background:
      "linear-gradient(135deg, var(--background) 0%, var(--background-secondary) 100%)",
    overlay:
      "radial-gradient(circle at 20% 80%, var(--primary)/0.1 0%, transparent 50%)",
  },
  celebration: {
    background:
      "linear-gradient(135deg, var(--background) 0%, var(--success)/0.1 50%, var(--accent)/0.1 100%)",
    overlay:
      "radial-gradient(circle at 50% 50%, var(--success)/0.2 0%, transparent 70%)",
  },
  countdown: {
    background:
      "linear-gradient(135deg, var(--background) 0%, var(--primary)/0.1 50%, var(--accent)/0.1 100%)",
    overlay:
      "radial-gradient(circle at 50% 50%, var(--primary)/0.3 0%, transparent 50%)",
  },
  lobby: {
    background:
      "linear-gradient(135deg, var(--background) 0%, var(--background-secondary) 50%, var(--primary)/0.05 100%)",
    overlay:
      "radial-gradient(circle at 80% 20%, var(--accent)/0.1 0%, transparent 50%)",
  },
};

function generateParticles(count: number, variant: string): Particle[] {
  const colors =
    variant === "celebration"
      ? ["var(--success)", "var(--warning)", "var(--accent)", "var(--primary)"]
      : ["var(--primary)", "var(--accent)", "var(--muted)"];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 2 + 0.5,
    direction: Math.random() * 360,
    opacity: Math.random() * 0.6 + 0.2,
  }));
}

function ParticleSystem({
  variant,
  intensity,
  isVisible,
}: {
  variant: string;
  intensity: string;
  isVisible: boolean;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const { prefersReducedMotion } = useMotion();

  const baseParticleCount = {
    low: 10,
    medium: 20,
    high: 35,
  }[intensity];

  // Reduce particle count based on performance
  const particleCount = prefersReducedMotion ? 0 : baseParticleCount;

  useEffect(() => {
    if (prefersReducedMotion || !isVisible) {
      setParticles([]);
      return;
    }

    setParticles(generateParticles(particleCount || 0, variant));
  }, [variant, intensity, isVisible, prefersReducedMotion, particleCount]);

  useEffect(() => {
    if (prefersReducedMotion || !isVisible || particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: (particle.x + Math.cos(particle.direction) * particle.speed) % 100,
          y: (particle.y + Math.sin(particle.direction) * particle.speed) % 100,
          direction: particle.direction + (Math.random() - 0.5) * 0.1,
        }))
      );
    }, 100);

    return () => clearInterval(interval);
  }, [particles, prefersReducedMotion, isVisible]);

  if (prefersReducedMotion || !isVisible) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [
              particle.opacity,
              particle.opacity * 0.5,
              particle.opacity,
            ],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function AnimatedBackground({
  variant = "default",
  intensity = "medium",
  className,
  children,
}: AnimatedBackgroundProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { prefersReducedMotion } = useMotion();
  const config = gradientConfigs[variant];

  // Pause animations when tab is not visible for performance
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Base gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{ background: config.background }}
        animate={
          !prefersReducedMotion && isVisible
            ? {
                backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
              }
            : {}
        }
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Overlay gradient that shifts */}
      <motion.div
        className="absolute inset-0"
        style={{ background: config.overlay }}
        animate={
          !prefersReducedMotion && isVisible
            ? {
                backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
              }
            : {}
        }
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear",
          delay: 5,
        }}
      />

      {/* Particle system */}
      <ParticleSystem
        variant={variant}
        intensity={intensity}
        isVisible={isVisible}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Celebration confetti component
export function ConfettiExplosion({
  isActive,
  duration = 3000,
  onComplete,
}: {
  isActive: boolean;
  duration?: number;
  onComplete?: () => void;
}) {
  const [confetti, setConfetti] = useState<Particle[]>([]);
  const { prefersReducedMotion } = useMotion();

  useEffect(() => {
    if (!isActive || prefersReducedMotion) return;

    // Generate confetti particles
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 20, // Start from center
      y: 50 + (Math.random() - 0.5) * 20,
      size: Math.random() * 8 + 4,
      color: [
        "var(--success)",
        "var(--warning)",
        "var(--accent)",
        "var(--primary)",
      ][Math.floor(Math.random() * 4)],
      speed: Math.random() * 5 + 3,
      direction: Math.random() * 360,
      opacity: 1,
    }));

    setConfetti(particles);

    // Clean up after duration
    const cleanup = setTimeout(() => {
      setConfetti([]);
      onComplete?.();
    }, duration || 3000);

    return () => clearTimeout(cleanup);
  }, [isActive, duration, onComplete, prefersReducedMotion]);

  if (prefersReducedMotion || !isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confetti.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            backgroundColor: particle.color,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
          initial={{
            x: `${particle.x}vw`,
            y: `${particle.y}vh`,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            x: `${particle.x + Math.cos(particle.direction) * 50}vw`,
            y: `${particle.y + Math.sin(particle.direction) * 50 + 100}vh`,
            rotate: 720,
            opacity: 0,
          }}
          transition={{
            duration: (duration || 3000) / 1000,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
