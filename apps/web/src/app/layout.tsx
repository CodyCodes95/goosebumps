import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import Header from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goosebumps - Interactive Quiz Game Platform",
  description:
    "Create engaging quiz experiences where players submit questions and AI generates answers. Like Kahoot meets AI-powered trivia for groups, classrooms, and events.",
  keywords:
    "quiz, trivia, interactive, AI, multiplayer, game, education, classroom, group activity",
  authors: [{ name: "Goosebumps Team" }],
  openGraph: {
    title: "Goosebumps - Interactive Quiz Game Platform",
    description:
      "Create engaging quiz experiences where players submit questions and AI generates answers. Like Kahoot meets AI-powered trivia.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Goosebumps - Interactive Quiz Game Platform",
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
          <div className="grid grid-rows-[auto_1fr] h-svh">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
