# Image de production — Bun exécute directement le TypeScript (pas d'étape build).
FROM oven/bun:1 AS base
WORKDIR /app

# 1) Dépendances (couche cachée tant que le lockfile ne change pas).
#    On installe AUSSI les devDependencies : drizzle-kit sert aux migrations
#    jouées au démarrage.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2) Code applicatif (inclut drizzle/ = migrations SQL).
COPY . .

ENV NODE_ENV=production
# La plateforme injecte PORT ; main.ts lit process.env.PORT (défaut 3000).
EXPOSE 3000

# Migrations Drizzle (idempotentes) PUIS démarrage de l'app + cron in-process.
# Image auto-suffisante (valable Render, Railway, etc.) : pas besoin d'un
# pre-deploy spécifique à la plateforme.
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun run src/main.ts"]
