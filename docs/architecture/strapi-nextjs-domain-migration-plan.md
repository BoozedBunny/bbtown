# Strapi-first Domain Migration Plan (bbtown)

> Ziel: Legacy-DB-Tabellen im Web schrittweise durch Strapi-Content-Types ersetzen, ohne Live-Stabilität zu verlieren.

## 1) Zielbild

- Strapi ist Source of Truth für Domain-Daten.
- NextJS/Web liest und schreibt Domain-Daten über Strapi (BFF/API-Wrapper im Web).
- Legacy-Tabellen/Bootstrap-SQL nur als Übergang, danach entfernbar.

## 2) Domain-Mapping

- User -> Strapi users-permissions User
- Character -> Strapi player-profile (1:1 User-Relation)
- Stock -> Strapi content-type `stock`
- StockHistory -> `stock-history`
- PortfolioItem -> `portfolio-item`
- Town -> `town`
- Building (neu, statische Stammdaten aus town-config.ts) -> `building`
- BuildingState (dynamisch) -> `building-state`
- TreasuryLedgerEntry -> `treasury-ledger-entry`
- TreasuryDaySnapshot -> `treasury-day-snapshot`
- CharacterLoan -> `character-loan`
- LoanRepayment -> `loan-repayment`
- LoanOperation -> `loan-operation`

Wichtig: `building` (statisch) und `building-state` (dynamisch) bleiben getrennt.

## 3) Phasenplan

### Phase A: Strapi-Modelle + Readiness

A1. Content-Types in `apps/cms/src/api/*` anlegen
- Für jeden oben genannten Typ: schema/controller/route/service
- Slugs konsistent in kebab-case
- Wo sinnvoll: draftAndPublish aktivieren

A2. Relations modellieren
- player-profile <-> user (bestehend)
- portfolio-item -> player-profile, stock
- stock-history -> stock
- building-state -> building, owner(player-profile), town
- treasury-* -> town
- character-loan -> player-profile, town
- loan-repayment -> character-loan, player-profile
- loan-operation -> character-loan (optional), player-profile

A3. Rechte
- Public: nur read für Endpunkte, die anonym gebraucht werden
- Schreiboperationen nur serverseitig mit Token (STRAPI_API_TOKEN)

A4. Admin-Check
- Strapi Admin: Typen sichtbar, Einträge anlegbar, Relationen auswählbar

### Phase B: Datenmigration/Seeds

B1. Building-Stammdaten-Seed
- Quelle: `apps/web/app/town/[townId]/town-config.ts`
- Ziel: `building`
- Idempotent über `externalId` (z. B. buildingId als String)

B2. Town-Seed
- Quelle: `apps/web/app/town/towns.ts`
- Ziel: `town`

B3. Building-State-Seed
- Ziel: `building-state` je Town/Building
- initial forSale/price/title/employees setzen

B4. Stock/StockHistory Import
- bestehende Bestandsdaten in `stock` / `stock-history` hochziehen
- idempotent upsert + timestamp-basierte history inserts

### Phase C: NextJS Read-Pfade umstellen

C1. Web-CMS Client erweitern (`apps/web/lib/cms.ts`)
- typed fetch helpers für collections/single/document
- retry/fallback nur wo nötig

C2. Town-Read umstellen
- `apps/web/lib/bff/gameReadService.ts`
- Town + BuildingState aus Strapi statt SQL

C3. Market-Read umstellen
- `marketReadService.ts`
- Stocks + Portfolio aus Strapi

C4. Treasury/Loan-Read umstellen
- treasury summary und loan state aus Strapi

### Phase D: NextJS Write-Pfade umstellen

D1. Building-Kauf/Update
- `townService.ts` -> Strapi write endpoints

D2. Stock buy/sell + Socket-Pfade
- Realtime handler auf Strapi-backed service ziehen

D3. Loan issue/repay + delinquency sweep
- server runtime service auf Strapi writes umstellen

### Phase E: Cleanup

E1. `town-config.ts` als Domain-Quelle entfernen
- nur Rendering-Meta behalten, falls noch nötig

E2. Legacy SQL-Layer entfernen
- Bootstrap/Seed für Legacy-Tabellen nur noch optional archivieren

E3. Deploy vereinfachen
- deploy-live.sh auf Strapi-first Datenfluss trimmen

## 4) Konkrete Ausführung (Start jetzt)

1. Strapi Content-Types implementieren (Phase A1/A2)
2. Building/Town Seeder skripten (Phase B1/B2)
3. Web-Read für Town + BuildingState zuerst umstellen (Phase C2)

Warum diese Reihenfolge:
- Town/Building ist der klarste sichtbare Pfad
- minimiert Risiko gegenüber Loans/Realtime zuerst

## 5) Abnahmekriterien

- Kein 502 durch fehlende Legacy-Relationen im Web-Startup
- Town-Ansicht lädt aus Strapi-Daten (nachweisbar durch geänderte Admin-Werte)
- Building-Kauf ändert `building-state` in Strapi konsistent
- Market/Loan Views lesen stabil ohne SQL-Relation-Fehler

## 6) Risiken und Gegenmaßnahmen

- Risiko: Relaunch bricht wegen unvollständiger Relations
  - Gegenmaßnahme: zuerst read-only Pfade migrieren, writes später
- Risiko: PM2-Env drift
  - Gegenmaßnahme: `--update-env`, fixe env im PM2 setup
- Risiko: Strapi Permission 403
  - Gegenmaßnahme: Public read matrix vor Go-Live prüfen

## 7) Nächste konkrete Task-Liste (umsetzbar)

- Task 1: Strapi `town`, `building`, `building-state` content-types anlegen
- Task 2: Seed-Skript `scripts/seed-buildings-to-strapi.ts` erstellen
- Task 3: Seed-Skript `scripts/seed-towns-to-strapi.ts` erstellen
- Task 4: Web `getTownStateById` auf Strapi umstellen
- Task 5: Smoke-Test lokal + auf preview (PM2) + Live rollout
