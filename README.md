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
- Web-Datenzugriff (aktuell): Strapi-first + PostgreSQL-Fallback
- Datenbank: PostgreSQL
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

## Strapi-First Setup (web)

Beispiel .env (siehe auch .env.example):

DATABASE_URL="postgresql://bbtown:***@localhost:5432/bbtown?schema=public"
STRAPI_URL="http://127.0.0.1:1339"
STRAPI_API_TOKEN="***"

Initiale Daten nach Strapi einspielen:

npm run seed:towns:strapi
npm run seed:buildings:strapi
npm run seed:building-states:strapi
npm run seed:stocks:strapi
npm run seed:stock-history:strapi
npm run seed:portfolio:strapi

Konsistenzcheck Market (DB vs Strapi):

npm run check:market-sync

## Wichtige Scripts

- npm run dev:web
- npm run build:web
- npm run start:web
- npm run db:up
- npm run cms:up
- npm run stack:up
- npm run stack:down
