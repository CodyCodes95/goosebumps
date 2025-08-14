import { evalite } from "evalite";
import { Factuality } from "./factuality";

// Minimal example eval to bootstrap the UI per docs
// https://www.evalite.dev/quickstart/
export default evalite("Trivia Eval", {
  data: async (): Promise<{ input: string; expected: string }[]> => {
    return [{ input: "Who won 2024 geoguessr world cup?", expected: "Blinky" }];
  },
  task: async (input) => {
    return `${input} World!`;
  },
  scorers: [Factuality],
});

// who won 2024 geoguessr world cup
// how did edward become a vampire
