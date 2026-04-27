FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
# Copy dependency manifests first — Docker layer caching means this layer
# is only rebuilt when package.json changes, not on every code change
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Generate Prisma Client from schema
RUN npx prisma generate

# Copy source code
COPY . .

# Compile TypeScript → JavaScript
RUN npm run build

EXPOSE 3000

# Run migrations (deploy = apply pending migrations without dev prompts)
# then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
