# BoozedBunnyTown Central Market Revamp Spec ("Real Stock Exchange" UX)

## 1) Problem statement
Current `CombinedMarketView` market experience is functional but arcade-like:
- Stock catalog and company content are hardcoded to novelty names seeded in `server.ts` (`FUNNY_STOCKS`).
- Company detail has only chart + buy/sell; no contextual market narrative.
- Chart hides axes (`XAxis hide`, `YAxis hide`) so movement lacks quantitative readability.
- Tooltip behavior does not define edge-aware placement; right-edge hover popups elsewhere in town have known overflow/scrollbar risk during animation.
- No ambient market signal exists in the Town scene footer (no ticker tape).

Goal: define a scalable, data-driven market UX that feels closer to a live exchange while preserving current gameplay loop and socket update model.

## 2) Existing system baseline (grounded)
- UI: `components/CombinedMarketView.tsx`
  - List view + detail view in one dialog.
  - Data sources:
    - `GET /api/stocks`
    - `GET /api/stocks/history/[symbol]`
    - socket events `stocks_updated`, `buy_stock`, `sell_stock`, `portfolio_updated`
- Backend:
  - Price ticks every 10s in `server.ts` with random +/-5% movement and persisted `StockHistory`.
  - Initial stock seeding done at server boot from hardcoded array.
- Data model: `prisma/schema.prisma`
  - `Stock { symbol, name, price, previousPrice, updatedAt }`
  - `StockHistory { stockId, price, timestamp }`

## 3) Design principles
- Data-first: UI generated from company metadata, not hardcoded labels.
- Exchange realism over simulation complexity: believable framing, not full order book implementation.
- Backward compatible rollout: preserve existing buy/sell event contracts initially.
- Deterministic UX invariants: no overflow-induced horizontal scroll, axis labels always readable.

## 4) Proposed architecture

### 4.1 Domain model extension
Add exchange-oriented metadata with minimal schema expansion.

New `StockProfile` table (1:1 with `Stock`):
- `stockId` (PK/FK)
- `sector` (enum-like string, e.g. `Consumer`, `Energy`, `Finance`, `Tech`, `Industrial`, `Healthcare`)
- `exchange` (default `BBX`)
- `description` (1-2 sentence company synopsis)
- `hqRegion` (string placeholder)
- `marketCapBand` (`SMALL|MID|LARGE`)
- `volatilityClass` (`LOW|MEDIUM|HIGH`) used by narrative templates + future tick tuning
- `isActive` (bool)

Optional lightweight addition on `Stock`:
- `displayOrder` int (stable sorting independent of symbol)

Rationale:
- Keeps existing `Stock` and trading logic intact.
- Enables scalable addition of companies by data insertion only.

### 4.2 API contracts

A) `GET /api/stocks` response v2 (backward compatible additive fields)
For each stock include:
- existing: `id, symbol, name, price, previousPrice`
- new: `sector, exchange, marketCapBand, changeAbs, changePct, trend` (`UP|DOWN|FLAT`)

B) `GET /api/stocks/[symbol]/snapshot` (new)
Response:
- `quote`: current quote + delta fields
- `profile`: metadata from `StockProfile`
- `stats`: `dayHigh, dayLow, dayRangePct, lastUpdatedAt`
- `news`: list of narrative snippets (see 4.4)

C) `GET /api/market/ticker`
- Flat list of compact rows for footer ticker:
  - `symbol, price, changePct, trend`
- Ordered by `displayOrder` then symbol.

D) Existing `GET /api/stocks/history/[symbol]`
- Keep unchanged for phase 1.
- Phase 2 optional: include normalized interval metadata for axis ticks.

### 4.3 Placeholder company naming/content strategy
Introduce generator + seed templates rather than static meme list.

Rules:
- Ticker symbol: 3-4 uppercase letters, unique.
- Company name pattern library:
  - Prefix pool (`North`, `Blue`, `Apex`, `Summit`, `Civic`, etc.)
  - Noun pool (`Foods`, `Power`, `Logistics`, `Capital`, `Systems`, etc.)
- Sector-bound naming constraints (e.g., `Capital` more common in Finance).

Seed pipeline:
1) `scripts/seed-stock-profiles.ts` upserts stocks + profiles from JSON.
2) `data/stock-profiles.json` is source-of-truth for curated placeholders.
3) For quick expansion, optional CLI generator produces valid draft entries.

Acceptance invariant:
- Adding 20 new companies requires data file changes only, no React component edits.

### 4.4 Per-company detail "market news" narrative system
Create lightweight synthetic narrative engine, no LLM dependency.

Inputs:
- `trend` (UP/DOWN/FLAT), `changePct`, `volatilityClass`, `sector`, random seed by `(symbol + currentHourBucket)`.

Template banks:
- Positive templates: earnings optimism, demand strength, analyst upgrades.
- Negative templates: margin pressure, supply disruption, regulatory concern.
- Neutral templates: consolidation, mixed signals, low-volume drift.

Output shape:
- 3 snippets per company detail refresh.
- Each snippet: `{ id, tone, headline, body, timestampLabel }`.
- Deterministic per hour bucket to prevent flickering every re-render while still changing over time.

Guardrails:
- Never claim real-world entities/events.
- Use fictional framing labels, e.g. "BBX Desk", "Town Wire".

### 4.5 Chart UX requirements
Upgrade chart from decorative sparkline to readable quote chart.

Required behavior:
- X-axis visible with time labels at sensible interval (e.g., every N points).
- Y-axis visible with currency ticks and min/max padding.
- Horizontal grid lines visible at low opacity.
- Active point marker + crosshair tooltip.
- Tooltip content: `Time`, `Price`, `Δ vs previous point`, `Δ%`.

Visual requirements:
- Green/red line or area tint based on day trend.
- 2px line minimum, anti-aliased, no visual clipping at container bounds.
- Legend chip near chart title: `LIVE`, last update timestamp.

Empty states:
- <2 points: show "Insufficient history" panel with current quote.

### 4.6 Hover popup behavior and no-scrollbar guarantee
Scope includes market hover cards/tooltips and town-side hover popups.

Spec:
- Render popups in viewport-level portal layer (`position: fixed`) rather than inside potentially clipping/transform parents.
- Collision detection before animate-in:
  - If `anchorX + popupWidth + margin > viewportWidth`, flip alignment to left side.
  - Clamp final X within `[margin, viewportWidth - popupWidth - margin]`.
- Animate using `transform` only; do not animate width/left causing layout reflow.
- Enforce `overflow-x: clip` on top-level page shell as defensive fallback.

Acceptance invariant:
- Hovering near right edge never introduces horizontal scrollbar during entry/exit animation.

### 4.7 Town footer ticker tape concept
Add a persistent market tape band in Town view footer.

Component: `MarketTickerTape`
- Location: bottom overlay of `app/town/[townId]/page.tsx`.
- Data: `GET /api/market/ticker` + optional socket updates from `stocks_updated`.
- Motion: continuous leftward marquee, duplicated track for seamless loop.
- Item format: `SYMB 123.45 ▲1.23%` (green up/red down/gray flat).
- Interaction:
  - Hover pause animation.
  - Click item opens `CombinedMarketView` and preselects symbol.

Performance:
- CSS transform animation only.
- Avoid per-frame React state churn.

## 5) Component boundaries
- `CombinedMarketView` (container)
  - `MarketSummaryCards`
  - `MarketListTable`
  - `StockDetailPanel`
    - `QuoteHeader`
    - `StockChartPanel`
    - `MarketNewsPanel`
    - `TradeActions`
- `MarketTickerTape` (town overlay)
- `lib/marketNews.ts` (template engine)
- `lib/marketFormatting.ts` (shared quote formatting)

## 6) Non-functional requirements
- Performance:
  - Market modal initial paint <= 400ms on warm cache.
  - Ticker animation 60fps target, no forced reflow loops.
- Reliability:
  - Missing profile/news must degrade gracefully to defaults.
  - API failures show inline fallback message, not blank panel.
- Observability:
  - Log API failures with route + symbol context.
  - Client-side warn telemetry for popup collision fallback usage count.
- Maintainability:
  - All narrative templates centralized and unit-tested.

## 7) Implementation sequence (Forge-ready)
1) Data/model phase
   - Add Prisma migration for `StockProfile` (+ optional `displayOrder`).
   - Add seed JSON and deterministic seed script.
2) API phase
   - Extend `/api/stocks` with additive fields.
   - Add `/api/stocks/[symbol]/snapshot` and `/api/market/ticker`.
3) UI refactor phase
   - Split `CombinedMarketView` into subcomponents.
   - Implement chart UX upgrades with explicit axes and labels.
4) News phase
   - Add deterministic narrative template engine + `MarketNewsPanel`.
5) Hover safety phase
   - Build shared popup positioning utility and apply to market/town hover surfaces.
6) Town ticker phase
   - Implement `MarketTickerTape` and wire click-to-open behavior.
7) Hardening phase
   - Add tests + visual QA pass + regression checks.

## 8) Acceptance criteria (Sentinal-ready)
1. Company scaling
- Given new entries in `data/stock-profiles.json`, market list renders them without component code changes.

2. Detail realism
- Stock detail shows profile metadata, readable chart, and 3 narrative market news snippets.
- News snippets vary by trend direction and remain stable within same hour bucket.

3. Chart readability
- X and Y axes visible with labels/ticks; tooltip includes time and numeric deltas.
- No hidden-axis configuration remains in detail chart.

4. Hover overflow safety
- Repro case: hover targets within 24px of right viewport edge.
- Expected: popup repositions/clamps; page `scrollWidth` equals `clientWidth` during animation.

5. Ticker tape
- Footer tape animates continuously, displays all active companies, color-codes trend, and pauses on hover.
- Clicking ticker item opens market modal with that symbol selected.

6. Backward compatibility
- Buy/sell socket flows (`buy_stock`, `sell_stock`, `portfolio_updated`) remain fully functional.

## 9) Edge cases
- Unknown symbol in deep-link/select -> fallback to list view and toast "Symbol unavailable".
- History API returns empty -> show quote-only fallback with disabled chart interactions.
- Large price jumps (>20%) -> y-axis auto-padding still keeps line inside viewport.
- Long company names -> truncate in list, full text in detail header tooltip.
- User with zero holdings and zero wallet -> buy disabled with clear reason text.
- Socket disconnect during open modal -> stale badge + retry polling fallback.

## 10) Risks and rollback
Risks:
- Migration mismatch in existing SQLite envs.
- UI regressions from refactoring monolithic `CombinedMarketView`.
- Ticker overlay interfering with existing bottom-left navigation info panel.

Mitigations:
- Feature flag `MARKET_EXCHANGE_REVAMP` to gate new UI path.
- Keep old market panel as fallback for one release.
- Add z-index and safe-area contract for footer overlays.

Rollback plan:
- Disable feature flag to restore legacy market UI instantly.
- Keep additive schema fields; no destructive rollback needed.
- If ticker causes interaction issues, disable ticker independently via `MARKET_TICKER_ENABLED`.

## 11) PR narrative requirements (Steward-ready)
PR description must include:
- Before/after screenshots or short clips for: market list, stock detail chart, news panel, footer ticker.
- API contract diff summary (new fields/endpoints).
- Migration + seed instructions.
- Explicit test evidence for right-edge hover no-scrollbar acceptance case.
