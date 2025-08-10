import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { env } from "./env";
import { google } from "@ai-sdk/google";

/**
 * List all quizzes owned by the current authenticated user
 */
export const listQuizzesForUser = query({
  args: {},
  handler: async (ctx) => {
    // Get authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to list quizzes");
    }

    // Query quizzes by author
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("byAuthor", (q) => q.eq("authorId", identity.subject))
      .order("desc")
      .collect();

    return quizzes;
  },
});

/**
 * Get live quiz data including players and current round for a given join code
 * Used by players to get real-time quiz state
 */
export const getQuizLive = query({
  args: { joinCode: v.string() },
  handler: async (ctx, { joinCode }) => {
    // Find quiz by join code
    const quiz = await ctx.db
      .query("quizzes")
      .withIndex("byJoinCode", (q) => q.eq("joinCode", joinCode))
      .unique();

    if (!quiz) {
      return null;
    }

    // Get all players for this quiz
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Get current round if exists
    let currentRound = null;
    if (quiz.phase !== "lobby" && quiz.phase !== "finished") {
      currentRound = await ctx.db
        .query("rounds")
        .withIndex("byQuizIndex", (q) =>
          q.eq("quizId", quiz._id).eq("roundIndex", quiz.currentRoundIndex)
        )
        .unique();
    }

    // Get my player record if I'm authenticated or have a device fingerprint
    let myPlayer = null;
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      // Host player
      myPlayer = players.find(
        (p) => p.isHost && quiz.authorId === identity.subject
      );
    }
    // TODO: Handle anonymous player lookup by device fingerprint

    // Get player answer count for current round if in answering phase
    let answerCount = 0;
    if (quiz.phase === "answering" && currentRound) {
      const answers = await ctx.db
        .query("playerAnswers")
        .withIndex("byRound", (q) => q.eq("roundId", currentRound._id))
        .collect();
      answerCount = answers.length;
    }

    return {
      quiz,
      players,
      currentRound,
      myPlayer,
      answerCount,
    };
  },
});

/**
 * Create a new quiz owned by the authenticated user
 */
export const createQuiz = mutation({
  args: {
    name: v.string(),
    config: v.object({
      totalRounds: v.number(),
      secondsPerQuestion: v.number(),
      secondsForPrompt: v.number(),
    }),
  },
  handler: async (ctx, { name, config }) => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to create a quiz");
    }

    // Generate unique join code (6 characters, uppercase alphanumeric)
    const generateJoinCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous chars
      let result = "";
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Generate unique join link slug
    const generateJoinSlug = () => {
      const words = [
        "quick",
        "smart",
        "fun",
        "cool",
        "bright",
        "happy",
        "fast",
        "clever",
      ];
      const animals = [
        "fox",
        "owl",
        "cat",
        "dog",
        "bird",
        "bear",
        "deer",
        "seal",
      ];
      const word1 = words[Math.floor(Math.random() * words.length)];
      const word2 = animals[Math.floor(Math.random() * animals.length)];
      const num = Math.floor(Math.random() * 99) + 1;
      return `${word1}-${word2}-${num}`;
    };

    let joinCode = generateJoinCode();
    let joinLinkSlug = generateJoinSlug();

    // Ensure join code is unique
    let existingQuiz = await ctx.db
      .query("quizzes")
      .withIndex("byJoinCode", (q) => q.eq("joinCode", joinCode))
      .unique();

    while (existingQuiz) {
      joinCode = generateJoinCode();
      existingQuiz = await ctx.db
        .query("quizzes")
        .withIndex("byJoinCode", (q) => q.eq("joinCode", joinCode))
        .unique();
    }

    const now = Date.now();

    // Create quiz
    const quizId = await ctx.db.insert("quizzes", {
      authorId: identity.subject,
      name,
      config,
      phase: "lobby",
      currentRoundIndex: 0,
      joinCode,
      joinLinkSlug,
      createdAt: now,
      updatedAt: now,
    });

    // Create host player record
    await ctx.db.insert("players", {
      quizId,
      name: identity.name || "Host",
      deviceFingerprint: "host", // Special fingerprint for host
      isHost: true,
      score: 0,
      connectedAt: now,
      lastSeenAt: now,
    });

    return { quizId, joinCode, joinLinkSlug };
  },
});

/**
 * Get a specific quiz by ID
 */
export const getQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) => {
    // Get authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to access quiz");
    }

    // Get quiz and verify ownership
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      return null;
    }

    if (quiz.authorId !== identity.subject) {
      throw new Error("Quiz not found or access denied");
    }

    return quiz;
  },
});

/**
 * Get basic public quiz information by ID (no auth required)
 * Used by players to get join code and basic quiz info
 */
export const getQuizPublic = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) => {
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      return null;
    }

    // Return only public information that players need
    return {
      _id: quiz._id,
      name: quiz.name,
      joinCode: quiz.joinCode,
      phase: quiz.phase,
      currentRoundIndex: quiz.currentRoundIndex,
      config: quiz.config,
    };
  },
});

/**
 * Update quiz configuration (only allowed in lobby phase)
 */
export const updateQuizConfig = mutation({
  args: {
    quizId: v.id("quizzes"),
    config: v.object({
      totalRounds: v.number(),
      secondsPerQuestion: v.number(),
      secondsForPrompt: v.number(),
    }),
  },
  handler: async (ctx, { quizId, config }) => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to update quiz");
    }

    // Get quiz and verify ownership
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.authorId !== identity.subject) {
      throw new Error("Only quiz author can update configuration");
    }

    // Verify quiz is in lobby phase
    if (quiz.phase !== "lobby") {
      throw new Error("Quiz configuration can only be updated in lobby phase");
    }

    // Update quiz config
    await ctx.db.patch(quizId, {
      config,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Join a quiz as a player (anonymous)
 */
export const joinQuiz = mutation({
  args: {
    joinCode: v.string(),
    name: v.string(),
    deviceFingerprint: v.string(),
  },
  handler: async (ctx, { joinCode, name, deviceFingerprint }) => {
    // Find quiz by join code
    const quiz = await ctx.db
      .query("quizzes")
      .withIndex("byJoinCode", (q) => q.eq("joinCode", joinCode))
      .unique();

    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Verify quiz is in lobby phase (can only join in lobby)
    if (quiz.phase !== "lobby") {
      throw new Error("Quiz has already started or finished");
    }

    // Validate name
    if (!name.trim() || name.length > 20) {
      throw new Error("Name must be 1-20 characters");
    }

    // Check for duplicate name in this quiz
    const existingPlayerWithName = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("name"), name.trim()))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .first();

    if (existingPlayerWithName) {
      throw new Error("Name already taken in this quiz");
    }

    // Check if device fingerprint already has a player in this quiz
    const existingPlayerWithFingerprint = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("deviceFingerprint"), deviceFingerprint))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .first();

    if (existingPlayerWithFingerprint) {
      throw new Error("Device already has a player in this quiz");
    }

    // Check player capacity (max 50)
    const playerCount = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    if (playerCount.length >= 50) {
      throw new Error("Quiz is full (maximum 50 players)");
    }

    const now = Date.now();

    // Create player record
    const playerId = await ctx.db.insert("players", {
      quizId: quiz._id,
      name: name.trim(),
      deviceFingerprint,
      isHost: false,
      score: 0,
      connectedAt: now,
      lastSeenAt: now,
    });

    return { playerId, quizId: quiz._id };
  },
});

/**
 * Start the game - transition from lobby to prompting phase
 * Host-only mutation
 */
export const startGame = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  handler: async (ctx, { quizId }) => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to start game");
    }

    // Get quiz and verify ownership
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.authorId !== identity.subject) {
      throw new Error("Only quiz author can start the game");
    }

    // Verify quiz is in lobby phase
    if (quiz.phase !== "lobby") {
      throw new Error("Game can only be started from lobby phase");
    }

    // Get all non-host players
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    if (players.length === 0) {
      throw new Error("At least one player must join before starting");
    }

    // Select random prompter from available players
    const randomPrompter = players[Math.floor(Math.random() * players.length)];

    const now = Date.now();
    const promptDeadlineAt = now + quiz.config.secondsForPrompt * 1000;

    // Create first round
    await ctx.db.insert("rounds", {
      quizId,
      roundIndex: 0,
      prompterPlayerId: randomPrompter._id,
    });

    // Update quiz phase and deadline
    await ctx.db.patch(quizId, {
      phase: "prompting",
      promptDeadlineAt,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Submit prompt text during prompting phase
 * Only the selected prompter can submit
 */
export const submitPrompt = mutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    promptText: v.string(),
  },
  handler: async (ctx, { quizId, roundId, promptText }) => {
    // Get quiz and verify state
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.phase !== "prompting") {
      throw new Error("Not in prompting phase");
    }

    // Get round and verify it exists
    const round = await ctx.db.get(roundId);
    if (!round || round.quizId !== quizId) {
      throw new Error("Round not found or doesn't belong to this quiz");
    }

    if (round.roundIndex !== quiz.currentRoundIndex) {
      throw new Error("Round is not the current active round");
    }

    // Validate prompt text
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt || trimmedPrompt.length < 5) {
      throw new Error("Prompt must be at least 5 characters");
    }
    if (trimmedPrompt.length > 500) {
      throw new Error("Prompt must be 500 characters or less");
    }

    // Verify the caller is the selected prompter
    // Since players are anonymous, we'll need to check via device fingerprint
    // For now, we'll allow any player to submit (host can handle moderation)
    // TODO: Add proper player verification

    // Update round with prompt text
    await ctx.db.patch(roundId, {
      promptText: trimmedPrompt,
    });

    // Transition to generating phase
    await ctx.db.patch(quizId, {
      phase: "generating",
      promptDeadlineAt: undefined,
      updatedAt: Date.now(),
    });

    // Schedule AI answer generation action
    await ctx.scheduler.runAfter(0, internal.quizzes.generateAiAnswers, {
      quizId,
      roundId,
      promptText: trimmedPrompt,
    });

    return { success: true };
  },
});

/**
 * Generate AI answers using Gemini
 * Internal action called after prompt submission
 */
export const generateAiAnswers = internalAction({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    promptText: v.string(),
  },
  handler: async (ctx, { quizId, roundId, promptText }) => {
    try {
      // Construct the prompt for AI to generate a question with 4 options
      const systemPrompt = `You are a trivia question generator. Given a user's prompt, create a multiple-choice trivia question with exactly 4 answer options where only 1 is correct and 3 are plausible but incorrect distractors.

Rules:
- Generate factually accurate questions
- Make distractors plausible but clearly wrong
- Keep questions and answers concise
- Avoid controversial topics
- Return response in exact JSON format specified`;

      const userPrompt = `Create a trivia question based on this prompt: "${promptText}"

Return your response in this exact JSON format:
{
  "question": "Your trivia question here",
  "correct": "The correct answer",
  "distractors": ["Wrong answer 1", "Wrong answer 2", "Wrong answer 3"]
}`;

      // Create Google provider with API key
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      });

      // Call Gemini API
      const { text } = await generateText({
        model: google("gemini-2.0-flash"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
        maxOutputTokens: 500,
        tools: {
          google_search: google.tools.googleSearch({}),
        },
      });

      // Parse the AI response
      let aiResponse;
      try {
        aiResponse = JSON.parse(text.trim());
      } catch {
        throw new Error("AI response was not valid JSON");
      }

      // Validate response structure
      if (
        !aiResponse.question ||
        !aiResponse.correct ||
        !Array.isArray(aiResponse.distractors) ||
        aiResponse.distractors.length !== 3
      ) {
        throw new Error("AI response missing required fields");
      }

      // Create shuffled options with unique IDs
      const allOptions = [
        { id: "correct", text: aiResponse.correct, isCorrect: true },
        ...aiResponse.distractors.map((text: string, index: number) => ({
          id: `distractor_${index + 1}`,
          text,
          isCorrect: false,
        })),
      ];

      // Shuffle options
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }

      // Store the generated options in the round
      await ctx.runMutation(internal.quizzes.advanceToAnswering, {
        quizId,
        roundId,
        aiAnswerOptions: allOptions,
        question: aiResponse.question,
      });
    } catch (error) {
      // Handle AI generation error
      console.error("AI generation failed:", error);

      // Mark round as errored and allow host to skip or retry
      await ctx.runMutation(internal.quizzes.markRoundErrored, {
        quizId,
        roundId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/**
 * Internal mutation to advance to answering phase after AI generation
 */
export const advanceToAnswering = internalMutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    aiAnswerOptions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        isCorrect: v.boolean(),
      })
    ),
    question: v.string(),
  },
  handler: async (ctx, { quizId, roundId, aiAnswerOptions, question }) => {
    // Get quiz to calculate answer deadline
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    const now = Date.now();
    const answerDeadlineAt = now + quiz.config.secondsPerQuestion * 1000;

    // Update round with AI-generated options
    await ctx.db.patch(roundId, {
      aiAnswerOptions,
      promptText: question, // Use AI-generated question if different from original prompt
    });

    // Transition quiz to answering phase
    await ctx.db.patch(quizId, {
      phase: "answering",
      answerDeadlineAt,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation to mark a round as errored during AI generation
 */
export const markRoundErrored = internalMutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    error: v.string(),
  },
  handler: async (ctx, { quizId, roundId, error }) => {
    // Mark round as errored
    await ctx.db.patch(roundId, {
      aiErrored: true,
    });

    // Keep quiz in generating phase but log the error
    // Host will need to handle this via UI controls
    console.error(`Round ${roundId} AI generation failed:`, error);
  },
});
