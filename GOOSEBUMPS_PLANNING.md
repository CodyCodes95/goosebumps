## Goosebumps – Product & Engineering Plan

This document is a step-by-step plan to take Goosebumps (a participant-driven, Kahoot/Jackbox-style quiz game) from template to production. It prioritizes: a clean game state machine; Convex-powered realtime via DB state; Clerk for host auth; anonymous player joins; and high-quality UX with Tailwind.

The plan is structured into phases, with clear deliverables, data model, backend functions, UI, security, testing, and deployment.

---

### Guiding Principles
- Realtime via database state (Convex live queries). No websockets to manage manually.
- Single source of truth for game state in Convex. Host is the only state-mutating actor.
- Typescript everywhere; prefer `type` over `interface`.
- Tailwind for styling; prefer flex and gap utilities over space-* utilities.
- Small, well-defined state machine with explicit transitions and invariants.
- Stateless clients. Clients render based on session state from Convex.
- AI calls via Convex Actions; never from the browser.

---

### Roles
- Host (Creator): Must be authenticated via Clerk. Can create/manage quizzes; present a quiz by launching a session; controls state transitions.
- Player: Anonymous (no auth). Joins a session via link/code; chooses a display name; answers questions; may be selected to propose the next prompt.
- Spectator (Do not implement, for later consideration): Read-only view of presentation without participating.

---

### Core Concepts
- Quiz: Author-owned template with name, config (rounds, per-question time, prompt settings). Quiz can be presented multiple times.
- Session: A live presentation/run of a quiz with its own state, join code, players, and per-round data.
- Round: One cycle where a designated player submits a prompt; AI generates answers; others answer; results are revealed.
- Player: A participant in a session (anonymous name + connection metadata); stores score and per-round answers.
- PlayerAnswer: A per-round record of a player’s selected answer and latency.

---

### Game State Machine (Session)

States (phases):
1) `lobby` – Host has created a session. Players can join and set name.
2) `prompting` – Selected player receives a prompt input screen; others see “Stand by”.
3) `generating` – Server calls AI to generate one correct and three distractors. UI shows loading.
4) `answering` – All players see options; countdown timer runs; answers are recorded.
5) `reveal` – Correct answer is shown; per-player correctness and scores updated.
6) `scoreboard` – Leaderboard and per-round results displayed briefly.
7) `finished` – All rounds completed.

Transitions:
- `lobby -> prompting` (host starts game)
- `prompting -> generating` (prompt submitted or timeout/fallback)
- `generating -> answering` (AI responses ready)
- `answering -> reveal` (all answered or timer expired)
- `reveal -> scoreboard` (host advance or fixed delay)
- `scoreboard -> prompting` (if rounds remain; select next prompter)
- `scoreboard -> finished` (no rounds remain)

Invariants:
- Only host can invoke mutations that transition `session.phase`.
- `session.currentRoundIndex` is monotonic.
- Exactly one `round` is active at a time.
- `answerDeadlineAt` is set only for `answering` phase.

Timers:
- Use server-side stored timestamps (e.g., `answerDeadlineAt`) so UIs can derive countdowns without client timers being authoritative.

---

### Data Model (Convex)
We will expand `packages/backend/convex/schema.ts` with the following collections. Names are suggestions; we can tweak during implementation.

Types (illustrative; we’ll encode in Convex schema; prefer `type` over `interface`):

```ts
// Types are conceptual. We'll encode with Convex's schema builder.
type QuizConfig = {
  totalRounds: number; // number of rounds in the session
  secondsPerQuestion: number; // answering phase duration
  secondsForPrompt: number; // prompting deadline
  allowNSFW: boolean; // optional moderation toggle
  allowOffensive: boolean; // optional moderation toggle
};

type Quiz = {
  _id: Id<"quizzes">;
  authorClerkUserId: string;
  name: string;
  config: QuizConfig;
  createdAt: number; // Date.now()
  updatedAt: number;
};

type SessionPhase =
  | "lobby"
  | "prompting"
  | "generating"
  | "answering"
  | "reveal"
  | "scoreboard"
  | "finished";

type Session = {
  _id: Id<"sessions">;
  quizId: Id<"quizzes">;
  hostClerkUserId: string;
  joinCode: string; // e.g., 6 chars
  joinLinkSlug: string; // human-friendly slug for link join
  phase: SessionPhase;
  currentRoundIndex: number; // 0-based
  answerDeadlineAt?: number; // only in answering phase
  promptDeadlineAt?: number; // only in prompting phase
  createdAt: number;
  updatedAt: number;
};

type Player = {
  _id: Id<"players">;
  sessionId: Id<"sessions">;
  name: string;
  deviceFingerprint: string; // cookie/localStorage value to limit dupes
  isHost: boolean; // false for normal players
  score: number;
  connectedAt: number;
  lastSeenAt: number;
  kickedAt?: number;
};

type Round = {
  _id: Id<"rounds">;
  sessionId: Id<"sessions">;
  roundIndex: number;
  prompterPlayerId: Id<"players">; // who writes the prompt
  promptText?: string; // once submitted by prompter
  aiAnswerOptions?: Array<{
    id: string; // stable id for choice
    text: string;
    isCorrect: boolean;
  }>;
  aiProvider: "openai" | "anthropic" | "vertex"; // start with openai
  aiRequestId?: string;
  aiErrored?: boolean;
  completedAt?: number;
};

type PlayerAnswer = {
  _id: Id<"playerAnswers">;
  sessionId: Id<"sessions">;
  roundId: Id<"rounds">;
  playerId: Id<"players">;
  selectedOptionId: string;
  isCorrect: boolean;
  submittedAt: number;
  latencyMs?: number; // optional, for tie-breaking/analytics
};
```

Indexes:
- `sessions.byJoinCode`, `sessions.byQuiz`.
- `players.bySession`, `players.byFingerprint`.
- `rounds.bySessionIndex` (sessionId + roundIndex).
- `playerAnswers.byRound`, `playerAnswers.byPlayerAndRound`.

---

### Backend (Convex) – Functions

Split into Queries, Mutations, Actions. AI and external network calls live in Actions.

Queries:
- `listQuizzesForUser()` – quizzes owned by the current Clerk user.
- `getQuiz({ quizId })` – details of a quiz.
- `getSession({ sessionId })` – full session snapshot.
- `getSessionLive({ joinCode })` – session + players + current round + my player record.
- `getRoundsForSession({ sessionId })` – all rounds for scoreboard.
- `getLeaderboard({ sessionId })` – computed leaderboard.

Mutations (host-only unless noted):
- `createQuiz({ name, config })` – create quiz owned by user.
- `updateQuizConfig({ quizId, config })` – validate ownership.
- `createSession({ quizId })` – create `sessions` row, generate join code/slug, phase `lobby`.
- `endSession({ sessionId })` – set `finished`.
- `startGame({ sessionId })` – transition `lobby -> prompting`, create `rounds[0]`, choose prompter, set `promptDeadlineAt`.
- `submitPrompt({ sessionId, roundId, promptText })` – only prompter can submit; moves to `generating` and triggers AI action.
- `advanceToAnswering({ sessionId, roundId })` – internal use after AI completes; sets `answerDeadlineAt`.
- `submitAnswer({ sessionId, roundId, selectedOptionId })` – player mutation during `answering`.
- `lockAnswers({ sessionId, roundId })` – when timer expires or all answered; compute correctness & scoring; move to `reveal`.
- `advancePhase({ sessionId })` – host advance reveal->scoreboard->next round or finished.
- `kickPlayer({ sessionId, playerId })` – optional moderation.

Actions:
- `generateAiAnswers({ sessionId, roundId, promptText })` – calls OpenAI (or provider), returns 4 options with one correct; writes to `rounds` then triggers `advanceToAnswering`.
- `moderatePrompt({ text })` – optional moderation pipeline.

Security & Validation:
- All host-only mutations verify `ctx.auth.getUserIdentity()?.subject === session.hostClerkUserId`.
- Player mutations verify `player.sessionId === sessionId` and player is not kicked.
- `submitAnswer` deduplicates via `playerAnswers.byPlayerAndRound` unique index.
- Transitions validate current phase before moving.

---

### Scoring
- Base: +1000 points for correct answers.
- Optional streak bonus (later).
- Optional speed bonus (later) using `submittedAt` vs `answerDeadlineAt`.
- Scoring computed server-side on `lockAnswers`.

---

### AI Answer Generation (Action)
- Provider: Start with OpenAI (gpt-4o-mini or similar). Use deterministic temperature (e.g., 0.7) and system prompt to enforce 1 correct and 3 plausible incorrect options.
- Output schema: exact JSON format with fields `{ correct: string; distractors: string[] }` and a derived shuffled list with IDs.
- Moderation: Basic filters for profanity/NSFW based on quiz config.
- Caching: None initially; may log prompts/answers for analytics.
- Error handling: On failure, retry with backoff; on repeated failure, show fallback trivia category or allow host to skip.

Example action outline:
```ts
export const generateAiAnswers = action({ args: { sessionId: v.id("sessions"), roundId: v.id("rounds"), promptText: v.string() } }, async (ctx, args) => {
  // Call OpenAI with strict JSON schema; validate result; write to rounds; then call a mutation to move to answering.
});
```

---

### Frontend (Next.js App Router)

Routes (host):
- `/` – landing/marketing or redirect to dashboard.
- `/quizzes` – list of user’s quizzes; create quiz.
- `/quizzes/[quizId]` – quiz detail/edit; “Present” button creates a session.
- `/present/[sessionId]` – host presenter view: join code, player list, controls (start/advance/end), live phase display.

Routes (players):
- `/join` – form to enter code or paste link.
- `/join/[joinCode]` – lightweight page to enter name and join; creates Player.
- `/play/[sessionId]` – player view; renders according to `phase`:
  - `lobby`: waiting room
  - `prompting`: if selected prompter, show prompt input; else standby screen
  - `generating`: loading
  - `answering`: answer options with countdown
  - `reveal`/`scoreboard`: show result/leaderboard

Presenter UI specifics:
- Controls: Start, Skip, Lock Answers, Advance, End.
- Status: Phase, timers, current round, number of answers in.
- Moderation: kick player.

Tailwind standards:
- Layouts rely on `flex`, `grid` as needed; spacing with `gap-*`.
- Shared components: buttons, cards, timers, progress bars; reuse existing `src/components/ui/*` where possible.

---

### Realtime Data Flow
- Host/players subscribe via Convex `useQuery` to session, players, current round, and playerAnswers counts.
- UI transitions are purely data-driven; clients never assume state—only render.
- Timers: Show client-side countdown to server-stored deadlines; actual phase change is done by host or server mutations.

---

### Security & Abuse Prevention
- Auth: Host via Clerk; store `hostClerkUserId` on session.
- Anonymous players: Create a `players` row on join with device fingerprint; basic duplicate prevention.
- Rate limiting: Throttle joins and answers per device/IP.
- Name sanitization: Strip emojis/zero-width; length limits; profanity filter.
- Access checks in every mutation: phase guards; ownership checks; player-session checks.
- Content safety: Optional moderation on prompts; allow host override or skip.
- Privacy: No PII beyond player-chosen name; document in privacy policy.

---

### Observability & Analytics
- Error tracking: Sentry (frontend and Convex functions).
- Logs: Key transitions, AI failures, and performance timings.
- Metrics: players per session, answer rates, average latency, completion rate.

---

### Testing Strategy
- Unit (Convex):
  - State machine guards (valid/invalid transitions).
  - Scoring correctness.
  - Answer dedup and deadline logic.
- Integration:
  - AI action happy-path with mocked provider.
  - Join flow: create session -> join -> start -> answer -> reveal.
- E2E (Playwright):
  - Single-host + 2 players across multiple browser contexts.
  - Timer expiry path vs all-answered path.
- Load/Chaos:
  - 100–200 concurrent players answer burst; ensure queries render smoothly.

---

### Deployment
- Frontend: Vercel (Next.js). Protect `/quizzes*` and `/present/*` with Clerk.
- Backend: Convex Cloud. Store secrets (OpenAI) in Convex environment variables.
- Domains: Nice join link `goosebumps.app/join/ABC123`.
- CI: GitHub Actions with Turbo. Lint, type-check, run unit tests, then deploy.

---

### Milestones & Detailed Tasks

Milestone 0 – Repo Hygiene (Day 0–0.5)
- Ensure environment setup docs in `README.md` (Convex, Clerk, OpenAI keys).
- Add `ENV` documentation and `.env.example` for web and Convex.

Milestone 1 – Data & Auth Foundations (Day 1–2)
- Extend Convex `schema.ts` with `quizzes`, `sessions`, `players`, `rounds`, `playerAnswers`.
- Implement base queries: `listQuizzesForUser`, `getSessionLive`.
- Implement mutations: `createQuiz`, `updateQuizConfig`.
- Wire Clerk in Next.js layout; protect host routes; anonymous player routes open.

Milestone 2 – Quiz Dashboard & Creation (Day 2–3)
- `/quizzes`: list + create form (name, rounds, timers, moderation flags).
- `/quizzes/[quizId]`: edit config; “Present” button -> `createSession` -> redirect to `/present/[sessionId]`.

Milestone 3 – Presenter View & Lobby (Day 3–4)
- `/present/[sessionId]`: show join code/slug; live player list; start button (host-only `startGame`).
- `/join` and `/join/[joinCode]`: join flow creates `players` row with name + fingerprint; redirect to `/play/[sessionId]`.

Milestone 4 – Prompting & AI Generation (Day 4–6)
- Phase `prompting`: selected prompter sees prompt input; others see standby.
- Mutation `submitPrompt` -> Action `generateAiAnswers` -> Mutation `advanceToAnswering` with `answerDeadlineAt`.
- Handle AI errors (retry; or allow host skip to next round).

Milestone 5 – Answering & Reveal (Day 6–7)
- Player answering UI with countdown; `submitAnswer` mutation; show “Answer locked” after submit.
- When all answered or deadline passes: `lockAnswers` -> compute correctness + score -> `reveal`.
- Reveal UI; then host `advancePhase` to `scoreboard`.

Milestone 6 – Scoreboard & Next Rounds (Day 7–8)
- Leaderboard query; scoreboard UI.
- Transition `scoreboard -> prompting` (next prompter); or `finished`.

Milestone 7 – Polish & Edge Cases (Day 8–10)
- Kicking players; rejoin handling; network resilience.
- Input validation, profanity filter, name rules.
- Presenter controls: skip, end, lock answers early.
- Visual polish with Tailwind; mobile-optimized player screens.

Milestone 8 – Testing, Analytics, and Launch (Day 10–12)
- Unit/integration/E2E with mocked AI.
- Basic analytics + Sentry.
- Load test with 100+ concurrent players.
- CI/CD to Vercel + Convex Cloud; set ENV; smoke tests.

---

### Open Questions for Product Decisions
- Maximum players per session? (Default 100?)
- Join: code only, link only, or both? (Plan: both.)
- Allow users to change their display name mid-session?
- Scoring: speed bonus and streaks for MVP or later?
- Content moderation severity; can host override blocked prompts?
- Timeouts: who can extend time—host only, or auto-extend if AI is slow?

---

### Definition of Done (Production)
- All state transitions validated and race-safe on server.
- Host-only mutations fully enforced.
- Players can complete a full multi-round game without manual intervention.
- AI failures handled gracefully with retries and skip.
- E2E tests passing (host + 2 players, full flow).
- Error tracking and basic analytics enabled.
- Deployed to Vercel + Convex Cloud; environment variables set; docs updated.

---

### Implementation Notes (Engineering)
- Use Convex `actions` for AI and network; `mutations` for writes; `queries` for reads.
- Use `type` definitions in TS; avoid `interface` per project rules.
- Tailwind: `flex`, `gap-*`, `grid` for layout; avoid `space-*`.
- Keep UI render logic pure from `phase`; never invoke transitions client-side except via explicit host controls.
- For deadlines, compute remaining seconds as `Math.max(0, Math.floor((deadline - Date.now())/1000))` and render a progress bar.

---

### Next Actions (Immediate)
- Implement Convex schema for `quizzes`, `sessions`, `players`, `rounds`, `playerAnswers`.
- Create host dashboard routes and base queries.
- Create session, join flow, and basic presenter view with live player list.


