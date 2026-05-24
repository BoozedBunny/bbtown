# M5 Inventory: Prisma/SQLite Ausbauplan (Stand: 2026-05-23)

## 1) Prisma-Artefakte im Repo

- apps/web/lib/prisma.ts
- apps/web/prisma/schema.prisma
- apps/web/prisma/seed.ts
- apps/web/prisma/migrations/* (historisch, nicht mehr aktiv gescannt per filename, aber vorhanden im Verzeichnis)

## 2) Package-/Script-Abhängigkeiten

### apps/web/package.json
- dependency: `@prisma/client`
- devDependency: `prisma`
- scripts:
  - `prisma:generate`
  - `prisma:migrate`
  - `prisma:seed`

### Root package.json
- keine direkten Prisma-Deps, aber DB-Orchestrierung via docker compose (`db:up`, `db:down`)

## 3) Laufzeit-Kopplungen an Prisma (produktiv)

### Kernmodule
- apps/web/server.ts
  - direkte `PrismaClient` Nutzung
  - Runtime Schema-Guard mit `npx prisma db push`
  - Markt-/Historie-/Portfolio-/Arena- und Legacy-Write-Pfade

- apps/web/lib/treasury/loanService.ts
  - Loan issue/repay/sweep, inkl. updateMany-Operationen

- apps/web/lib/treasury/treasuryService.ts
  - Ledger/Settlement Zugriff über Prisma

- apps/web/lib/auth.ts
  - Legacy Character/User Bridge via prisma.user/prisma.character

- apps/web/app/actions/*
  - `character.ts`, `work.ts`, `town.ts`, `user.ts` (teilweise fallback/legacy reads+writes)

- apps/web/app/api/*
  - z. B. stocks, market/ticker, portfolio, town state, casino spin (fallback)

## 4) Test-/Dev-Kopplungen

- apps/web/tests/loanService.test.ts
- apps/web/tests/benchmarkLoanSweep.ts
- apps/web/tests/verifyLoanSweep.ts

Diese sind explizit Prisma-basiert (Mocks/Upserts/DeleteMany etc.).

## 5) ENV/Config Kopplungen

- `.env.example` (root + apps/web): `DATABASE_URL` dokumentiert
- `apps/web/prisma/schema.prisma`: datasource über `DATABASE_URL`
- `apps/web/server.ts`: prüft `DATABASE_URL` + Schema-Repair

## 6) Zielbild für M5

- Keine Runtime-Abhängigkeit von Prisma im Web-App-Produktivpfad.
- Kein `PrismaClient` Import mehr in produktiven Web-Routen/Actions/Server.
- Kein `prisma db push` mehr zur Laufzeit.
- Prisma-Pakete/Skripte aus apps/web/package.json entfernt.
- Legacy-SQLite/Prisma-Schema/Seed entfernt oder in `legacy/` archiviert.

## 7) Empfohlene Umsetzungsreihenfolge (schrittweise, ohne Big Bang)

1. **Runtime-Blocker entfernen**
   - `server.ts`: Schema-Guard + `npx prisma db push` eliminieren.

2. **Markt/Read-Pfade auf Strapi/BFF umstellen**
   - stocks, ticker, history, portfolio reads.

3. **Treasury/Loan Kern in BFF-Service überführen**
   - `loanService` + `treasuryService` Prisma-frei machen (Strapi-backed oder dedizierter Service-Store).

4. **Legacy Bridge abbauen**
   - `lib/auth.ts` ensureLegacyCharacterForSession nur noch no-op/entfernen, sobald alle Aufrufer migriert.

5. **Actions/API bereinigen**
   - verbleibende Prisma-Fallbacks in actions/api entfernen.

6. **Dependencies cleanup**
   - `@prisma/client`, `prisma` + prisma scripts entfernen.
   - `apps/web/lib/prisma.ts`, `apps/web/prisma/*` löschen/archivieren.

7. **Regression + Deploy-Check**
   - build/start, auth, loan issue/repay/sweep, arena rewards, town buy/sell, trading buy/sell, portfolio/ticker/history.

## 8) Risiko-Hotspots

- server.ts (viel Geschäftslogik + Socket-Events)
- loanService/treasuryService (idempotency, financial invariants)
- Übergangs-Identitätsmodell (Strapi authUserId vs legacy characterId)

## 9) Nächster konkreter Schritt (direkt als m5.1)

- `server.ts` von runtime `prisma db push` entkoppeln und PrismaClient-Direktnutzung kapseln/ersetzen,
  damit Produktionsstart nicht mehr von Prisma-Schema-Operationen abhängt.
