# BBTown: Ticker click deep-link to Central Management Market detail

## Problem statement
Current town-page ticker flow sets `marketPreselectedSymbol` and opens `CombinedMarketView`, but `CombinedMarketView` defaults to `Tabs defaultValue="treasury"`. Result: user lands on Treasury first and must manually switch tabs before seeing stock detail.

## Constraints
- Preserve existing Central Management modal (`CombinedMarketView`) entry points.
- Keep backward compatibility for non-ticker open paths (bank button should still open Treasury).
- No server/API contract change required.
- Handle stale/invalid symbol robustly.

## Root cause
- `app/town/[townId]/page.tsx` ticker click:
  - sets preselected symbol
  - sets modal open
- `components/CombinedMarketView.tsx`:
  - consumes `preselectedSymbol` and sets `selectedStock`
  - tab state is uncontrolled with `defaultValue="treasury"`
  - no route-level intent state, so tab choice cannot be externally controlled

## Proposed design (chosen)
Adopt a hybrid routing + modal-intent approach:
1) URL query carries canonical deep-link intent (shareable/reload-safe).
2) Local modal state executes the intent immediately (no full page navigation).

### URL/query contract
Town page query params:
- `cm=market|treasury`
- `symbol=<UPPERCASE_TICKER>` (optional, valid only when `cm=market`)

Examples:
- `/town/1?cm=market&symbol=BANA` -> open central management on Market tab with BANA detail selected.
- `/town/1?cm=market` -> open central management on Market tab list view.
- `/town/1?cm=treasury` -> open central management on Treasury tab.

### Modal state contract
Introduce a single intent object passed into `CombinedMarketView`:

`type CentralManagementIntent = { tab: "treasury" | "market"; symbol?: string | null; source: "ticker" | "bank" | "query" | "manual" }`

`CombinedMarketView` prop changes:
- Replace `preselectedSymbol` with `intent?: CentralManagementIntent | null`
- Add `onIntentConsumed?: () => void`

### CombinedMarketView behavior
- Use controlled tab state:
  - `const [activeTab, setActiveTab] = useState<"treasury"|"market">("treasury")`
  - `<Tabs value={activeTab} onValueChange={...}>`
- On modal open + intent:
  - set `activeTab = intent.tab`
  - if `intent.symbol` present:
    - wait until `stocks` loaded
    - find matching stock by symbol (case-insensitive normalize to uppercase)
    - if found: set `selectedStock` and keep `activeTab="market"`
    - if missing: set `selectedStock=null`, keep `activeTab="market"`, show non-blocking toast: `"{SYMBOL} is no longer listed."`
- Consumption semantics:
  - consume intent exactly once per open cycle (`onIntentConsumed`) to prevent re-application from socket refreshes/state updates.

### Town page orchestration
In `app/town/[townId]/page.tsx`:
- Add `useSearchParams` + `usePathname` + existing `useRouter`.
- Parse initial/query-updated `cm` + `symbol` to build intent and open modal.
- On ticker click:
  - `router.replace(`${pathname}?cm=market&symbol=${symbol}` , { scroll: false })`
  - set modal open + same local intent immediately.
- On bank CTA click:
  - `router.replace(`${pathname}?cm=treasury`, { scroll: false })`
  - set modal open with treasury intent.
- On modal close:
  - clear query params (`router.replace(pathname, { scroll: false })`) to avoid accidental reopen on refresh/back.

## Fallback and edge-case behavior
1) Symbol missing from query/ticker payload:
- Open Market tab list view (`selectedStock=null`), no error toast.

2) Symbol not found in current stocks:
- Open Market tab list view, toast once, do not force Treasury fallback.

3) Stocks API fails:
- Modal still opens on Market tab; show current empty/loading state + error toast (existing patterns can be reused).

4) User manually changes tab after deep-link:
- Manual tab choice takes precedence; do not auto-switch again until a new explicit intent arrives.

5) Re-click same ticker symbol while modal open:
- Re-apply intent: ensure Market tab active and detail refreshed/selected.

## Tradeoff analysis
Option A: local state only (no query)
- Pros: simplest code.
- Cons: not shareable, not reload-safe, weak for future external entry points.

Option B: query only (derive all behavior from URL)
- Pros: single source of truth.
- Cons: slower UX coupling to routing, more brittle with modal lifecycle.

Option C (chosen): hybrid query + local intent
- Pros: immediate UX response, deep-link persistence, clear separation of canonical intent vs transient UI state.
- Cons: slightly more state plumbing.

## Affected modules
- `app/town/[townId]/page.tsx`
- `components/CombinedMarketView.tsx`
- (Optional) new shared type file: `lib/ui/centralManagementIntent.ts`

## Implementation task breakdown (Forge)
1) Introduce `CentralManagementIntent` type and migrate props.
2) Convert `CombinedMarketView` tabs to controlled state + intent application effect.
3) Implement symbol normalization + not-found fallback behavior.
4) Add query parsing and URL synchronization in town page.
5) Wire ticker and bank open handlers to emit intent + query updates.
6) Clear query on modal close.
7) Add focused unit/component tests around intent application.

## QA acceptance criteria (Sentinal)
- AC1: Clicking ticker symbol opens Central Management directly on Market tab.
- AC2: Clicking ticker symbol opens matching company detail panel without extra click.
- AC3: Invalid symbol opens Market list view and shows one clear warning toast.
- AC4: Bank "View Central Management" still opens Treasury tab.
- AC5: `?cm=market&symbol=BANA` URL directly opens modal on BANA detail.
- AC6: Closing modal clears query and refresh does not auto-reopen modal.
- AC7: While modal open, clicking another ticker switches detail to new symbol and stays on Market tab.
- AC8: No regression in buy/sell actions or portfolio updates after deep-link entry.

## Regression test matrix
- Ticker click when modal closed
- Ticker click when modal already open on Treasury
- Ticker click when modal already open on Market/detail
- Unknown symbol
- Empty symbol
- Slow stocks fetch (intent arrives before stocks)
- Browser back/forward with query states

## Rollout and rollback
Rollout:
- Ship behind no feature flag (low blast radius, UI-only behavior).
- Monitor client errors/toast anomalies around symbol parsing and null stock selection.

Rollback:
- Revert `CombinedMarketView` intent+controlled-tabs changes and query sync wiring.
- Existing behavior (Treasury default) returns cleanly without data migration.

## PR narrative expectations (Steward)
- Explain root cause: uncontrolled Tabs default to Treasury.
- Show before/after flow diagram for ticker click.
- Highlight compatibility: bank path unchanged, no API changes.
- Include GIF/video proving direct Market detail entry and invalid-symbol fallback.