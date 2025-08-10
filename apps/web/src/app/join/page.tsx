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

      <div className="flex flex-col gap-4">
        {/* Join form will be implemented in Milestone 4 */}
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Join form coming in Milestone 4...
          </p>
        </div>
      </div>
    </div>
  );
}
