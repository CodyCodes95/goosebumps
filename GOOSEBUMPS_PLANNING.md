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
- Quiz: Author-owned, single-run entity with name and config (rounds, per-question time, prompt settings). A quiz can be run only once; results remain attached to the quiz. To run again, create a new quiz.
- Round: One cycle where a designated player submits a prompt; AI generates answers; others answer; results are revealed.
- Player: A participant in a quiz (anonymous name + connection metadata); stores score and per-round answers.
- PlayerAnswer: A per-round record of a player’s selected answer and latency.

---

### Game State Machine (Quiz Lifecycle)

States (phases):
1) `lobby` – Host has created a quiz. Players can join and set name.
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
- Only host can invoke mutations that transition `quiz.phase`.
- `quiz.currentRoundIndex` is monotonic.
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
  totalRounds: number; // number of rounds in the quiz
  secondsPerQuestion: number; // answering phase duration
  secondsForPrompt: number; // prompting deadline
};

type Quiz = {
  _id: Id<"quizzes">;
  authorId: string; // Clerk user id
  name: string;
  config: QuizConfig;
  phase: SessionPhase; // lifecycle state lives on quiz
  currentRoundIndex: number; // 0-based
  joinCode: string; // e.g., 6 chars
  joinLinkSlug: string; // human-friendly slug for link join
  answerDeadlineAt?: number; // only in answering phase
  promptDeadlineAt?: number; // only in prompting phase
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

// Session collection removed; quiz is single-run and holds live state

type Player = {
  _id: Id<"players">;
  quizId: Id<"quizzes">;
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
  quizId: Id<"quizzes">;
  roundIndex: number;
  prompterPlayerId: Id<"players">; // who writes the prompt
  promptText?: string; // once submitted by prompter
  aiAnswerOptions?: Array<{
    id: string; // stable id for choice
    text: string;
    isCorrect: boolean;
  }>;
  aiRequestId?: string;
  aiErrored?: boolean;
  completedAt?: number;
};

type PlayerAnswer = {
  _id: Id<"playerAnswers">;
  quizId: Id<"quizzes">;
  roundId: Id<"rounds">;
  playerId: Id<"players">;
  selectedOptionId: string;
  isCorrect: boolean;
  submittedAt: number;
  latencyMs?: number; // optional, for tie-breaking/analytics
};
```

Indexes:
- `quizzes.byJoinCode`.
- `players.byQuiz`, `players.byFingerprint`.
- `rounds.byQuizIndex` (quizId + roundIndex).
- `playerAnswers.byRound`, `playerAnswers.byPlayerAndRound`.

---

### Backend (Convex) – Functions

Split into Queries, Mutations, Actions. AI and external network calls live in Actions.

Queries:
- `listQuizzesForUser()` – quizzes owned by the current Clerk user.
- `getQuiz({ quizId })` – details of a quiz (live state included).
- `getQuizLive({ joinCode })` – quiz + players + current round + my player record.
- `getRoundsForQuiz({ quizId })` – all rounds for scoreboard.
- `getLeaderboard({ quizId })` – computed leaderboard.

Mutations (host-only unless noted):
- `createQuiz({ name, config })` – create quiz owned by user; initialize phase `lobby`, generate join code/slug.
- `updateQuizConfig({ quizId, config })` – validate ownership; only allowed in `lobby`.
- `endQuiz({ quizId })` – set `finished`.
- `startGame({ quizId })` – transition `lobby -> prompting`, create `rounds[0]`, choose prompter, set `promptDeadlineAt`.
- `submitPrompt({ quizId, roundId, promptText })` – only prompter can submit; moves to `generating` and triggers AI action.
- `advanceToAnswering({ quizId, roundId })` – internal use after AI completes; sets `answerDeadlineAt`.
- `submitAnswer({ quizId, roundId, selectedOptionId })` – player mutation during `answering`.
- `lockAnswers({ quizId, roundId })` – when timer expires or all answered; compute correctness & scoring; move to `reveal`.
- `advancePhase({ quizId })` – host advance reveal->scoreboard->next round or finished.
- `kickPlayer({ quizId, playerId })` – optional moderation.
- `joinQuiz({ joinCode, name, deviceFingerprint })` – creates a player; enforce capacity (max 50) and name constraints.
- `leaveQuiz({ quizId })` – optional; marks player as disconnected.

Actions:
- `generateAiAnswers({ quizId, roundId, promptText })` – calls Gemini via Vercel AI SDK, returns 4 options with one correct; writes to `rounds` then triggers `advanceToAnswering`.

Security & Validation:
- All host-only mutations verify `ctx.auth.getUserIdentity()?.subject === session.hostClerkUserId`.
- Player mutations verify `player.sessionId === sessionId` and player is not kicked.
- `submitAnswer` deduplicates via `playerAnswers.byPlayerAndRound` unique index.
- Transitions validate current phase before moving.

---

### Scoring
- Base: 0–1000 points per answer.
- Speed bonus: Start at 1000 for immediate correct answers and decays based on remaining time, similar to Kahoot’s model. Final score: `round(correct ? scaledPoints : 0)`.
- Streak bonus: Defer for later.
- Scoring computed server-side on `lockAnswers` using `submittedAt` vs `answerDeadlineAt`.

---

### AI Answer Generation (Action)
- Provider: Gemini via Vercel AI SDK. Use a structured output schema to enforce 1 correct and 3 plausible incorrect options.
- Output schema: exact JSON format with fields `{ correct: string; distractors: string[] }` and a derived shuffled list with IDs.
- Grounding/tools: Use Vercel AI SDK tools for Google search/grounding to improve recency and reliability of answers when needed.
- Caching: Use Redis (Upstash) to cache previously asked questions and generated options to avoid repeated model calls.
- Error handling: On failure, retry with backoff; on repeated failure, fall back to fully-AI generated question and 4 answers if prompter times out.

Example action outline:
```ts
export const generateAiAnswers = action({ args: { quizId: v.id("quizzes"), roundId: v.id("rounds"), promptText: v.string() } }, async (ctx, args) => {
  // Call Gemini via Vercel AI SDK with strict JSON schema; validate result; write to rounds; then call a mutation to move to answering.
});
```

---

### Frontend (Next.js App Router)

Routes (host):
- `/` – landing/marketing or redirect to dashboard.
- `/quizzes` – list of user’s quizzes; create quiz.
- `/quizzes/[quizId]` – quiz detail/edit; “Present” starts this quiz (single-run).
- `/present/[quizId]` – host presenter view: join code, player list, controls (start/advance/end), live phase display.

Routes (players):
- `/join` – form to enter code or paste link.
- `/join/[joinCode]` – lightweight page to enter name and join; creates Player.
- `/play/[quizId]` – player view; renders according to `phase`:
  - `lobby`: waiting room
  - `prompting`: if selected prompter, show prompt input; else standby screen
  - `generating`: loading
  - `answering`: answer options with countdown
  - `reveal`/`scoreboard`: show result/leaderboard

Presenter UI specifics:
- Controls: Start, Skip, Lock Answers, Advance, End.
- Status: Phase, timers, current round, number of answers in.
- Moderation: kick player.

Auth enforcement:
- Use page-level guards on author routes (`/quizzes*`, `/present/*`) with Clerk; do not enforce auth in `layout.tsx`.

Tailwind standards:
- Layouts rely on `flex`, `grid` as needed; spacing with `gap-*`.
- Shared components: buttons, cards, timers, progress bars; reuse existing `src/components/ui/*` where possible; bring in shadcn/ui components as needed to accelerate UI.

---

### Realtime Data Flow
- Host/players subscribe via Convex `useQuery` to quiz, players, current round, and playerAnswers counts.
- UI transitions are purely data-driven; clients never assume state—only render.
- Timers: Show client-side countdown to server-stored deadlines; actual phase change is done by host or server mutations.

Animations & Presentation polish:
- Use `framer-motion` for scene transitions (phase changes), list entrance/exit (players joining), and countdown animations.
- Consider lightweight SVG progress bars for countdowns with easing.

---

### Security & Abuse Prevention
- Auth: Host via Clerk; store `authorId` on quiz; verify via `ctx.auth.getUserIdentity()`.
- Anonymous players: Create a `players` row on join with device fingerprint; basic duplicate prevention.
- Rate limiting: Throttle joins and answers per device/IP using Redis (Upstash) tokens.
- Name sanitization: Length limits; basic character checks. No content moderation for MVP.
- Access checks in every mutation: phase guards; ownership checks; player-quiz checks.
- Privacy: No PII beyond player-chosen name; document in privacy policy.

---

### Observability & Analytics
- Error tracking: Sentry (frontend and Convex functions).
- Logs: Key transitions, AI failures, and performance timings.
- Metrics: players per quiz, answer rates, average latency, completion rate; Redis hit rate for AI cache.

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
- Frontend: Vercel (Next.js). Protect `/quizzes*` and `/present/*` with Clerk via page-level guards (not in layouts).
- Backend: Convex Cloud. Store secrets (Gemini, Redis/Upstash) in Convex environment variables.
- Domains: Nice join link `goosebumps.app/join/ABC123`.
- CI: GitHub Actions with Turbo. Lint, type-check, run unit tests, then deploy.

Dependencies and integration notes:
- Vercel AI SDK with Gemini provider for question/answer generation and tool-based grounding.
- Upstash Redis for caching repeated questions and rate limiting.
- shadcn/ui on-demand when we need a component beyond our existing UI kit.

---

### Milestones & Detailed Tasks

Milestone 0 – Repo Hygiene (Day 0–0.5)
- [x] Ensure environment setup docs in `README.md` (Convex, Clerk, OpenAI keys).
- [x] Add `ENV` documentation and `.env.example` for web and Convex.

Milestone 1 – Marketing Landing Page & Design System (Day 0.5–1.5)
- [ ] `/` – public marketing landing page: hero, value props, features, CTA to sign in/create a quiz.
- [ ] Establish design baseline: Tailwind theme tokens, typography scale, spacing rhythm; ensure use of `flex` and `gap` utilities.
- [ ] SEO basics: title/description, social image, Open Graph tags.
- [ ] Analytics hook (e.g., simple pageview) and basic lighthouse pass.
- [ ] Styling & interaction review for `/`: ensure consistency and add tasteful motion (e.g., subtle hero reveal, button micro-interactions).

Milestone 2 – Data & Auth Foundations (Day 1–2)
- [ ] Extend Convex `schema.ts` with `quizzes`, `players`, `rounds`, `playerAnswers` (single-run quizzes; no sessions).
- [ ] Implement base queries: `listQuizzesForUser`, `getQuizLive`.
- [ ] Implement mutations: `createQuiz`, `updateQuizConfig` (only in lobby).
- [ ] Wire Clerk; enforce auth at page-level on author routes (`/quizzes*`, `/present/*`); anonymous player routes open. Avoid layout-level auth.

Milestone 3 – Quiz Dashboard & Creation (Day 2–3)
- [ ] `/quizzes`: list + create form (name, rounds, timers).
- [ ] `/quizzes/[quizId]`: edit config; “Present” starts this quiz; redirect to `/present/[quizId]`.
- [ ] Styling & interaction review for `/quizzes`: ensure Tailwind consistency; add tasteful micro-interactions (hover states, empty states, toasts).
- [ ] Styling & interaction review for `/quizzes/[quizId]`: ensure form consistency, validation states, and subtle motion for save/feedback.

Milestone 4 – Presenter View & Lobby (Day 3–4)
- [ ] `/present/[quizId]`: show join code/slug; live player list; start button (host-only `startGame`).
- [ ] Styling & interaction review for `/present/[quizId]`: list animations for players joining/leaving; button feedback; accessibility.
- [ ] `/join`: entry form to enter code; creates `players` row with name + fingerprint; redirect to `/play/[quizId]`.
- [ ] Styling & interaction review for `/join`: form consistency; transitions between steps; clear error states.
- [ ] `/join/[joinCode]`: prefilled code variant to enter name and join.
- [ ] Styling & interaction review for `/join/[joinCode]`: ensure consistency with `/join`; tasteful motion.

Milestone 5 – Prompting & AI Generation (Day 4–6)
- [ ] Phase `prompting`: selected prompter sees prompt input; others see standby.
- [ ] Mutation `submitPrompt` -> Action `generateAiAnswers` (Gemini via Vercel AI SDK with grounding tools and Redis cache) -> Mutation `advanceToAnswering` with `answerDeadlineAt`.
- [ ] Handle AI errors (retry; or allow host skip to next round). If no prompt after 30s, auto-generate the full question + answers.
- [ ] Styling & interaction review for `/play/[quizId]` prompting/standby screens: input focus states, subtle transitions between sub-states, accessible labels.

Milestone 6 – Answering & Reveal (Day 6–7)
- [ ] Player answering UI with countdown; `submitAnswer` mutation; show “Answer locked” after submit.
- [ ] When all answered or deadline passes: `lockAnswers` -> compute correctness + score -> `reveal`.
- [ ] Reveal UI; then host `advancePhase` to `scoreboard`.
- [ ] Styling & interaction review for `/play/[quizId]` answering & reveal: countdown animation polish, answer selection feedback, reveal transitions.

Milestone 7 – Scoreboard & Next Rounds (Day 7–8)
- [ ] Leaderboard query; scoreboard UI.
- [ ] Transition `scoreboard -> prompting` (next prompter); or `finished`.
- [ ] Styling & interaction review for scoreboard: list entrance/exit animations, responsive layout, readable typography, color contrast.

Milestone 8 – Polish & Edge Cases (Day 8–10)
- [ ] Kicking players; rejoin handling; network resilience.
- [ ] Input validation and name rules; no content moderation for MVP.
- [ ] Presenter controls: skip, end, lock answers early.
- [ ] Visual polish with Tailwind; mobile-optimized player screens.
- [ ] Add tasteful animations (countdowns, transitions). Consider `framer-motion` for orchestrated transitions and progress animations.

Milestone 9 – Testing, Analytics, and Launch (Day 10–12)
- [ ] Unit/integration/E2E with mocked AI.
- [ ] Basic analytics + Sentry.
- [ ] Load test with 100+ concurrent players.
- [ ] CI/CD to Vercel + Convex Cloud; set ENV; smoke tests.

---

### Decisions (Previously Open Questions)
- Max players: 50
- Join: code or link (both supported)
- Name changes mid-session: Not allowed
- Scoring: Speed-based decay from 1000 for correct answers; no streaks for MVP
- Content moderation: None for MVP
- Timeouts: If prompter does not enter a prompt within 30s, AI generates the full question and 4 answers

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

#### Convex Best Practices Compliance
- Access control: All host-only mutations verify via `ctx.auth.getUserIdentity()` against `quiz.authorId`.
- Internal boundaries: Use `internalMutation`/`internalQuery` and call them from `action` with `ctx.runMutation`/`ctx.runQuery` only when needed. Avoid multiple sequential `runQuery` calls by consolidating into a single internal query when fetching related data.
- Scheduling: Trigger long or external operations via `ctx.scheduler.runAfter` to ensure mutations commit before actions execute.
- Index usage: Prefer `.withIndex` over broad `.filter` where cardinality is high.
- Argument validation: Use `v.id`/`v.object` validators for all functions.
- Transactionality: Batch multi-write operations into single mutations to preserve atomicity.
- Realtime: Use live queries for quiz, players, current round, and answer counts; avoid client-side polling.

---

### Next Actions (Immediate)
- [ ] Implement Convex schema for `quizzes`, `sessions`, `players`, `rounds`, `playerAnswers`.
- [ ] Create host dashboard routes and base queries.
- [ ] Create session, join flow, and basic presenter view with live player list.


