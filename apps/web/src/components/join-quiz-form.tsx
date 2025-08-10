"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Loader from "./loader";
import { toast } from "sonner";

export function JoinQuizForm() {
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!joinCode.trim()) {
      toast.error("Please enter a join code");
      return;
    }

    setIsSubmitting(true);

    try {
      // Clean and validate the join code
      const cleanCode = joinCode.trim().toUpperCase();

      // Simple validation - 6 characters, alphanumeric
      if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
        toast.error(
          "Join code must be 6 characters (letters and numbers only)"
        );
        return;
      }

      // Navigate to the join code specific page
      router.push(`/join/${cleanCode}`);
    } catch (error) {
      toast.error("Failed to join quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-format to uppercase and limit to 6 characters
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setJoinCode(value);
  };

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4">
      <CardHeader>
        <CardTitle>Enter Join Code</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="joinCode">Quiz Code</Label>
            <Input
              id="joinCode"
              type="text"
              placeholder="ABC123"
              value={joinCode}
              onChange={handleJoinCodeChange}
              className="text-center font-mono text-lg tracking-wider transition-all duration-200 focus:scale-[1.02]"
              disabled={isSubmitting}
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-character code from your quiz host
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!joinCode.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader className="w-4 h-4 mr-2" />
                Joining...
              </>
            ) : (
              "Join Quiz"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Have a direct link?
          </p>
          <p className="text-xs text-muted-foreground">
            Click on the link shared by your quiz host to join directly
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
