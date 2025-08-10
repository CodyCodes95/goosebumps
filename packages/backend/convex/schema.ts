import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Quiz table - single-run entity with live state
  quizzes: defineTable({
    authorId: v.string(), // Clerk user id
    name: v.string(),
    config: v.object({
      totalRounds: v.number(),
      secondsPerQuestion: v.number(),
      secondsForPrompt: v.number(),
    }),
    phase: v.union(
      v.literal("lobby"),
      v.literal("prompting"),
      v.literal("generating"),
      v.literal("answering"),
      v.literal("reveal"),
      v.literal("scoreboard"),
      v.literal("finished")
    ),
    currentRoundIndex: v.number(), // 0-based
    joinCode: v.string(), // e.g., 6 chars
    answerDeadlineAt: v.optional(v.number()), // only in answering phase
    promptDeadlineAt: v.optional(v.number()), // only in prompting phase
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byJoinCode", ["joinCode"])
    .index("byAuthor", ["authorId"]),

  // Player table - participants in a quiz
  players: defineTable({
    quizId: v.id("quizzes"),
    name: v.string(),
    deviceFingerprint: v.string(), // cookie/localStorage value to limit dupes
    isHost: v.boolean(), // false for normal players
    score: v.number(),
    connectedAt: v.number(),
    lastSeenAt: v.number(),
    kickedAt: v.optional(v.number()),
  })
    .index("byQuiz", ["quizId"])
    .index("byFingerprint", ["deviceFingerprint"]),

  // Round table - one cycle of prompt -> generate -> answer -> reveal
  rounds: defineTable({
    quizId: v.id("quizzes"),
    roundIndex: v.number(),
    prompterPlayerId: v.id("players"), // who writes the prompt
    promptText: v.optional(v.string()), // once submitted by prompter
    aiAnswerOptions: v.optional(
      v.array(
        v.object({
          id: v.string(), // stable id for choice
          text: v.string(),
          isCorrect: v.boolean(),
        })
      )
    ),
    aiRequestId: v.optional(v.string()),
    aiErrored: v.optional(v.boolean()),
    completedAt: v.optional(v.number()),
  }).index("byQuizIndex", ["quizId", "roundIndex"]),

  // PlayerAnswer table - per-round record of player's selected answer
  playerAnswers: defineTable({
    quizId: v.id("quizzes"),
    roundId: v.id("rounds"),
    playerId: v.id("players"),
    selectedOptionId: v.string(),
    isCorrect: v.boolean(),
    submittedAt: v.number(),
    latencyMs: v.optional(v.number()), // optional, for tie-breaking/analytics
  })
    .index("byRound", ["roundId"])
    .index("byPlayerAndRound", ["playerId", "roundId"]),
});
