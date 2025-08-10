# goosebumps

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Convex** - Reactive backend-as-a-service platform
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.



## Project Structure

```
goosebumps/
├── apps/
│   ├── web/         # Frontend application (Next.js)
├── packages/
│   └── backend/     # Convex backend functions and schema
```

## Available Scripts

- `bun dev`: Start all applications in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:setup`: Setup and configure your Convex project
- `bun check-types`: Check TypeScript types across all apps
- `bun check`: Run Biome formatting and linting

## Environment Setup

This repo uses t3-env for typesafe ENV validation. Builds will fail fast if variables are missing because `apps/web/next.config.ts` imports `src/env.ts` via `jiti`.

### Web (`apps/web`)
- Validated in `apps/web/src/env.ts`:
  - `CLERK_SECRET_KEY`
  - `CLERK_JWT_ISSUER_DOMAIN`
  - `GOOGLE_GEMINI_API_KEY`
  - `CONVEX_DEPLOYMENT` (optional)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_CONVEX_URL`

Create `apps/web/.env.local` using the example at `apps/web/env.example`:

```bash
cp apps/web/env.example apps/web/.env.local
```

Then edit the values:

```
# Clerk
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_JWT_ISSUER_DOMAIN="https://<your_clerk_issuer_domain>"

# Convex
NEXT_PUBLIC_CONVEX_URL="https://<your-convex-deployment>.convex.cloud"
CONVEX_DEPLOYMENT="dev"

# AI (Gemini)
GOOGLE_GEMINI_API_KEY="..."
```

### Convex (`packages/backend/convex`)
- Validated in `packages/backend/convex/env.ts`:
  - `CLERK_JWT_ISSUER_DOMAIN`

Convex reads env vars from its deployment. Set them with the CLI:

```bash
# from repo root
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<your_clerk_issuer_domain>"
npx convex env set GOOGLE_GEMINI_API_KEY "<your_gemini_api_key>"
```

An example reference file is provided at `packages/backend/convex/convex.env.example`.
