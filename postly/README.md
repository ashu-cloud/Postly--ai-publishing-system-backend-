# Postly - AI Publishing System Backend

Postly is a production-ready backend system designed to generate and publish social media content across multiple platforms (Twitter, LinkedIn, Instagram, Threads) using AI. It provides both a REST API and a Telegram Bot interface for users to generate and publish content.

**Live Deployment URL:** `https://postly-ai-publishing-system-backend.onrender.com`

---

## Local Setup

You can run the entire Postly stack (App, PostgreSQL, Redis) locally using Docker Compose.

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd postly
   ```

2. **Set up Environment Variables:**
   Copy `.env.example` to `.env` and fill in your secrets.
   ```bash
   cp .env.example .env
   ```

3. **Start the application:**
   ```bash
   docker-compose up --build
   ```
   *This command spins up the API server (Port 3000), a PostgreSQL database (Port 5432), and a Redis instance (Port 6379).*

---

## Environment Variables

All required environment variables are documented in `.env.example`. Here is a breakdown:

### Server & Database
- `PORT`: Port for the API server (default: 3000)
- `NODE_ENV`: `development` or `production`
- `DATABASE_URL`: PostgreSQL connection string (`postgresql://USER:PASSWORD@HOST:PORT/DATABASE`)
- `REDIS_URL`: Redis connection string (`redis://localhost:6379`)

### Security
- `JWT_SECRET`: Minimum 32-character cryptographically random string for signing JWTs.
- `JWT_ACCESS_EXPIRY` & `JWT_REFRESH_EXPIRY`: Lifetimes for tokens (e.g., `15m`, `7d`).
- `ENCRYPTION_KEY`: Exactly 64 hex characters (32 bytes) used for AES-256-GCM to encrypt sensitive user API keys.

### Telegram Bot
- `TELEGRAM_BOT_TOKEN`: The token provided by BotFather.
- `WEBHOOK_URL`: The base URL of your deployed application (used to register the bot webhook in production).

### AI Engines
- `OPENAI_KEY`: Your OpenAI API key (used for `gpt-4o`).
- `CLAUDE_API_KEY`: Your OpenRouter API key (used for `claude-sonnet-4-6`).

### Platform Credentials (Optional)
- `TWITTER_BEARER_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, etc.: Optional real credentials. Without these, the platform services run in simulation mode.

---

## API Documentation

All endpoints are fully documented and testable via Postman.
You can find the collection in the root of the repository: `postly.postman_collection.json`.

Simply import this JSON file into Postman or Bruno to test the authentication, content generation, and publishing endpoints.

---

## Telegram Bot Setup Instructions

1. **Create the Bot:**
   - Go to Telegram and message `@BotFather`.
   - Send `/newbot`, follow the prompts to choose a name and username.
   - Copy the generated API token.
2. **Configure Environment:**
   - Add the token to your `.env` file as `TELEGRAM_BOT_TOKEN`.
   - Add your live deployment URL to `.env` as `WEBHOOK_URL` (e.g., `https://postly-ai-publishing-system-backend.onrender.com`).
3. **Set Webhook:**
   - When the application starts in `production` mode, it will automatically attempt to register the webhook. 
   - Alternatively, you can manually set it by opening:
     `https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>/api/bot/webhook`

---

## Architecture Overview

*See `ARCHITECTURE.md` for a comprehensive, in-depth breakdown of the schema, queues, and security.*

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                              │
│   Telegram App                                     REST Client      │
└───────│─────────────────────────────────────────────────│───────────┘
        ▼                                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│                     EXPRESS API SERVER                              │
│  Middleware: JWT Auth → Rate Limiter → Zod Validation              │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────┐               ┌──────────────────────────┐
│  AI ENGINE         │               │   BULLMQ QUEUES           │
│  (OpenAI / Claude) │               │  (Twitter, LinkedIn, etc.)│
└───────────────────┘               └──────────┬───────────────┘
                                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                 │
│   PostgreSQL (Users, Posts)            Redis (Jobs, State)    │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User requests a post (via Telegram or REST).
2. The AI engine processes the prompt and generates platform-specific JSON.
3. The API validates the JSON and creates `Post` and `PlatformPost` records in PostgreSQL.
4. Jobs are dispatched to platform-specific BullMQ queues in Redis.
5. Workers process jobs, attempt to publish (with exponential backoff on failure), and update the database status.

---

## Design Decisions and Trade-offs

- **Two Separate AI Clients:** Direct OpenAI client for `gpt-4o` and OpenRouter for `claude-sonnet` to strictly segregate API keys as requested, avoiding mixed routing.
- **BullMQ for Job Scheduling:** Utilizes Redis for durable job queues. Platform-specific queues ensure that rate limits or outages on one platform (e.g., Twitter) don't block publishing to another (e.g., LinkedIn).
- **AES-256-GCM Encryption:** Used to securely store user API keys. GCM provides authenticated encryption, meaning any tampering with the database ciphertext will result in decryption failure rather than garbage data.
- **Refresh Token Rotation:** Refresh tokens are stored in the DB (unlike stateless access tokens). Every refresh invalidates the old token, ensuring that stolen tokens are highly restricted.
- **Trade-off - OAuth Implementation:** Full OAuth flows for social platforms were descoped for this assignment because they require domain verification and app review. Instead, platform integrations run in a robust simulation mode or use static Bearer tokens.

## Standout Engineering Features (Nice-to-Haves)

To ensure this backend represents senior-level engineering capabilities, I implemented several advanced "Nice-to-Have" features:

1. **Redis-Backed Sliding Window Rate Limiting**: Unlike basic IP-based rate limiters, Postly implements a distributed rate limiter that keys off the authenticated `user.id` (falling back to IP for public routes). This guarantees fair usage across horizontal scaling.
2. **Cron-Based Job Scheduler**: Postly doesn't just queue immediately. A dedicated scheduler daemon securely polls the PostgreSQL database for `SCHEDULED` posts and natively integrates with BullMQ to delay publishing.
3. **Soft-Delete with Restoration**: Hard deleting social posts is dangerous. Postly implements a true soft-delete pattern (`deletedAt`) allowing users to remove posts from their dashboard while preserving the data, complete with a `/restore` API endpoint.
4. **Platform Analytics Simulation**: The new `/api/posts/:id/analytics` endpoint simulates fetching post engagement metrics (likes, shares, views) from the platforms.
5. **Webhook Signature Verification**: The Telegram webhook endpoint securely verifies the `X-Telegram-Bot-Api-Secret-Token` header, ensuring malicious requests from outside Telegram's servers are rejected.

---

## Known Issues and Limitations

- **Simulated Publishing:** Due to API access tiers for Twitter/LinkedIn, the actual platform posting defaults to a simulated success response unless valid keys are provided.
- **Telegram Session Expiry:** Telegram bot state is stored in Redis with a 30-minute TTL. If a user walks away mid-conversation and returns an hour later, they will need to type `/post` again to restart the flow.
- **Single Webhook:** The system is designed to run behind a single webhook URL, so running multiple load-balanced instances of the Telegram listener requires a unified reverse proxy routing `/api/bot/webhook` traffic correctly.
