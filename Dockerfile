# Image de production — Bun exécute directement le TypeScript (pas d'étape build).
FROM oven/bun:1 AS base
WORKDIR /app

# 1) Dépendances (couche cachée tant que le lockfile ne change pas).
#    On installe AUSSI les devDependencies : drizzle-kit sert aux migrations
#    jouées en pre-deploy (railway.json).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2) Code applicatif (inclut drizzle/ = migrations SQL).
COPY . .

ENV NODE_ENV=production
# Railway injecte PORT ; main.ts lit process.env.PORT (défaut 3000).
EXPOSE 3000

# Démarrage de l'app + du cron in-process. Les migrations sont jouées AVANT
# via le preDeployCommand de railway.json (pas à chaque redémarrage).
CMD ["bun", "run", "src/main.ts"]
