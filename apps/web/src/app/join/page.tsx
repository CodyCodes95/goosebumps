import { JoinQuizForm } from "../../components/join-quiz-form";

// Anonymous route - no auth required
export default function JoinPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-md mx-auto">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold">Join a Quiz</h1>
        <p className="text-muted-foreground">
          Enter a quiz code to join the fun!
        </p>
      </div>

      <JoinQuizForm />
    </div>
  );
}
