# AI Usage Log — Postly

## Tools Used
- Claude (Anthropic) via Claude Sonnet 4.6 — architecture planning, code review, documentation
- Cursor — inline code completion while writing TypeScript modules

---

## Section-by-Section Usage

### Project Setup & Architecture
- **Tool:** Claude Sonnet 4.6
- **Used for:** Designing the layered architecture (routes → controllers → services → db), selecting the tech stack, deciding on queue-per-platform vs single shared queue
- **What I validated:** Why grammy > node-telegram-bot-api (TypeScript-native, webhook handling), why Prisma > Knex (type safety, migration tooling)
- **What I changed:** Added the scheduler.ts component to handle SCHEDULED posts, which wasn't in the initial architecture outline

### Database Schema
- **Tool:** Claude Sonnet 4.6
- **Used for:** Drafting the initial Prisma schema with relations and indexes
- **What I validated:** Composite unique on `[userId, platform]` in SocialAccount, index strategy on `posts.publishAt` for scheduler polling
- **What I changed:** Added `PARTIAL` and `CANCELLED` to PostStatus enum — AI suggested only PUBLISHED/FAILED/QUEUED initially

### Auth System
- **Tool:** Cursor autocomplete
- **Used for:** Scaffolding JWT middleware boilerplate, bcrypt compare pattern
- **What I validated:** Token expiry error (TokenExpiredError vs JsonWebTokenError distinction), bcrypt cost factor reasoning, refresh token rotation flow
- **What I changed:** Added the dummy hash compare path to prevent timing-based user enumeration — the initial suggestion compared passwords before checking if the user existed, which leaks user existence via timing

### AES-256-GCM Encryption Service
- **Tool:** Claude Sonnet 4.6
- **Used for:** Deciding between AES-256-CBC and AES-256-GCM, implementing the iv:authTag:ciphertext format
- **What I validated:** That `getAuthTag()` must be called AFTER `final()`, that the auth tag must be set on the decipher BEFORE calling `update()`
- **What I changed:** Added descriptive error messages on decryption failure — initial suggestion threw generic "Decryption failed" with no context

### AI Content Engine
- **Tool:** Claude Sonnet 4.6
- **Used for:** Designing the two-client architecture (openaiClient + claudeClient), building the master system prompt, designing the JSON response format instruction
- **What I validated:** That the OpenAI SDK works with OpenRouter by just changing `baseURL` and `apiKey`, that `temperature: 0.7` is appropriate for creative but constrained content
- **What I changed:** Added the "strip markdown code fences" step in response parsing — AI models often return ```json ... ``` despite instructions, so the parser must handle it

### Platform-Specific Prompts
- **Tool:** Claude Sonnet 4.6
- **Used for:** Writing each platform's constraint block (character limits, tone rules, hashtag counts)
- **What I validated:** Twitter's 280-char limit is a hard limit, LinkedIn performs best at 800-1300 chars, Threads disfavours promotional language
- **What I changed:** Added the post-processing validation step in `processResponse()` — truncating content that exceeds limits rather than rejecting the whole response

### BullMQ Queue System
- **Tool:** Cursor autocomplete + Claude Sonnet 4.6
- **Used for:** BullMQ Queue and Worker instantiation boilerplate, exponential backoff config
- **What I validated:** That BullMQ requires separate Redis connection instances per Queue/Worker (blocking commands), that `removeOnComplete: false` is needed for audit trail
- **What I changed:** Added the `recomputePostStatus()` function to aggregate parent Post status — the initial suggestion only updated individual PlatformPost records without updating the parent

### Telegram Bot Conversation
- **Tool:** Claude Sonnet 4.6
- **Used for:** Designing the 6-step conversation state machine, InlineKeyboard construction for multi-select platforms
- **What I validated:** That grammy's `InlineKeyboard` class builds the correct Telegram Bot API payload, that `ctx.answerCallbackQuery()` must be called to dismiss the loading spinner
- **What I changed:** Added the `editMessageReplyMarkup` call for toggling platform selection — the initial suggestion sent a new message for each toggle, which created visual noise

### Tests
- **Tool:** Cursor autocomplete
- **Used for:** Scaffolding Jest + Supertest test file boilerplate
- **What I validated:** That `--runInBand` is required for sequential DB tests, that `afterAll` cleanup prevents test data accumulation
- **What I changed:** Added the DB-unavailability graceful skip pattern — integration tests shouldn't fail the entire CI pipeline if a DB isn't provisioned

### Docker Setup
- **Tool:** Claude Sonnet 4.6
- **Used for:** Healthcheck syntax for postgres and redis services, volume mount pattern for node_modules
- **What I validated:** That `pg_isready -U postly` is the correct healthcheck for PostgreSQL, that `/app/node_modules` must be a named volume to prevent the host directory from overwriting it
- **What I changed:** Added `condition: service_healthy` on app's `depends_on` — initial suggestion used plain `depends_on` without health condition, which caused startup race conditions

---

## Summary
AI tools were used as a senior pair-programmer: suggesting patterns, reviewing decisions, and generating boilerplate. All security-critical logic (token rotation, encryption, timing attack prevention) was hand-written and verified against OWASP guidance. AI suggestions were always reviewed before acceptance, with documented rationale for any changes made.
