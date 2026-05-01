# Postly — Queue-Orchestrated AI Publishing Backend

> Transform a raw idea into platform-optimized content and dispatch it across Twitter, LinkedIn, Threads, and Instagram — all through an asynchronous, fault-tolerant pipeline powered by dual-model AI.

---

## What This Does

Postly is a production-style backend that solves a real coordination problem: publishing to multiple social platforms requires different content formats, separate OAuth flows, independent retry logic, and resilience against third-party API failures — all while keeping the user-facing API fast and non-blocking.

The architecture decouples every concern. The REST API accepts requests and enqueues jobs. Workers pick up jobs independently, generate platform-aware content via GPT-4o and Claude, and publish — retrying automatically on failure with exponential backoff. Users can interact through either the REST API or a Telegram Bot interface with zero manual steps.

---

## Architecture

```text
Client / Telegram Bot (@Postly_49_Bot)
           │
           ▼
  Express REST API
  (Auth · Content · Posts · Dashboard)
           │
           ├──▶ AI Engine (OpenRouter)
           │         ├── GPT-4o  — primary content generation
           │         └── Claude  — fallback / secondary model
           │
           └──▶ BullMQ Queue Orchestrator
                      │
                      ├── Twitter Worker
                      ├── LinkedIn Worker
                      ├── Threads Worker
                      └── Instagram Worker
                               │
                    PostgreSQL (Prisma ORM) + Redis
```

For full internals, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Key Engineering Decisions

### Event-Driven Job Processing
The REST API never calls a social platform directly. Every publish request is serialized into a BullMQ job and processed by an isolated worker. This keeps API response times under 400ms regardless of third-party latency, and means a Twitter outage never affects LinkedIn publishing.

### Dual-Model AI Integration
Content generation runs through OpenRouter with GPT-4o as the primary model and Claude as a secondary. Each platform gets a dedicated structured prompt — what works on LinkedIn doesn't work on Twitter. The prompt layer is separated from the transport layer, making model swaps a config change.

### Fault Tolerance by Default
Every job has exponential backoff with up to 5 retries. If a platform's API goes down mid-publish, the job reschedules itself. The queue state is persisted in Redis, so a server restart doesn't lose in-flight work.

### Refresh Token Rotation
Auth uses short-lived JWTs with rotating refresh tokens stored as HTTP-only cookies. Each refresh cycle issues a new token pair and invalidates the previous one — eliminating token replay attacks.

---

## Technical Highlights

| Concern | Implementation |
|---|---|
| Job Queue | BullMQ + Redis with exponential backoff (max 5 retries) |
| AI Layer | GPT-4o + Claude via OpenRouter, platform-specific prompts |
| Database | PostgreSQL via Prisma ORM with composite indexes |
| Auth | JWT + refresh token rotation, HTTP-only cookies |
| Bot Interface | Telegram (Grammy) via webhook, zero UI required |
| Rate Limiting | Redis sliding-window limiter per IP |
| Validation | Zod schema validation on all request bodies |
| Testing | Jest + Supertest with full CI verification |
| Containerization | Docker Compose for local environment parity |

---

## Core Stack

- **Runtime:** Node.js, TypeScript, Express.js
- **AI:** OpenAI GPT-4o + Anthropic Claude via OpenRouter
- **Queue:** BullMQ + Redis
- **Database:** PostgreSQL + Prisma ORM
- **Bot:** Telegram (Grammy) via webhook
- **Auth:** JWT, bcrypt, HTTP-only cookies
- **Testing:** Jest, Supertest
- **DevOps:** Docker, CI/CD, Render

---

## Live Access

- **API Base URL:** [https://postly-ai-publishing-system-backend.onrender.com](https://postly-ai-publishing-system-backend.onrender.com/)
- **Telegram Bot:** [@Postly_49_Bot](https://t.me/Postly_49_Bot)

---

## Local Setup

```bash
git clone https://github.com/ashu-cloud/Postly--ai-publishing-system-backend-
cd postly
cp .env.example .env
# Fill in required environment variables
docker compose up -d postgres redis
npm install
npm run db:generate
npm run dev
```

---

## Verification

```bash
npm run build     # TypeScript compilation
npm test          # Jest test suite
npm audit --omit=dev  # Zero production vulnerabilities
npm run dev       # Server starts on port 3000
```

> If `npm run dev` throws `EADDRINUSE`, stop the process on port 3000 and retry.

---

## Security & Reliability

- Environment variable validation at startup — server won't boot with missing config
- Redis sliding-window rate limiter on all public endpoints
- Centralized error handling with structured logging
- Graceful shutdown logic for queue workers and DB connections
- Zero production dependency vulnerabilities (verified via `npm audit`)
