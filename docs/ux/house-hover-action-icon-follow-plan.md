# BBTown house hover action icon follow plan

## Scope
Improve the building hover action icon so it is easier to click while preserving stable hover behavior and avoiding jitter/perf regressions.

## Current behavior analysis (from `components/ModelBuilding.tsx`)
1. Hover state is local (`hovered`) and toggled by model `onPointerOver/onPointerOut` plus icon `onPointerOver/onPointerOut`.
2. Hide is delayed by 150ms (`hideTimeoutRef`) to bridge pointer travel from model to icon.
3. Icon appears via `<Html position={iconPosition} center>` and is removed immediately when `hovered=false`.
4. Icon has bounce animation and no expanded invisible hit target; clickable area is effectively only the visible circle.
5. There is no mouse-follow logic yet; icon is fixed at model-top anchor.

## Root UX issues
1. Hover disconnect: moving quickly between model and icon can still miss the 150ms bridge and hide icon.
2. Hit-area too small: click affordance relies on a tight visible icon.
3. Potential overlap conflict: neighboring buildings can steal hover while pointer moves fast.
4. If follow is implemented naively with direct `setState` on every pointer event, jitter and React re-render pressure will occur.

## Proposed interaction model

### 1) Two-zone hover lock (model zone + icon zone)
Use explicit zone counters instead of only timeout-driven toggling.

State/refs:
- `isModelHot` (ref boolean)
- `isIconHot` (ref boolean)
- `hoverVisible` (state boolean)
- `hideTimeoutRef`

Rules:
- Enter model OR icon => show icon immediately (`hoverVisible=true`), cancel hide timeout.
- Leave a zone => mark that zone false; only schedule hide when BOTH zones are false.
- Hide delay: 180-220ms (start with 200ms).
- Re-enter either zone before timeout => cancel hide.

Why: removes most disconnect flicker without making icon sticky forever.

### 2) Expand click target without visual bloat
Wrap icon with a larger transparent hit area.

CSS shape:
- Visible icon: 36-40px diameter
- Click target: 56-64px diameter transparent wrapper (`pointer-events:auto`)
- Optional slight scale-up on hover of target wrapper (not on every frame)

Why: easier click acquisition, especially on high-DPI and fast movement.

### 3) Mouse-follow in screen space, clamped and eased
Do NOT reposition via React state every pointer move.

Implementation approach:
- Keep base icon anchor at building top (`iconPosition` in world space).
- Track desired screen-space offset in refs (`targetOffsetX`, `targetOffsetY`) from pointer relative to projected anchor.
- Clamp desired offset to radius R=18-28px (start 22px).
- Animate current offset toward target in `requestAnimationFrame` loop using exponential smoothing (or spring).
- Apply with CSS transform on icon wrapper: `translate3d(currentXpx, currentYpx, 0)`.

Suggested smoothing:
- On each frame: `current += (target-current) * alpha`
- `alpha`: 0.18-0.24 (start 0.2)
- Snap-to-zero threshold when very close (<0.5px) to avoid subpixel micro-jitter.

Why screen space:
- Movement feels tied to cursor and remains visually consistent across camera zoom.
- Avoids 3D depth distortions from changing world coordinates.

### 4) Follow activation constraints (avoid accidental drift)
- Follow only while `isModelHot || isIconHot`.
- Dead zone around center: 6-8px before any movement.
- Optional hysteresis: when pointer velocity is very high, reduce follow gain for that frame (prevents runaway chase during fast sweeps).

### 5) Overlap/priority handling across buildings
Current per-building local hover can compete in dense areas.

Recommended minimal coordination:
- Keep local behavior for now, but add guard that only one action icon is visible globally via parent-level `activeHoverBuildingId`.
- Child requests activation on enter; deactivates on full leave timeout.

Why: prevents multiple icons flashing when pointer crosses overlapping meshes.

### 6) Mobile/touch fallback
No mouse-follow on touch devices.

Behavior:
- First tap building: show icon and lock for 2.5s (or until outside tap).
- Tap icon: trigger action.
- Tap elsewhere: close icon.
- Increase touch target to at least 64px.

Detection:
- `window.matchMedia('(pointer: coarse)')` or pointer type checks.

## Performance guardrails
1. Pointermove handling must write refs only (no per-event React state set).
2. Single RAF loop per active icon; cancel on hide/unmount.
3. Avoid layout thrash: transform-only updates (`translate3d`), no top/left recalculation each frame.
4. Keep per-frame math O(1); no scene traversal in pointermove/RAF.

## Suggested implementation steps
1. Refactor hover logic into explicit two-zone lock + 200ms delayed close.
2. Add expanded transparent hit target wrapper around icon.
3. Add follow controller hook (`useIconFollow`) using refs + RAF + clamp/ease.
4. Add parent-managed `activeHoverBuildingId` to enforce single visible icon.
5. Add coarse-pointer fallback path and disable follow on touch.
6. QA pass for overlap, fast sweeps, and click reliability.

## Acceptance criteria
1. Icon remains visible while pointer moves between building and icon under normal and fast movement.
2. In 30 rapid hover-to-click attempts, successful click rate >= 95% on desktop.
3. Icon movement is smooth, capped (never exceeds clamp radius), and returns to center when idle/leave.
4. No visible jitter at rest (offset settles near 0 quickly).
5. Only one building action icon is visible at a time.
6. Mobile/touch: tap-to-reveal + tap-to-action works without hover dependency.
7. No measurable FPS regression in town scene (target: within ~1-2 FPS variance of baseline).

## Edge cases checklist
- Fast zig-zag pointer movement across adjacent buildings.
- Pointer exits canvas immediately after entering building.
- Building partially occluded/overlapped by another mesh.
- Balloon/high-elevation model anchor placement.
- Camera zoom changes while icon is active.
- Touch device orientation change while icon open.

## Initial tuning defaults
- Hide delay: 200ms
- Follow clamp radius: 22px
- Dead zone: 7px
- Ease alpha: 0.2
- Touch lock timeout: 2500ms
- Icon visible diameter: 38px
- Click target diameter: 60px

## Non-goals
- No redesign of icon visual style beyond hit-area wrapper.
- No full interaction-system rewrite; this is a targeted hover/click reliability improvement.
