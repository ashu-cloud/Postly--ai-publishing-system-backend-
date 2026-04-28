# Postly - Queue-Orchestrated AI Publishing Backend

> A production-style backend that transforms raw ideas into platform-ready content and dispatches publishing through an asynchronous, fault-tolerant pipeline.

## Why This Repo Looks Strong

- Event-driven architecture with Redis + BullMQ workers
- Platform-isolated queue model for better resiliency
- AI content generation integrated into a publish workflow
- Secure auth flows with refresh token rotation
- Typed validation and structured error handling
- Build, test, and security verification baked into workflow

## High-Level Architecture

```text
Client / Telegram Bot
        |
        v
Express API (Auth, Content, Posts, Dashboard)
        |
        +--> AI Engine
        |
        +--> Queue Orchestrator (BullMQ)
                 |
                 +--> Twitter Worker
                 +--> LinkedIn Worker
                 +--> Instagram Worker
                 +--> Threads Worker
        |
        +--> PostgreSQL (Prisma) + Redis
```

For deeper internals, see `ARCHITECTURE.md`.

## Core Stack

- Node.js, TypeScript, Express
- PostgreSQL + Prisma ORM
- Redis + BullMQ
- Telegram Bot (Grammy)
- OpenAI/OpenRouter integration layer
- Jest + Supertest

## Live Access

- API Base URL: `[https://postly-api.onrender.com](https://postly-ai-publishing-system-backend.onrender.com/)`
- Telegram Bot: `@PostlyPublishBot`

## Local Setup

```bash
git clone https://github.com/[your-username]/postly
cd postly
cp .env.example .env
# Fill required variables
docker compose up -d postgres redis
npm install
npm run db:generate
npm run dev
```

## Testing & Verification

Run from project root:

```bash
npm run build
npm test
npm audit --omit=dev
npm run dev
```

Expected:
- TypeScript build passes
- All Jest tests pass
- Audit reports zero production vulnerabilities
- Server starts on port `3000`

If `npm run dev` hits `EADDRINUSE`, stop the process using port `3000` and restart.

## Public Security & Reliability Notes

- Environment validation at startup
- Authenticated encryption for sensitive values
- Global rate limiting and schema validation
- Centralized error handling and structured logging
- Graceful shutdown logic for dependencies

## Scope Notes

- OAuth platform flows are scaffolded for assignment scope
- Some publishing integrations are demo-oriented
- Project focus is backend architecture and orchestration
