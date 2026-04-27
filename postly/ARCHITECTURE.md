# Postly — System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                              │
│                                                                      │
│   Telegram App          REST Client (Postman / Web App)             │
│       │                          │                                   │
└───────│──────────────────────────│───────────────────────────────────┘
        │                          │
        ▼                          ▼
┌───────────────────────────────────────────────────────────────────┐
│                     EXPRESS API SERVER                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ /api/auth    │  │/api/user │  │/api/posts │  │/api/content │  │
│  │ /api/bot     │  │          │  │           │  │             │  │
│  └──────────────┘  └──────────┘  └───────────┘  └─────────────┘  │
│                                                                     │
│  Middleware: JWT Auth → Rate Limiter → Zod Validation              │
└───────────────────────────┬───────────────────────────────────────┘
                             │
            ┌────────────────┴──────────────────┐
            ▼                                   ▼
┌───────────────────┐               ┌──────────────────────────┐
│  AI ENGINE         │               │   BULLMQ QUEUES           │
│                    │               │                           │
│  openaiClient      │               │  twitter-publishing       │
│  → api.openai.com  │               │  linkedin-publishing      │
│  → gpt-4o          │               │  instagram-publishing     │
│                    │               │  threads-publishing       │
│  claudeClient      │               │                           │
│  → openrouter.ai   │               │  Each queue:              │
│  → claude-sonnet   │               │  - 3 attempts             │
└───────────────────┘               │  - Exponential backoff    │
                                    │  - Independent scaling    │
                                    └──────────┬───────────────┘
                                               │
                                               ▼
                                    ┌──────────────────────────┐
                                    │  PLATFORM SERVICES        │
                                    │                           │
                                    │  Twitter API v2           │
                                    │  LinkedIn UGC Posts       │
                                    │  Instagram Graph API      │
                                    │  Threads Graph API        │
                                    └──────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                 │
│                                                               │
│   PostgreSQL (Prisma)            Redis                        │
│   ┌────────┐                     ┌───────────────────────┐   │
│   │ User   │                     │ BullMQ job store      │   │
│   │ Post   │                     │ Bot sessions (TTL 30m)│   │
│   │Platform│                     │ Rate limit counters   │   │
│   │  Post  │                     └───────────────────────┘   │
│   │Refresh │                                                   │
│   │ Token  │                                                   │
│   └────────┘                                                   │
└──────────────────────────────────────────────────────────────┘
```

## How a Post Flows (End-to-End)

### Via Telegram Bot:
1. User sends `/post` → bot responds with post type keyboard
2. User selects: post type → platforms → tone → AI model → types idea
3. Bot calls AI engine → generates platform-specific content
4. Bot shows preview → user confirms
5. Bot calls `publishPost()` service
6. Service creates `Post` + `PlatformPost` records in PostgreSQL
7. Service queues one BullMQ job per platform
8. Workers pick up jobs, call platform APIs, update statuses
9. Parent `Post.status` recomputed from all `PlatformPost` statuses

### Via REST API:
1. `POST /api/posts/publish` → validates with Zod → calls `postsService.publishPost()`
2. `postsService` calls AI engine → gets generated content
3. Creates DB records → queues BullMQ jobs → returns 201 with post data

## Conversation State Management in Redis

**Key format:** `bot:session:{chatId}` (e.g., `bot:session:123456789`)

**TTL strategy:** 1800 seconds (30 minutes), reset on **every** state update.  
This means the timer restarts on each interaction — a user who takes 25 minutes per step will never expire mid-flow.

**Expiry handling:** If state key is absent when a message arrives:
- If a command: start fresh
- If a callback/text: respond "Your session expired — send /post to start a new one"

**State shape:**
```typescript
{
  step: 'POST_TYPE' | 'PLATFORMS' | 'TONE' | 'MODEL' | 'IDEA' | 'CONFIRM',
  postType?: string,
  platforms?: string[],
  tone?: string,
  model?: string,
  idea?: string,
  generatedContent?: GeneratedContent,
  userId?: string  // linked Postly user ID
}
```

## Schema Design Decisions

### Why `cuid()` over `uuid()`
`cuid()` IDs are:
- **Shorter**: 25 chars vs 36 chars — matters in URLs and logs
- **URL-safe**: no hyphens that need encoding
- **K-sortable**: monotonically increasing within the same millisecond = better B-tree index locality = faster range scans

### Why `RefreshToken` is a DB table, not a stateless JWT
Stateless JWTs cannot be invalidated before expiry. If a refresh token is stolen, an attacker can use it for its full 7-day lifetime with no way to revoke it. By storing refresh tokens in PostgreSQL:
- **Revocation**: logout immediately marks the token as revoked
- **Token rotation**: old token is revoked on every refresh call — stolen tokens become single-use
- **Forced logout**: delete all tokens for a user = global logout across all devices
- **Audit trail**: we can see when tokens were created and last used

### Why `platform_posts` is separate from `posts`
One publishing request produces **multiple independent outcomes** — one per platform.
- Twitter can succeed while LinkedIn fails
- Each platform needs its own: `status`, `errorMessage`, `attempts`, `publishedAt`
- Retry logic operates on individual `PlatformPost` records, not the whole `Post`
- Dashboard can show "posts per platform" by querying `platform_posts`

### Why composite unique index `[userId, platform]` on `social_accounts`
A user should only have ONE connected account per platform. This constraint is enforced at the database level (not just application logic), making it impossible for application bugs to create duplicates.

### Indexing Strategy
| Index | Reason |
|---|---|
| `posts.userId` | Primary filter — all post queries start with `WHERE userId = ?` |
| `posts.status` | Dashboard queries filter by status (published, failed, queued) |
| `posts.publishAt` | Scheduler polls for `WHERE status = SCHEDULED AND publishAt <= NOW()` |
| `platform_posts.postId` | Join from Post → PlatformPosts on every post detail query |
| `platform_posts.status` | Worker queries for QUEUED jobs; dashboard counts by status |
| `platform_posts.platform` | Dashboard: count posts per platform |
| `refresh_tokens.token` | Primary lookup on every `/refresh` call — must be O(1) |
| `users.email` | Login lookup — checked on every login |

## Partial Failure Handling

If Twitter fails after 3 attempts but LinkedIn succeeds:

```
PlatformPost(Twitter)  → status: FAILED,     errorMessage: "API rate limit"
PlatformPost(LinkedIn) → status: PUBLISHED,   publishedAt: 2024-01-01T12:00:00Z

Post → status: PARTIAL  (computed: some PUBLISHED + some FAILED = PARTIAL)
```

**Retry**: `POST /api/posts/:id/retry` only re-queues `FAILED` platform posts.
LinkedIn is not re-queued (already PUBLISHED). Only Twitter gets a new attempt.

**Aggregate status computation** (runs after every job success/failure):
```
All PUBLISHED        → Post.status = PUBLISHED
All FAILED           → Post.status = FAILED
Mix of both          → Post.status = PARTIAL
Some still running   → Post.status = PROCESSING
```

## Queue Architecture

### Why one queue per platform (not one shared queue)?
1. **Independent scaling**: Add 5 Twitter workers without touching LinkedIn workers
2. **Platform-specific rate limiting**: Twitter has different API limits than LinkedIn — separate queues let us tune concurrency independently
3. **Isolated failure domains**: A LinkedIn API outage fills the LinkedIn queue but doesn't block Twitter
4. **Clearer monitoring**: Queue depth per platform = meaningful operational metric

### Retry Policy
```
Attempt 1: immediate
Attempt 2: 5000ms delay (5 seconds)
Attempt 3: 25000ms delay (25 seconds)
After 3 failures: PlatformPost.status = FAILED, errorMessage recorded
```

**Why exponential backoff?**  
Prevents thundering herd — if a platform API goes down temporarily, all retrying jobs hitting it simultaneously would prolong the outage. Backoff gives the platform time to recover while spacing retries further apart on each failure.

## Security Decisions

### AES-256-GCM over AES-256-CBC
GCM (Galois/Counter Mode) provides **authenticated encryption** — it computes an authentication tag over the ciphertext. If anyone tampers with the stored ciphertext (bit-flip attack), decryption fails loudly. CBC is malleable: it doesn't detect tampering and is vulnerable to padding oracle attacks. GCM also has no padding, reducing attack surface further.

Format stored: `iv:authTag:ciphertext` (all hex, colon-separated)
- **iv**: 16 random bytes, unique per encryption — identical plaintexts produce different ciphertexts
- **authTag**: 16-byte GCM tag — proves ciphertext integrity
- **ciphertext**: encrypted payload

### bcrypt cost factor 12
OWASP recommends ≥12 for bcrypt in 2024. At cost 12, hashing takes ~250ms on modern hardware:
- Fast enough that legitimate login doesn't feel slow
- Slow enough that 10^9 guesses would take ~8,000 years on a single GPU
- Future-proof: can increase cost factor on next login without breaking existing passwords

### Refresh token rotation
On every `/auth/refresh` call:
1. Old token → `revoked: true`
2. New token → created in DB
3. Both access + refresh tokens returned

If an attacker steals a refresh token, they can only use it **once** before the legitimate user refreshes first (rendering the stolen token revoked). The legitimate user's next refresh will fail too, signalling a potential token theft.

### Tokens never in URL parameters
Tokens in URLs appear in browser history, server logs, and CDN access logs. All tokens are passed via `Authorization: Bearer <token>` header or request body only.

## Trade-offs & Descoped Items

| Item | Status | Reason |
|---|---|---|
| Full OAuth flows for platforms | Scaffolded | Full OAuth requires domain verification, app review, and production API access — not feasible for a demo assignment |
| Webhook registration on startup | Manual curl | Automatic registration would require the server's own URL, which isn't known until after deploy |
| grammy Conversations plugin | Not used | State machine via Redis is simpler and more transparent for this use case |
| Refresh token for all devices | Not implemented | Would need a deviceId concept — descoped for assignment scope |
| Rate limiting per endpoint | Global only | Per-endpoint limits would be more precise but global is sufficient for demo |
