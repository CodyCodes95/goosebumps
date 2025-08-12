"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "./theme-provider";
import { MotionProvider } from "./motion-provider";
import { AudioProvider } from "./game/audio-manager";
import { Toaster } from "./ui/sonner";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { env } from "@/env";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <MotionProvider>
        <AudioProvider>
          <ClerkProvider>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              {children}
            </ConvexProviderWithClerk>
          </ClerkProvider>
          <Toaster richColors />
        </AudioProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
