import { evalite } from "evalite";
import { Factuality } from "./factuality";
import { askTriviaAgent } from "../lib/agent";

// Minimal example eval to bootstrap the UI per docs
// https://www.evalite.dev/quickstart/
export default evalite("Trivia Eval", {
  data: async (): Promise<{ input: string; expected: string }[]> => {
    return [
      { input: "Who won 2024 geoguessr world cup?", expected: "Blinky" },
      {
        input: "How did edward become a vampire?",
        expected: "He was bitten by Carlisle",
      },
    ];
  },
  task: async (input) => {
    const answers = await askTriviaAgent({
      promptText: input,
    });

    return answers.correct;
  },
  scorers: [Factuality],
});

// who won 2024 geoguessr world cup
// how did edward become a vampire
