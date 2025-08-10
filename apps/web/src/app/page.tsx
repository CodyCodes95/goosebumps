import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-fade-in-up">
              Interactive Quiz Experience
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in-up [animation-delay:0.2s]">
              Players submit questions, AI generates answers. Real-time
              participation meets intelligent content creation.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up [animation-delay:0.4s]">
            <Button
              asChild
              size="lg"
              className="text-lg px-8 py-6 transition-transform hover:scale-105 hover:shadow-lg"
            >
              <Link href="/quizzes">Create Quiz</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 transition-transform hover:scale-105 hover:shadow-md"
            >
              <Link href="/join">Join Game</Link>
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card className="p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in-up [animation-delay:0.6s]">
              <div className="text-3xl mb-4 animate-bounce-subtle">🎯</div>
              <h3 className="text-lg font-semibold mb-2">
                Player-Driven Questions
              </h3>
              <p className="text-sm text-muted-foreground">
                Participants submit their own questions, making each game unique
                and engaging.
              </p>
            </Card>

            <Card className="p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in-up [animation-delay:0.8s]">
              <div className="text-3xl mb-4 animate-bounce-subtle [animation-delay:0.2s]">
                🤖
              </div>
              <h3 className="text-lg font-semibold mb-2">
                AI-Generated Answers
              </h3>
              <p className="text-sm text-muted-foreground">
                Smart AI creates plausible multiple-choice answers for any
                question topic.
              </p>
            </Card>

            <Card className="p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in-up [animation-delay:1s]">
              <div className="text-3xl mb-4 animate-bounce-subtle [animation-delay:0.4s]">
                ⚡
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-Time Fun</h3>
              <p className="text-sm text-muted-foreground">
                Live scoring, instant feedback, and seamless multiplayer
                experience.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-muted/30 py-16">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-12 animate-fade-in-up">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center animate-fade-in-up [animation-delay:0.2s]">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mb-4 transition-transform hover:scale-110 hover:shadow-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Create or Join</h3>
              <p className="text-sm text-muted-foreground">
                Host creates a quiz, players join with a simple code.
              </p>
            </div>

            <div className="flex flex-col items-center animate-fade-in-up [animation-delay:0.4s]">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mb-4 transition-transform hover:scale-110 hover:shadow-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">Submit Questions</h3>
              <p className="text-sm text-muted-foreground">
                Selected players write questions on any topic they choose.
              </p>
            </div>

            <div className="flex flex-col items-center animate-fade-in-up [animation-delay:0.6s]">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mb-4 transition-transform hover:scale-110 hover:shadow-lg">
                3
              </div>
              <h3 className="font-semibold mb-2">AI Creates Answers</h3>
              <p className="text-sm text-muted-foreground">
                Smart AI generates realistic multiple-choice options.
              </p>
            </div>

            <div className="flex flex-col items-center animate-fade-in-up [animation-delay:0.8s]">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mb-4 transition-transform hover:scale-110 hover:shadow-lg">
                4
              </div>
              <h3 className="font-semibold mb-2">Play & Score</h3>
              <p className="text-sm text-muted-foreground">
                Everyone answers, see results, and compete for the top score!
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
