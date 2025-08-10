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

## Environment Variables (t3-env)

This repo uses t3-env for typesafe ENV validation.

- Web (`apps/web/src/env.ts`) validates:
  - `CLERK_SECRET_KEY`
  - `CLERK_JWT_ISSUER_DOMAIN`
  - `CONVEX_DEPLOYMENT` (optional)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_CONVEX_URL`

- Backend (`packages/backend/convex/env.ts`) validates:
  - `CLERK_JWT_ISSUER_DOMAIN`

On build, `apps/web/next.config.ts` imports `src/env.ts` via `jiti@^1` to fail fast if invalid.

Provide the following in `.env` files or your deploy provider:

```
# common
CLERK_JWT_ISSUER_DOMAIN="https://<your_clerk_domain>"

# web only
CLERK_SECRET_KEY="sk_..."  # required by Clerk middleware
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
NEXT_PUBLIC_CONVEX_URL="https://<your-convex-deployment>.convex.cloud"
CONVEX_DEPLOYMENT="dev" # optional
```
