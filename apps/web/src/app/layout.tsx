import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import Header from "@/components/header";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import RouteBackground from "@/components/route-background";

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
      <head>
        <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <RouteBackground>
            <div className="grid grid-rows-[auto_1fr] min-h-svh">
              <Header />
              {children}
            </div>
          </RouteBackground>
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
