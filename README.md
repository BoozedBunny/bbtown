# BoozedBunnyTown (Monorepo)

3D browserbasiertes Multiplayer-Game mit Next.js (Web-App), plus vorbereiteter CMS- und DB-Stack (Strapi + PostgreSQL via Docker).

## Neue Monorepo-Struktur

- apps/web: bestehende Next.js + Socket.io Game-App
- apps/cms: Strapi-App-Volume (wird vom Container befüllt)
- docker-compose.yml: PostgreSQL + Strapi

## Tech Stack

- Node.js: 22+
- Next.js: 15 (App Router)
- 3D: React Three Fiber, drei
- Web-Datenzugriff (aktuell): Prisma
- Datenbank-Ziel: PostgreSQL
- CMS: Strapi (Docker)

## Quickstart

1) Dependencies installieren

npm install

2) DB + CMS starten

npm run stack:up

- Postgres: localhost:5432
- Strapi Admin: http://localhost:1337/admin

3) Web-App starten

npm run dev:web

Web läuft auf http://localhost:3004

## Prisma auf PostgreSQL umstellen (web)

Die Prisma-Config in apps/web/prisma/schema.prisma ist auf PostgreSQL vorbereitet.

Beispiel .env (siehe auch .env.example):

DATABASE_URL="postgresql://bbtown:bbtown@localhost:5432/bbtown?schema=public"

Dann:

npm run prisma:generate --workspace web
npm run prisma:migrate --workspace web -- --name init_pg
npm run prisma:seed --workspace web

Hinweis: Bestehende SQLite-Daten werden bewusst nicht migriert (Beta-Reset).

## Wichtige Scripts

- npm run dev:web
- npm run build:web
- npm run start:web
- npm run db:up
- npm run cms:up
- npm run stack:up
- npm run stack:down
