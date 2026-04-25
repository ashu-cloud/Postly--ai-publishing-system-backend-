# Postly — Multi-Platform AI Content Publishing Engine

> Backend API for Postly: drop a raw idea into Telegram, pick your platforms, and publish AI-generated content automatically.

## 🌐 Live API
**Base URL:** `https://postly-api.onrender.com`
**Telegram Bot:** `@PostlyPublishBot`

## ⚡ Quick Start (Local)

```bash
git clone https://github.com/[your-username]/postly
cd postly
cp .env.example .env
# Fill in your .env values
docker-compose up
```

API will be available at `http://localhost:3000`

## 📚 API Documentation
Import `postly.postman_collection.json` into Postman and set the `baseUrl` variable.

## 🤖 Telegram Bot Setup
1. Create a bot via @BotFather → get token
2. Add `TELEGRAM_BOT_TOKEN` to `.env`
3. Set webhook: `curl https://api.telegram.org/bot{TOKEN}/setWebhook?url={YOUR_URL}/api/bot/webhook`
4. Message the bot `/start`

## 🏗 Architecture
See `ARCHITECTURE.md` for full system design, data flow, and schema decisions.

## 🔧 Environment Variables
See `.env.example` — every variable is documented.

## ✅ Running Tests
```bash
npm test
```

## ⚠️ Known Limitations
- Platform OAuth flows are scaffolded (not full callbacks) — tokens must be manually provided
- Instagram publishing uses Graph API scaffold — full approval requires Facebook app review
- Rate limiting: 100 requests per 15 minutes per user
