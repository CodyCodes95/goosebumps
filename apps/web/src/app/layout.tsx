import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import Header from "@/components/header";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import FaultyTerminal from "@/components/FaultyTerminal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goosebumps Games",
  description:
    "Create engaging quiz experiences where players submit questions and AI generates answers. Like Kahoot meets AI-powered trivia for groups, classrooms, and events.",
  keywords:
    "quiz, trivia, interactive, AI, multiplayer, game, education, classroom, group activity",
  authors: [{ name: "Cody" }],
  openGraph: {
    title: "Goosebumps Games",
    description:
      "Create engaging quiz experiences where players submit questions and AI generates answers. Like Kahoot meets AI-powered trivia.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Goosebumps Games",
    description:
      "Create engaging quiz experiences where players submit questions and AI generates answers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="grid grid-rows-[auto_1fr] min-h-svh relative">
            <Header />
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                zIndex: 0,
              }}
            >
              <FaultyTerminal
                scale={50}
                gridMul={[2, 1]}
                digitSize={2}
                timeScale={1}
                pause={false}
                scanlineIntensity={1}
                glitchAmount={1}
                flickerAmount={1}
                noiseAmp={1}
                chromaticAberration={0}
                dither={0}
                curvature={0.1}
                tint="#00623A"
                mouseReact={true}
                mouseStrength={0.5}
                pageLoadAnimation={true}
                brightness={0.5}
              />
            </div>
            <div className="z-1">{children}</div>
          </div>
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
