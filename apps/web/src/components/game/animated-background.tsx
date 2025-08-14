"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/components/motion-provider";

type Variant = "default" | "celebration" | "countdown" | "lobby";
type Intensity = "low" | "medium" | "high";

type AnimatedBackgroundProps = {
  variant?: Variant;
  intensity?: Intensity;
  className?: string;
  children?: ReactNode;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  pulse: number;
};

type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
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
} as const;

const VARIANT_COLOR_VARS: Record<Variant, string[]> = {
  default: ["--primary", "--accent", "--muted"],
  celebration: ["--success", "--warning", "--accent", "--primary"],
  countdown: ["--primary", "--accent"],
  lobby: ["--primary", "--accent", "--muted"],
};

const INTENSITY_COUNT: Record<Intensity, number> = {
  low: 30,
  medium: 60,
  high: 120,
};

const GRID_SPACING_PX: Record<Intensity, number> = {
  low: 56,
  medium: 44,
  high: 36,
};

function resolveCssVar(name: string): string {
  if (typeof window === "undefined") return "#ffffff";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || "").trim() || "#ffffff";
}

function getResolvedColors(variant: Variant): string[] {
  const vars = VARIANT_COLOR_VARS[variant] || VARIANT_COLOR_VARS.default;
  return vars.map((v) => resolveCssVar(v));
}

function CanvasParticles({
  variant = "default",
  intensity = "medium",
  isVisible = true,
}: {
  variant?: Variant;
  intensity?: Intensity;
  isVisible?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tsRef = useRef<number>(0);
  const { prefersReducedMotion } = useMotion();

  const targetCount = useMemo(() => {
    if (prefersReducedMotion) return 0;
    return INTENSITY_COUNT[intensity];
  }, [intensity, prefersReducedMotion]);

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth, clientHeight } = canvas;
    canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const regenerate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const colors = getResolvedColors(variant);
    const count = targetCount;

    const arr: Particle[] = Array.from({ length: count }, () => {
      const speed = 0.15 + Math.random() * 0.6; // px/ms
      const dir = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        size: 1 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.25 + Math.random() * 0.55,
        pulse: Math.random() * Math.PI * 2,
      };
    });

    particlesRef.current = arr;
  };

  useEffect(() => {
    resize();
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, targetCount]);

  useEffect(() => {
    const handleResize = () => {
      resize();
      regenerate();
    };

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;

    if (ro && canvasRef.current) {
      ro.observe(canvasRef.current);
    } else {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let running = true;

    const tick = (ts: number) => {
      if (!running) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;

      const prev = tsRef.current || ts;
      const dt = Math.min(32, ts - prev);
      tsRef.current = ts;

      ctx.clearRect(0, 0, w, h);

      const arr = particlesRef.current;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.pulse += 0.002 * dt;

        const drift = 0.0006 * dt;
        p.vx += (Math.random() - 0.5) * drift;
        p.vy += (Math.random() - 0.5) * drift;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        const scale = 0.9 + Math.sin(p.pulse) * 0.1;
        const size = p.size * scale;
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafRef.current != null) return;
      tsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      tsRef.current = 0;
    };

    const onVisibility = () => {
      if (document.hidden || !isVisible || prefersReducedMotion) stop();
      else start();
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [isVisible, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

function GridOverlay({
  variant = "default",
  intensity = "medium",
  isVisible = true,
}: {
  variant?: Variant;
  intensity?: Intensity;
  isVisible?: boolean;
}) {
  const colorVarName = useMemo(() => {
    const vars = VARIANT_COLOR_VARS[variant] || VARIANT_COLOR_VARS.default;
    return vars[0] || "--primary";
  }, [variant]);

  if (!isVisible) return null;

  const spacing = GRID_SPACING_PX[intensity];
  const animation = "t3-grid-pan 60s linear infinite";

  return (
    <div
      className="absolute inset-0 pointer-events-none will-change-transform"
      style={{
        color: `var(${colorVarName})`,
        opacity: 0.15,
        backgroundImage: `repeating-linear-gradient(0deg, currentColor 0px, currentColor 1px, transparent 1px, transparent ${spacing}px), repeating-linear-gradient(90deg, currentColor 0px, currentColor 1px, transparent 1px, transparent ${spacing}px)`,
        backgroundSize: `${spacing}px ${spacing}px, ${spacing}px ${spacing}px`,
        backgroundPosition: "0 0, 0 0",
        animation,
        WebkitMaskImage:
          "radial-gradient(70% 70% at 50% 50%, rgba(0,0,0,1) 40%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 100%)",
        maskImage:
          "radial-gradient(70% 70% at 50% 50%, rgba(0,0,0,1) 40%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 100%)",
      }}
    />
  );
}

export function AnimatedBackground({
  variant = "default",
  intensity = "medium",
  className,
  children,
}: AnimatedBackgroundProps) {
  const [isVisible, setIsVisible] = useState(true);
  const config = gradientConfigs[variant];

  useEffect(() => {
    const onVis = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden overflow-y-auto",
        className
      )}
    >
      <div
        className="absolute will-change-transform"
        style={{
          left: "-10%",
          top: "-10%",
          width: "120%",
          height: "120%",
          backgroundImage: config.background,
          transform: "translate3d(-3%, -3%, 0)",
          animation: "t3-bg-pan 60s linear infinite",
          backgroundSize: "160% 160%",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute will-change-transform mix-blend-normal"
        style={{
          left: "-10%",
          top: "-10%",
          width: "120%",
          height: "120%",
          backgroundImage: config.overlay,
          transform: "translate3d(3%, 3%, 0)",
          animation: "t3-bg-pan-rev 80s linear infinite 10s",
          backgroundSize: "180% 180%",
          pointerEvents: "none",
        }}
      />

      <GridOverlay
        variant={variant}
        intensity={intensity}
        isVisible={isVisible}
      />

      <div className="relative z-10">{children}</div>

      {/* keyframes moved to global CSS */}
    </div>
  );
}

export function ConfettiExplosion({
  isActive,
  duration = 3000,
  onComplete,
}: {
  isActive: boolean;
  duration?: number;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const confettiRef = useRef<Confetti[] | null>(null);
  const tsRef = useRef<number>(0);
  const { prefersReducedMotion } = useMotion();

  useEffect(() => {
    if (!isActive || prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setup();

    const colors = [
      resolveCssVar("--success"),
      resolveCssVar("--warning"),
      resolveCssVar("--accent"),
      resolveCssVar("--primary"),
    ];

    const W = canvas.clientWidth || 1;
    const H = canvas.clientHeight || 1;

    const count = 120;
    const arr: Confetti[] = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.8; // px/ms
      return {
        x: W * 0.5 + (Math.random() - 0.5) * 40,
        y: H * 0.35 + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: duration,
      };
    });

    confettiRef.current = arr;
    tsRef.current = performance.now();

    const gravity = 0.0016; // px/ms^2
    const drag = 0.0008;

    const tick = (ts: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const prev = tsRef.current || ts;
      const dt = Math.min(32, ts - prev);
      tsRef.current = ts;

      ctx.clearRect(0, 0, W, H);

      const items = confettiRef.current || [];
      let alive = 0;

      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        if (c.life <= 0) continue;

        c.vy += gravity * dt;
        c.vx *= 1 - drag * dt;
        c.vy *= 1 - drag * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        c.life -= dt;

        const alpha = Math.max(0, Math.min(1, c.life / duration));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size * 0.5, -c.size * 0.5, c.size, c.size * 0.6);
        ctx.restore();

        if (c.life > 0 && c.y < H + 20) alive++;
      }

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        confettiRef.current = null;
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    const onResize = () => setup();
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, [isActive, duration, onComplete, prefersReducedMotion]);

  if (!isActive || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
