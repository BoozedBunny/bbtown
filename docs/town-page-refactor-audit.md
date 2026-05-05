# BBTown Town Page Refactor Audit (one-PR plan)

Target: `app/town/[townId]/page.tsx` (+ tightly related modules)

## Current state snapshot

- `page.tsx` is large (1284 LOC) and combines 3D scene wiring, socket lifecycle, domain data fetch/merge, dev transform controls, property management, and arena matchmaking modal UI.
- Hardcoded building seed data (`HARDCODED_BUILDINGS`) and type definitions live directly in the page.
- There is at least one dead/unused helper: `createRoads()` is defined but not referenced.
- Repeated async logic appears in multiple handlers (`fetch /api/town/${townId}/state`, `getCurrentUser`).
- Type safety is weakened by multiple `any` usages and repeated `(selectedBuilding as any)` casts.

## Ranked refactor plan (low risk, one PR)

### 1) Extract building seed/config data and town page types
Priority: P0 (do first)

Scope:
- Move `BuildingData` and `HARDCODED_BUILDINGS` out of `page.tsx` into dedicated modules, e.g.:
  - `app/town/[townId]/town-config.ts` (or `lib/town/town-config.ts`)
  - `app/town/[townId]/town-types.ts`
- Export constants for special building IDs currently magic-numbered (`"4"` bank, `"21"` arena).

Why this first:
- Directly addresses task requirement.
- Lowest behavioral risk (pure relocation + imports).
- Makes future changes (transform persistence, content edits, test fixtures) independent of page component complexity.

Expected impact:
- `page.tsx` shrinks and becomes easier to scan.
- Single source of truth for town layout seed and building metadata shape.
- Reduces accidental merge conflicts in page UI code when updating building data.

Implementation notes:
- Keep values identical on first extraction (no semantic changes).
- Update `app/actions/dev.ts` to target new config file path if needed, or better, mark as follow-up if it currently relies on editing `page.tsx` source text.

---

### 2) Extract data orchestration into a local hook (`useTownPageData`)
Priority: P1

Scope:
- Move state/data lifecycle logic into `hooks/useTownPageData.ts` (or colocated file):
  - user fetch (`getCurrentUser`)
  - town state fetch (`/api/town/${townId}/state`)
  - socket init/connect/disconnect + event subscriptions
  - refresh helpers reused by update/buy handlers
- Keep view state (dialogs/open flags) in page for now.

Why:
- Removes duplicated fetch logic in multiple handlers.
- Centralizes side-effect-heavy logic for easier testing and debugging.

Expected impact:
- Lower cognitive load in `page.tsx` render path.
- Fewer stale-data bugs due to one canonical refresh function.
- Easier future replacement of imperative fetch calls with SWR/React Query.

Low-risk guardrails:
- Preserve current event names and payloads.
- Keep same initial fetch timing (`useEffect` on `townId`).

---

### 3) Extract merged building computation into pure utility
Priority: P1

Scope:
- Move `mergedBuildings` computation from `useMemo` body into pure function, e.g. `mergeBuildingState(...)` in `lib/town/merge-building-state.ts`.
- Function inputs:
  - base buildings
  - db building states
  - position overrides
  - rotation overrides
  - free-move state

Why:
- Current merge logic is business-critical and currently embedded in view component.
- Pure function is easy to unit test and reason about.

Expected impact:
- Better correctness confidence with focused tests.
- Smaller component body and clearer separation of render vs. domain mapping.

---

### 4) Split big dialogs into focused components
Priority: P2

Scope:
- Extract at least two components from page:
  - `TownBuildingDialog` (property/bank/owner view)
  - `ArenaMatchmakingDialog`
- Pass explicit props and callbacks.

Why:
- Dialog JSX dominates file length and obscures top-level page flow.

Expected impact:
- Page becomes orchestration shell.
- UI-specific changes isolated, easier review and snapshot testing.

Low-risk guardrails:
- Keep styling/classes and event callback signatures unchanged in first pass.

---

### 5) Type tightening and cast cleanup
Priority: P2

Scope:
- Replace `useState<any>(...)` and `useState<any[]>(...)` with explicit interfaces.
- Remove `(selectedBuilding as any)` via enriched `BuildingData` type or a derived `SelectedBuilding` type.
- Replace broad `e: any` pointer handlers with React Three Fiber event types where feasible.

Why:
- Current casts hide possible runtime errors and make refactors brittle.

Expected impact:
- Safer edits and better editor tooling.
- Fewer accidental property access bugs.

---

### 6) Dead code and naming cleanup
Priority: P3

Scope:
- Remove unused `createRoads()` or wire it properly if intended.
- Audit for unused imports/variables after extraction.
- Normalize naming for coordinate labels in dev move UI (current labels suggest axis mismatch: Y-/Y+ buttons call `handleMove("z", ...)`; Z+/Z- buttons call `handleMove("y", ...)`).

Why:
- Low effort cleanup that reduces confusion and maintenance cost.

Expected impact:
- Cleaner codebase and less ambiguity for future contributors.

## Suggested one-PR implementation order

1. Extract `BuildingData` + `HARDCODED_BUILDINGS` + special IDs constants.
2. Update imports/usages in page and verify behavior unchanged.
3. Introduce centralized refresh helpers (`refreshTownState`, `refreshCurrentUser`) and replace duplicate inline logic.
4. Move socket/data orchestration into `useTownPageData` hook while preserving API surface to page.
5. Extract `TownBuildingDialog` + `ArenaMatchmakingDialog` components with no behavior changes.
6. Tighten types/remove `any` casts in touched areas.
7. Remove dead `createRoads()` and run lint/typecheck.

## Validation checklist for the PR

- Town page renders same initial scene and building interactions.
- Buying and updating property still refreshes wallet, ownership, and market state.
- Dev move flow still updates transforms and free-move placement path.
- Arena modal still enters/cancels matchmaking and redirects on `match_found`.
- Typecheck and lint pass.

## Notable risks and mitigations

- Risk: `updateBuildingTransform` currently edits `page.tsx` source directly via string replacement.
  - Mitigation: If extracting building config first, either:
    - Update `updateBuildingTransform` to edit the new config file, or
    - Keep a temporary compatibility path and schedule follow-up migration in same PR.
- Risk: socket/event lifecycle regressions during hook extraction.
  - Mitigation: preserve event names/payloads, and keep cleanup (`disconnect`) semantics unchanged.

## Additional nearby opportunity (optional, still low risk)

- `components/Building.tsx` appears unused in current tree and can be removed after confirming no dynamic imports/tests reference it.
