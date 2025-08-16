"use client";

import { usePathname } from "next/navigation";
import { AnimatedBackground } from "./game/animated-background";
import type { ReactNode } from "react";

export function RouteBackground({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";

  const isGame =
    pathname.startsWith("/play/") || pathname.startsWith("/present/");
  const isJoin = pathname.startsWith("/join");

  const intensity: "low" | "medium" | "high" = isGame
    ? "high"
    : isJoin
      ? "medium"
      : "low";

  return (
    <AnimatedBackground variant="default" intensity={intensity}>
      {children}
    </AnimatedBackground>
  );
}

export default RouteBackground;
