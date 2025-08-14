import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const model = google("gemini-2.0-flash");

export const factualityModel = google("gemini-2.0-flash");