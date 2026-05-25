# Strapi-First Cutover (M6) – Tasklist

> Ziel: Hybridzustand beenden. Strapi wird die einzige operative Source of Truth (SoT) für Admin-relevante Daten. Legacy-Domaintabellen bleiben nur temporär als Shadow/Read-Fallback.

## Zielbild (Definition of Done)
- Admin-Änderungen in Strapi werden nicht mehr von Runtime-SQL zurücküberschrieben.
- Runtime-Writepfade schreiben primär nach Strapi (oder Strapi-zentriertes BFF), nicht in Legacy-Domaintabellen.
- Legacy-Tabellen (`Character`, `CharacterLoan`, `PortfolioItem`, `Treasury*`) erhalten keine produktiven Business-Writes mehr.
- Feature-Parität bleibt erhalten: Login, Arena, Loans, Casino, Stocks, Portfolio, Treasury.

## Inventar: aktuelle Hybrid-Hotspots (aus Code)
- `apps/web/lib/bff/serverRuntimeService.ts`
  - SQL Writes auf `Character`, `PortfolioItem`
  - `syncStrapiPortfolioAndWallet(...)` mischt Legacy- und Strapi-Update
- `apps/web/lib/bff/loanRuntimeService.ts`
  - SQL Reads/Writes auf `CharacterLoan`
  - Teilweise Strapi-Profil-Update nachgelagert
- `apps/web/lib/bff/treasuryLedgerService.ts`
  - SQL Writes/Reads auf `TreasuryLedgerEntry`, `TreasuryDaySnapshot`
- `apps/web/lib/bff/townService.ts`
  - Treasury Ledger Writes
- `apps/web/lib/bff/authLegacyService.ts`
  - Legacy-Character-Upsert/Sync
- `apps/web/lib/bff/gameReadService.ts`
  - gemischte Read-Strategie (Strapi + Legacy-Fallback)

---

## Phase 0 – Safety Net + Observability (vor funktionalem Umbau)

### Task 0.1: Feature-Flags für Cutover einführen
- Datei: `apps/web/lib/config/runtimeFlags.ts` (neu)
- Flags:
  - `STRAPI_SOT_MODE=off|shadow|on` (default: `shadow`)
  - `LEGACY_WRITE_ENABLED=true|false` (default: `true`)
  - `STRAPI_ADMIN_OVERRIDE_WINS=true|false` (default: `true`)
- Akzeptanz:
  - Flags sind zentral lesbar, mit sicheren Defaults.

### Task 0.2: Structured Logs für Domänen-Schreibpfade
- Dateien:
  - `apps/web/lib/bff/serverRuntimeService.ts`
  - `apps/web/lib/bff/loanRuntimeService.ts`
  - `apps/web/lib/bff/treasuryLedgerService.ts`
  - `apps/web/lib/bff/townService.ts`
- Ergänzen:
  - Log-Feld `write_target: legacy|strapi|both`
  - Log-Feld `source: user_action|system_tick|admin_override`
- Akzeptanz:
  - Für jeden Write ist das tatsächliche Ziel sichtbar.

### Task 0.3: Smoke-Skript für Kernflows
- Datei: `scripts/smoke/strapi-cutover-smoke.sh` (neu)
- Prüft:
  - Login
  - Loan issue/repay
  - Buy/sell
  - `/api/me` Konsistenz
- Akzeptanz:
  - Skript liefert klare Exitcodes, wird vor/nach jeder Phase ausgeführt.

---

## Phase 1 – Admin-Override schützen (sofortiger Nutzen)

### Task 1.1: Rücksynchronisierung Legacy -> Strapi abschaltbar machen
- Datei: `apps/web/lib/bff/serverRuntimeService.ts`
- Änderung:
  - In `syncStrapiPortfolioAndWallet(...)` bei `STRAPI_SOT_MODE=on` keine Legacy-basierten Rückwrites mehr in Strapi.
- Akzeptanz:
  - Admin-Wert in Strapi bleibt stabil nach User-Action.

### Task 1.2: `authLegacyService` nur noch Session-Brücke, kein fachlicher SoT-Write
- Datei: `apps/web/lib/bff/authLegacyService.ts`
- Änderung:
  - Character-Upsert nur bei fehlendem Runtime-Objekt und nur im `shadow` Mode.
- Akzeptanz:
  - Keine periodischen oder impliziten fachlichen Überschreibungen.

### Task 1.3: Admin-Wins Konfliktregel hart anwenden
- Dateien:
  - `apps/web/lib/strapiAuth.ts`
  - `apps/web/lib/bff/serverRuntimeService.ts`
- Regel:
  - Bei Konflikt gewinnt Strapi (`updatedAt`/authoritative field), nicht Legacy.
- Akzeptanz:
  - Reproduzierbarer Test: Strapi-Admin setzt Wallet/Status -> bleibt bestehen.

---

## Phase 2 – Loans komplett Strapi-zentriert

### Task 2.1: Loan Read Model auf Strapi ziehen
- Datei: `apps/web/lib/bff/loanRuntimeService.ts`
- Änderung:
  - `SELECT ... FROM "CharacterLoan"` schrittweise durch Strapi-Lesezugriffe ersetzen.
- Akzeptanz:
  - `/api/loans/me` liefert gleiche Semantik ohne Legacy-Read-Abhängigkeit.

### Task 2.2: Loan Writes auf Strapi verlagern
- Datei: `apps/web/lib/bff/loanRuntimeService.ts`
- Änderung:
  - Issue/Repay Status/Felder primär via Strapi Mutation.
- Akzeptanz:
  - Loan Lifecycle funktioniert ohne Legacy-Insert/Update.

### Task 2.3: Treasury-Buchungen aus Loan-Pfad entkoppeln (adapterbasiert)
- Dateien:
  - `apps/web/lib/bff/loanRuntimeService.ts`
  - `apps/web/lib/bff/treasuryLedgerService.ts`
- Änderung:
  - Abstraktion `recordTreasuryEvent(...)` mit backend `legacy|strapi`.
- Akzeptanz:
  - Keine direkte SQL-Kopplung im Loan-Pfad.

---

## Phase 3 – Portfolio/Wallet komplett Strapi-zentriert

### Task 3.1: Buy/Sell ohne `PortfolioItem` SQL-Write
- Datei: `apps/web/lib/bff/serverRuntimeService.ts`
- Änderung:
  - SQL `INSERT/UPDATE PortfolioItem` durch Strapi Mutation ersetzen.
- Akzeptanz:
  - Buy/Sell bleibt funktional, Portfolio wird ausschließlich aus Strapi gelesen.

### Task 3.2: Wallet-Quelle vereinheitlichen
- Dateien:
  - `apps/web/lib/strapiAuth.ts`
  - `apps/web/lib/bff/serverRuntimeService.ts`
- Änderung:
  - Wallet nur noch in Strapi autoritativ führen.
- Akzeptanz:
  - `/api/me` und UI zeigen sofort konsistente Wallet-Werte.

### Task 3.3: `gameReadService` Legacy-Fallback ausknipsbar
- Datei: `apps/web/lib/bff/gameReadService.ts`
- Änderung:
  - Bei `STRAPI_SOT_MODE=on` kein Fallback mehr auf Legacy-Lesewege.
- Akzeptanz:
  - Alle relevanten Reads laufen Strapi-only.

---

## Phase 4 – Treasury Cutover

### Task 4.1: Treasury Ledger Adapter einziehen
- Dateien:
  - `apps/web/lib/bff/treasuryLedgerService.ts`
  - `apps/web/lib/bff/townService.ts`
- Änderung:
  - `createLedgerEntry(...)` hinter Storage-Adapter, Legacy nur `shadow`.
- Akzeptanz:
  - Town/Kredit-Events funktionieren mit Strapi-zentriertem Pfad.

### Task 4.2: Snapshot-Berechnung entkoppeln
- Datei: `apps/web/lib/bff/treasuryLedgerService.ts`
- Änderung:
  - `TreasuryDaySnapshot` nicht mehr als harte Runtime-Abhängigkeit für Userflows.
- Akzeptanz:
  - Keine Blocker bei Snapshot-Drift/Schema-Diff.

---

## Phase 5 – Legacy Write Freeze + Cleanup

### Task 5.1: `LEGACY_WRITE_ENABLED=false` in Preview
- Ops:
  - PM2 Restart Preview mit Env Reload
  - Smoke ausführen
- Akzeptanz:
  - Kernflows grün, keine neuen Legacy-Business-Writes in Logs.

### Task 5.2: Staging/Live Rollout
- Reihenfolge:
  1. Preview 24h beobachten
  2. Live mit Rollback-Flag bereitstellen
- Akzeptanz:
  - Keine Regression in Loan/Casino/Stocks/Arena.

### Task 5.3: Legacy-Domaintabellen archivieren
- Scope:
  - Tabellen nur noch Archiv/Backfill, keine App-Referenz mehr.
- Akzeptanz:
  - Suche auf Runtime-SQL-Writes ergibt 0 Treffer für Business-Domänen.

---

## Reihenfolge für unsere nächsten konkreten Arbeitsschritte
1. Task 0.1 (Flags) implementieren
2. Task 1.1 (syncStrapiPortfolioAndWallet gate)
3. Task 1.2 (`authLegacyService` shadow-only)
4. Build + Smoke + PM2 Preview Restart
5. User-Verifikation Admin-Override

## Verifikation pro Phase
- Build: `npm run build --workspace web`
- Runtime: PM2 restart `bbtown-preview` mit `--update-env`
- Logcheck: keine neuen 403/uuid/ProgressEvent/Legacy-overwrite Muster
- Funktional: Loan issue/repay, buy/sell, casino spin, `/api/me` sofort konsistent

## Rollback
- `STRAPI_SOT_MODE=shadow`
- `LEGACY_WRITE_ENABLED=true`
- PM2 restart mit `--update-env`

