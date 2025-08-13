import { evalite } from "evalite";
import { Levenshtein } from "autoevals";

// Minimal example eval to bootstrap the UI per docs
// https://www.evalite.dev/quickstart/
export default evalite("Hello World Eval", {
  data: async () => {
    return [{ input: "Hello", expected: "Hello World!" }];
  },
  task: async (input: string) => {
    return `${input} World!`;
  },
  scorers: [Levenshtein],
});
