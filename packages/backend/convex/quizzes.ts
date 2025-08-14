import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  type SystemContext as AgentSystemContext,
  buildSearchContext,
  decideNextAction,
  generateTriviaQuestion,
} from "../lib/agent";
import { performWebSearch } from "../lib/serper";

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

    let joinCode = generateJoinCode();

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

    return { quizId, joinCode };
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

    // Rejoin handling: if device already has a player in this quiz and not kicked,
    // return that player, regardless of quiz phase.
    const existingPlayerWithFingerprint = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("deviceFingerprint"), deviceFingerprint))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .first();

    if (existingPlayerWithFingerprint) {
      // Update lastSeenAt on rejoin
      await ctx.db.patch(existingPlayerWithFingerprint._id, {
        lastSeenAt: Date.now(),
      });
      return { playerId: existingPlayerWithFingerprint._id, quizId: quiz._id };
    }

    // If no existing player, only allow creating a new one in lobby
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

    // Device fingerprint uniqueness for new players (no duplicate creates in lobby)
    const duplicateFingerprint = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quiz._id))
      .filter((q) => q.eq(q.field("deviceFingerprint"), deviceFingerprint))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .first();

    if (duplicateFingerprint) {
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
 * Kick a player from the quiz (host-only)
 */
export const kickPlayer = mutation({
  args: {
    quizId: v.id("quizzes"),
    playerId: v.id("players"),
  },
  handler: async (ctx, { quizId, playerId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (quiz.authorId !== identity.subject) {
      throw new Error("Only quiz author can kick players");
    }

    const player = await ctx.db.get(playerId);
    if (!player || player.quizId !== quizId) {
      throw new Error("Player not found in this quiz");
    }
    if (player.isHost) {
      throw new Error("Cannot kick the host");
    }

    await ctx.db.patch(playerId, { kickedAt: Date.now() });
    return { success: true };
  },
});

/**
 * End the quiz immediately (host-only)
 */
export const endQuiz = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User must be authenticated");
    const quiz = await ctx.db.get(quizId);
    if (!quiz) throw new Error("Quiz not found");
    if (quiz.authorId !== identity.subject)
      throw new Error("Only quiz author can end quiz");

    await ctx.db.patch(quizId, {
      phase: "finished",
      answerDeadlineAt: undefined,
      promptDeadlineAt: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Skip the current round (host-only)
 * - If answering: auto-lock answers and move to reveal
 * - If prompting/generating: mark round completed and move to reveal
 */
export const skipRound = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("User must be authenticated");
    const quiz = await ctx.db.get(quizId);
    if (!quiz) throw new Error("Quiz not found");
    if (quiz.authorId !== identity.subject)
      throw new Error("Only quiz author can skip rounds");

    if (quiz.phase === "finished" || quiz.phase === "scoreboard") {
      return { skipped: false };
    }

    // Get current round
    const currentRound = await ctx.db
      .query("rounds")
      .withIndex("byQuizIndex", (q) =>
        q.eq("quizId", quizId).eq("roundIndex", quiz.currentRoundIndex)
      )
      .unique();
    if (!currentRound) throw new Error("No active round to skip");

    const now = Date.now();

    if (quiz.phase === "answering") {
      // Use existing internal mutation to finalize missing answers and move to reveal
      await ctx.scheduler.runAfter(
        0,
        internal.quizzes.autoLockAnswersInternal,
        {
          quizId,
          roundId: currentRound._id,
        }
      );
      return { success: true, nextPhase: "reveal" };
    }

    // prompting or generating
    await ctx.db.patch(currentRound._id, { completedAt: now });
    await ctx.db.patch(quizId, {
      phase: "reveal",
      promptDeadlineAt: undefined,
      updatedAt: now,
    });
    return { success: true, nextPhase: "reveal" };
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

export const generateAiAnswers = internalAction({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    promptText: v.string(),
  },
  handler: async (ctx, { quizId, roundId, promptText }) => {
    try {
      // Initialize system context
      const context: AgentSystemContext = {
        searchResults: [],
        stepCount: 0,
        maxSteps: 10,
        promptText,
      };

      // Agent loop
      while (context.stepCount < context.maxSteps) {
        context.stepCount++;

        // Determine next action
        const actionDecision = await decideNextAction({
          stepCount: context.stepCount,
          maxSteps: context.maxSteps,
          searchResults: context.searchResults,
          promptText: context.promptText,
        });

        if (actionDecision.action === "google-search") {
          // Perform Google search
          if (!actionDecision.searchQuery) {
            throw new Error(
              "Search query is required for google-search action"
            );
          }

          try {
            // Use a simple web search API (you'll need to implement this with your preferred search provider)
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
            // Continue with generation if search fails
            break;
          }
        } else if (actionDecision.action === "generate-object") {
          // Generate trivia question
          const searchContext = buildSearchContext(context.searchResults);
          const aiResponse = await generateTriviaQuestion({
            promptText: context.promptText,
            searchContext,
          });

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

          console.log(
            `Step ${context.stepCount}: Generated trivia question successfully`
          );
          return; // Exit the loop successfully
        }
      }

      // If we reach here, we've hit max steps without generating - fallback to simple generation
      console.log("Max steps reached, falling back to simple generation");

      const aiResponse = await generateTriviaQuestion({
        promptText: context.promptText,
      });

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

    // Schedule auto-lock action for when time expires
    await ctx.scheduler.runAfter(
      quiz.config.secondsPerQuestion * 1000,
      internal.quizzes.autoLockAnswers,
      {
        quizId,
        roundId,
        expectedDeadline: answerDeadlineAt,
      }
    );
  },
});

/**
 * Submit answer during answering phase
 * Players submit their selected option
 */
export const submitAnswer = mutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    selectedOptionId: v.string(),
    deviceFingerprint: v.string(),
  },
  handler: async (
    ctx,
    { quizId, roundId, selectedOptionId, deviceFingerprint }
  ) => {
    // Get quiz and verify state
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.phase !== "answering") {
      throw new Error("Not in answering phase");
    }

    // Get round and verify it exists
    const round = await ctx.db.get(roundId);
    if (!round || round.quizId !== quizId) {
      throw new Error("Round not found or doesn't belong to this quiz");
    }

    if (round.roundIndex !== quiz.currentRoundIndex) {
      throw new Error("Round is not the current active round");
    }

    // Verify the selected option exists
    if (!round.aiAnswerOptions) {
      throw new Error("No answer options available for this round");
    }

    const selectedOption = round.aiAnswerOptions.find(
      (option) => option.id === selectedOptionId
    );
    if (!selectedOption) {
      throw new Error("Invalid answer option selected");
    }

    // Find player by device fingerprint
    const player = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("deviceFingerprint"), deviceFingerprint))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .unique();

    if (!player) {
      throw new Error("Player not found in this quiz");
    }

    // Check if player has already answered this round
    const existingAnswer = await ctx.db
      .query("playerAnswers")
      .withIndex("byPlayerAndRound", (q) =>
        q.eq("playerId", player._id).eq("roundId", roundId)
      )
      .unique();

    if (existingAnswer) {
      throw new Error("You have already answered this round");
    }

    const now = Date.now();

    // Calculate scoring based on correctness and speed
    let points = 0;
    if (selectedOption.isCorrect) {
      // Base points for correct answer
      points = 100;

      // Speed bonus - up to 50% more points based on how quickly answered
      if (quiz.answerDeadlineAt) {
        const totalTimeMs = quiz.config.secondsPerQuestion * 1000;
        const timeRemainingMs = quiz.answerDeadlineAt - now;
        const speedBonus = Math.floor((timeRemainingMs / totalTimeMs) * 50);
        points += Math.max(0, speedBonus);
      }
    }

    // Record player answer
    await ctx.db.insert("playerAnswers", {
      quizId,
      roundId,
      playerId: player._id,
      selectedOptionId,
      isCorrect: selectedOption.isCorrect,
      submittedAt: now,
    });

    // Update player score
    await ctx.db.patch(player._id, {
      score: player.score + points,
      lastSeenAt: now,
    });

    // Check if all players have now answered (inline check)
    // Get all non-host players
    const allPlayers = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Get all answers for this round (including the one just submitted)
    const allAnswers = await ctx.db
      .query("playerAnswers")
      .withIndex("byRound", (q) => q.eq("roundId", roundId))
      .collect();

    // If all players have answered, schedule auto-advance to reveal phase
    if (allPlayers.length > 0 && allAnswers.length >= allPlayers.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.quizzes.autoLockAnswersInternal,
        {
          quizId,
          roundId,
        }
      );
    }

    return {
      success: true,
      isCorrect: selectedOption.isCorrect,
      pointsEarned: points,
    };
  },
});

/**
 * Lock answers and transition to reveal phase
 * Called when time expires or all players have answered
 */
export const lockAnswers = mutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
  },
  handler: async (ctx, { quizId, roundId }) => {
    // Verify user is authenticated (host only)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Get quiz and verify ownership
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.authorId !== identity.subject) {
      throw new Error("Only quiz author can lock answers");
    }

    // Verify quiz is in answering phase
    if (quiz.phase !== "answering") {
      throw new Error("Can only lock answers during answering phase");
    }

    // Get round and verify it exists
    const round = await ctx.db.get(roundId);
    if (!round || round.quizId !== quizId) {
      throw new Error("Round not found or doesn't belong to this quiz");
    }

    if (round.roundIndex !== quiz.currentRoundIndex) {
      throw new Error("Round is not the current active round");
    }

    // Get all players for this quiz (excluding host)
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Get all answers for this round
    const answers = await ctx.db
      .query("playerAnswers")
      .withIndex("byRound", (q) => q.eq("roundId", roundId))
      .collect();

    // Create a map of players who have answered
    const answeredPlayerIds = new Set(answers.map((a) => a.playerId));

    // For players who didn't answer, create a "no answer" record with 0 points
    const now = Date.now();
    for (const player of players) {
      if (!answeredPlayerIds.has(player._id)) {
        // Record no answer with 0 points
        await ctx.db.insert("playerAnswers", {
          quizId,
          roundId,
          playerId: player._id,
          selectedOptionId: "", // Empty string indicates no answer
          isCorrect: false,
          submittedAt: now,
        });
      }
    }

    // Mark round as completed
    await ctx.db.patch(roundId, {
      completedAt: now,
    });

    // Transition quiz to reveal phase
    await ctx.db.patch(quizId, {
      phase: "reveal",
      answerDeadlineAt: undefined,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Advance to next phase (reveal -> scoreboard -> next round or finished)
 * Host-only mutation
 */
export const advancePhase = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  handler: async (ctx, { quizId }) => {
    // Verify user is authenticated (host only)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Get quiz and verify ownership
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    if (quiz.authorId !== identity.subject) {
      throw new Error("Only quiz author can advance phases");
    }

    const now = Date.now();

    if (quiz.phase === "reveal") {
      // Advance from reveal to scoreboard
      await ctx.db.patch(quizId, {
        phase: "scoreboard",
        updatedAt: now,
      });
      return { success: true, nextPhase: "scoreboard" };
    } else if (quiz.phase === "scoreboard") {
      // Check if there are more rounds
      const nextRoundIndex = quiz.currentRoundIndex + 1;

      if (nextRoundIndex < quiz.config.totalRounds) {
        // Start next round
        // Get all non-host players
        const players = await ctx.db
          .query("players")
          .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
          .filter((q) => q.eq(q.field("isHost"), false))
          .filter((q) => q.eq(q.field("kickedAt"), undefined))
          .collect();

        if (players.length === 0) {
          throw new Error("No players available for next round");
        }

        // Select random prompter from available players
        const randomPrompter =
          players[Math.floor(Math.random() * players.length)];
        const promptDeadlineAt = now + quiz.config.secondsForPrompt * 1000;

        // Create next round
        await ctx.db.insert("rounds", {
          quizId,
          roundIndex: nextRoundIndex,
          prompterPlayerId: randomPrompter._id,
        });

        // Update quiz to next round and prompting phase
        await ctx.db.patch(quizId, {
          phase: "prompting",
          currentRoundIndex: nextRoundIndex,
          promptDeadlineAt,
          updatedAt: now,
        });

        return {
          success: true,
          nextPhase: "prompting",
          nextRound: nextRoundIndex,
        };
      } else {
        // Quiz is finished
        await ctx.db.patch(quizId, {
          phase: "finished",
          updatedAt: now,
        });
        return { success: true, nextPhase: "finished" };
      }
    } else {
      throw new Error(`Cannot advance from phase: ${quiz.phase}`);
    }
  },
});

/**
 * Get leaderboard for a quiz (sorted by score descending)
 */
export const getLeaderboard = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) => {
    // Get all non-host players for this quiz
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Sort by score descending, then by name for ties
    const sortedPlayers = players.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score; // Higher scores first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    });

    // Add position to each player
    return sortedPlayers.map((player, index) => ({
      ...player,
      position: index + 1,
    }));
  },
});

/**
 * Internal action to check for timeout and auto-lock answers
 * Scheduled when answering phase begins
 */
export const autoLockAnswers = internalAction({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    expectedDeadline: v.number(),
  },
  handler: async (ctx, { quizId, roundId, expectedDeadline }) => {
    // Check if quiz is still in answering phase and deadline hasn't changed
    const quiz = await ctx.runQuery(internal.quizzes.getQuizForAutoLock, {
      quizId,
      expectedDeadline,
    });

    if (!quiz) {
      // Quiz has moved on or deadline changed, don't lock
      return { skipped: true };
    }

    // Check if all players have answered
    const allAnswered = await ctx.runQuery(
      internal.quizzes.checkAllPlayersAnswered,
      {
        quizId,
        roundId,
      }
    );

    if (allAnswered) {
      // All players already answered, don't need to lock
      return { skipped: true, reason: "all_answered" };
    }

    // Auto-lock answers due to timeout
    await ctx.runMutation(internal.quizzes.autoLockAnswersInternal, {
      quizId,
      roundId,
    });

    return { success: true, reason: "timeout" };
  },
});

/**
 * Internal query to check quiz state for auto-lock
 */
export const getQuizForAutoLock = internalQuery({
  args: {
    quizId: v.id("quizzes"),
    expectedDeadline: v.number(),
  },
  handler: async (ctx, { quizId, expectedDeadline }) => {
    const quiz = await ctx.db.get(quizId);

    if (
      !quiz ||
      quiz.phase !== "answering" ||
      !quiz.answerDeadlineAt ||
      quiz.answerDeadlineAt !== expectedDeadline
    ) {
      return null;
    }

    return quiz;
  },
});

/**
 * Internal query to check if all players have answered
 */
export const checkAllPlayersAnswered = internalQuery({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
  },
  handler: async (ctx, { quizId, roundId }) => {
    // Get all non-host players
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Get all answers for this round
    const answers = await ctx.db
      .query("playerAnswers")
      .withIndex("byRound", (q) => q.eq("roundId", roundId))
      .collect();

    return players.length > 0 && answers.length >= players.length;
  },
});

/**
 * Internal mutation to auto-lock answers (timeout case)
 */
export const autoLockAnswersInternal = internalMutation({
  args: {
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
  },
  handler: async (ctx, { quizId, roundId }) => {
    // Get quiz
    const quiz = await ctx.db.get(quizId);
    if (!quiz || quiz.phase !== "answering") {
      return { skipped: true };
    }

    // Get round
    const round = await ctx.db.get(roundId);
    if (
      !round ||
      round.quizId !== quizId ||
      round.roundIndex !== quiz.currentRoundIndex
    ) {
      return { skipped: true };
    }

    // Get all players for this quiz (excluding host)
    const players = await ctx.db
      .query("players")
      .withIndex("byQuiz", (q) => q.eq("quizId", quizId))
      .filter((q) => q.eq(q.field("isHost"), false))
      .filter((q) => q.eq(q.field("kickedAt"), undefined))
      .collect();

    // Get all answers for this round
    const answers = await ctx.db
      .query("playerAnswers")
      .withIndex("byRound", (q) => q.eq("roundId", roundId))
      .collect();

    // Create a map of players who have answered
    const answeredPlayerIds = new Set(answers.map((a) => a.playerId));

    // For players who didn't answer, create a "no answer" record with 0 points
    const now = Date.now();
    for (const player of players) {
      if (!answeredPlayerIds.has(player._id)) {
        // Record no answer with 0 points
        await ctx.db.insert("playerAnswers", {
          quizId,
          roundId,
          playerId: player._id,
          selectedOptionId: "", // Empty string indicates no answer
          isCorrect: false,
          submittedAt: now,
        });
      }
    }

    // Mark round as completed
    await ctx.db.patch(roundId, {
      completedAt: now,
    });

    // Transition quiz to reveal phase
    await ctx.db.patch(quizId, {
      phase: "reveal",
      answerDeadlineAt: undefined,
      updatedAt: now,
    });

    return { success: true };
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
