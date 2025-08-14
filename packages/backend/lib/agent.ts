import { generateObject } from "ai";
import { z } from "zod";
import { model } from "./model";
import { performWebSearch } from "./serper";

export type WebSearchSnippet = {
  title: string;
  url: string;
  snippet: string;
};

export type SystemContext = {
  searchResults: Array<{
    query: string;
    results: WebSearchSnippet[];
  }>;
  stepCount: number;
  maxSteps: number;
  promptText: string;
};

export const triviaQuestionSchema = z.object({
  question: z.string().describe("The trivia question"),
  correct: z.string().describe("The correct answer"),
  distractors: z
    .array(z.string())
    .length(3)
    .describe("Three incorrect but plausible answers"),
});

export const triviaDetailSchema = z.object({
  detail: z
    .string()
    .describe(
      "A concise, human-friendly detail or fun fact expanding on the trivia question/answer (1-2 sentences)."
    ),
});

export const nextActionSchema = z.object({
  action: z
    .enum(["google-search", "generate-object"])
    .describe("The next action to take"),
  reasoning: z.string().describe("Why this action was chosen"),
  searchQuery: z
    .string()
    .optional()
    .describe("Search query if action is google-search"),
});

export type NextAction = z.infer<typeof nextActionSchema>;

export function buildSearchContext(
  searchResults: SystemContext["searchResults"]
): string {
  if (!searchResults || searchResults.length === 0) return "";
  const lines: string[] = [];
  for (const sr of searchResults) {
    for (const r of sr.results) {
      lines.push(`${r.title}: ${r.snippet}`);
    }
  }
  if (lines.length === 0) return "";
  return `\n\nAdditional context from web search:\n${lines.join("\n")}`;
}

export async function decideNextAction(args: {
  stepCount: number;
  maxSteps: number;
  searchResults: SystemContext["searchResults"];
  promptText: string;
}): Promise<NextAction> {
  const { object } = await generateObject({
    model: model,
    system: `You are a trivia question generator agent. Your job is to decide whether you can confidently create a trivia question based on the given prompt, or if you need to search for more current information first.

Current context:
- Step ${args.stepCount}/${args.maxSteps}
- Previous search results: ${JSON.stringify(args.searchResults, null, 2)}

Decision criteria:
- Choose "generate-object" if you have sufficient knowledge or if previous searches provided enough information
- Choose "google-search" if the topic requires current/recent information that you might not have (e.g., current events, recent developments, specific recent dates, latest statistics)
- If you've already searched and have relevant results, choose "generate-object"

Examples of topics that need search:
- "2024 Olympics winners"
- "Current president of [country]"  
- "Latest iPhone features"
- "Recent scientific discoveries"
- "Current stock prices"

Examples of topics that don't need search:
- "World War 2 facts"
- "Basic math concepts"
- "Classical literature"
- "Historical events before 2020"
- "General science concepts"`,
    prompt: `Analyze this trivia prompt and decide the next action: "${args.promptText}"

Consider:
1. Does this topic require current/recent information?
2. Do I have sufficient knowledge to create accurate questions?
3. Have I already searched and found relevant information?

Make your decision:`,
    schema: nextActionSchema,
    temperature: 0.3,
  });

  return object;
}

export async function generateTriviaQuestion(args: {
  promptText: string;
  searchContext?: string;
}): Promise<z.infer<typeof triviaQuestionSchema>> {
  const { object } = await generateObject({
    model: model,
    system: `You are a trivia question generator. Given a user's prompt, create a multiple-choice trivia question with exactly 4 answer options where only 1 is correct and 3 are plausible but incorrect distractors.

Rules:
- Generate factually accurate questions using the most current information available
- Make distractors plausible but incorrect
- Keep questions and answers concise${args.searchContext ?? ""}`,
    prompt: `Create a trivia question based on this prompt: "${args.promptText}"`,
    schema: triviaQuestionSchema,
    temperature: 0.7,
  });

  return object;
}

export async function askTriviaAgent(args: {
  promptText: string;
  maxSteps?: number;
}): Promise<z.infer<typeof triviaQuestionSchema>> {
  const context: SystemContext = {
    searchResults: [],
    stepCount: 0,
    maxSteps: args.maxSteps ?? 10,
    promptText: args.promptText,
  };

  while (context.stepCount < context.maxSteps) {
    context.stepCount++;

    const actionDecision = await decideNextAction({
      stepCount: context.stepCount,
      maxSteps: context.maxSteps,
      searchResults: context.searchResults,
      promptText: context.promptText,
    });

    if (actionDecision.action === "google-search") {
      if (!actionDecision.searchQuery) {
        throw new Error("Search query is required for google-search action");
      }

      try {
        const searchResults = await performWebSearch(
          actionDecision.searchQuery
        );
        context.searchResults.push({
          query: actionDecision.searchQuery,
          results: searchResults,
        });
        console.log(
          `Step ${context.stepCount}: Searched for "${actionDecision.searchQuery}", found ${searchResults.length} results`
        );
      } catch (searchError) {
        console.error("Search failed:", searchError);
        break;
      }
    } else if (actionDecision.action === "generate-object") {
      const searchContext = buildSearchContext(context.searchResults);
      const aiResponse = await generateTriviaQuestion({
        promptText: context.promptText,
        searchContext,
      });
      console.log(
        `Step ${context.stepCount}: Generated trivia question successfully`
      );
      return aiResponse;
    }
  }

  console.log("Max steps reached, falling back to simple generation");
  const aiResponse = await generateTriviaQuestion({
    promptText: context.promptText,
  });
  return aiResponse;
}

export async function askTriviaDetailAgent(args: {
  question: string;
  correctAnswer: string;
}): Promise<z.infer<typeof triviaDetailSchema>> {
  const { object } = await generateObject({
    model: model,
    system:
      "You are a trivia detail agent. Given a trivia question and its correct answer, produce one compelling, accurate detail or fun fact about the topic. Keep it to 1-2 sentences, plain language, engaging but factual. If the topic is recent, ensure recency and avoid speculation.",
    prompt: `Question: ${args.question}\nCorrect Answer: ${args.correctAnswer}\n\nWrite one concise detail or fun fact to show after revealing the correct answer:`,
    schema: triviaDetailSchema,
    temperature: 0.5,
  });

  return object;
}
