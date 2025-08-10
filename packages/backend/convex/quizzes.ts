import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

    return {
      quiz,
      players,
      currentRound,
      myPlayer,
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
