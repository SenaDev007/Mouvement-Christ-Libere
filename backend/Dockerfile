FROM node:22-slim

WORKDIR /app

# Install OpenSSL (required by Prisma on node:22-slim)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ⭐ V3.72 — 3000 par cohérence avec le défaut applicatif. NOTE : l'app écoute
# en réalité sur TOUS les ports candidats ($PORT injecté, 3001, 3000) — voir
# src/index.ts — donc le routage Railway aboutit quel que soit le port cible.
EXPOSE 3000

CMD ["npm", "start"]
