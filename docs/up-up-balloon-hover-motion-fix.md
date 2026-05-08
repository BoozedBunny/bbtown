# Up-Up Balloon Hover Motion: Root Cause + Enhancement Spec

## Scope
Target asset: `/media/models/up_up_balloon.glb`
Town position: `(-2.4, 2.67, 4.0)` from `app/town/[townId]/town-config.ts`.

## 1) Root cause summary
The hover motion stopped during the refactor in commit `60fec68` (`feat: improve house hover icon follow-click reliability`) in `components/ModelBuilding.tsx`.

What changed:
- The previous balloon-specific animation block was removed:
  - `useFrame((state) => { ... groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.2; })`
- `useFrame` import remained, but no runtime per-frame transform is now applied.
- `isBalloon` is still computed (`url.includes("up_up_balloon")`) but is currently unused.

Why hover stopped:
- The balloon’s floating behavior was implemented only via that removed `useFrame` local-position update.
- No alternative animation system replaced it (no GSAP/spring/mixer path for this object), so the model now stays static at base transform.

## 2) Motion design proposal (natural but more alive)
Use layered low-amplitude procedural motion around the base pose.

Base values (recommended defaults):
- Vertical bob:
  - amplitude: `0.16` world units
  - frequency: `0.22 Hz` (period ~`4.5s`)
- Circular drift (horizontal):
  - radius: `0.09` world units
  - angular speed: `0.11 Hz` (period ~`9.1s`)
  - apply as XZ offset around anchor
- Mild yaw sway (optional):
  - amplitude: `±3.5°` (`0.061 rad`)
  - frequency: `0.14 Hz` (period ~`7.1s`)

Phase offsets (to avoid robotic synchrony):
- `phaseY = 0.0`
- `phaseDrift = 1.2`
- `phaseYaw = 2.1`

Motion equations (t = elapsed seconds):
- `y = baseY + sin(2π*0.22*t + phaseY) * 0.16`
- `x = baseX + cos(2π*0.11*t + phaseDrift) * 0.09`
- `z = baseZ + sin(2π*0.11*t + phaseDrift) * 0.09`
- `yaw = baseYaw + sin(2π*0.14*t + phaseYaw) * 0.061`

## 3) Constraints (realism + performance)
Realism constraints:
- Keep total vertical excursion <= `0.32` units peak-to-peak to avoid “jumping” feel.
- Keep drift radius <= `0.12`; larger values look like roaming rather than tethered floating.
- Keep yaw sway <= `±5°`; beyond this, silhouette reads as spinning instead of swaying.
- Frequencies should remain low (`0.08–0.3 Hz`) to match balloon inertia.

Performance constraints:
- Only animate the balloon instance (`isBalloon`) inside `useFrame`.
- Reuse constants and precomputed angular factors (`TWO_PI * f`) to avoid per-frame allocations.
- Avoid creating vectors/objects in the frame loop.
- Keep logic deterministic and math-only (no DOM/CSS coupling).

Interaction constraints:
- Preserve existing hover icon follow behavior and pointer logic untouched.
- Apply motion to the parent `<group ref={groupRef}>` transform only.
- Keep icon anchor stable relative to model; no separate icon oscillation needed.

## 4) Implementation guidance + QA acceptance criteria
Implementation steps:
1. In `components/ModelBuilding.tsx`, restore a balloon-only `useFrame` block using the layered motion equations above.
2. Add an anchor ref once on mount (or use immutable `position` prop values directly) so motion is offset from the original town placement.
3. Apply position and yaw updates only when `isBalloon && groupRef.current`.
4. Keep all hover/icon code from `60fec68` as-is.

Suggested TS snippet:
```tsx
const TWO_PI = Math.PI * 2;
const BOB_AMP = 0.16;
const BOB_HZ = 0.22;
const DRIFT_R = 0.09;
const DRIFT_HZ = 0.11;
const YAW_AMP = THREE.MathUtils.degToRad(3.5);
const YAW_HZ = 0.14;
const PHASE_BOB = 0.0;
const PHASE_DRIFT = 1.2;
const PHASE_YAW = 2.1;

useFrame((state) => {
  if (!isBalloon || !groupRef.current) return;
  const t = state.clock.getElapsedTime();

  const bob = Math.sin(TWO_PI * BOB_HZ * t + PHASE_BOB) * BOB_AMP;
  const driftAngle = TWO_PI * DRIFT_HZ * t + PHASE_DRIFT;
  const driftX = Math.cos(driftAngle) * DRIFT_R;
  const driftZ = Math.sin(driftAngle) * DRIFT_R;
  const yaw = Math.sin(TWO_PI * YAW_HZ * t + PHASE_YAW) * YAW_AMP;

  groupRef.current.position.set(
    position[0] + driftX,
    position[1] + bob,
    position[2] + driftZ,
  );
  groupRef.current.rotation.y = rotationInRadians + yaw;
});
```

QA acceptance criteria:
- Balloon visibly floats at idle with smooth vertical + subtle lateral motion.
- Motion feels natural (no jitter, no sudden phase jumps, no snapping).
- Hover icon behavior remains unchanged from current UX improvements.
- Balloon stays near original map location and does not collide visually with nearby buildings.
- Frame rate impact is negligible in town scene (single animated object).

Tuning ranges for quick art-direction adjustments:
- Bob amplitude: `0.12–0.20`
- Drift radius: `0.06–0.12`
- Yaw amplitude: `2°–5°`
- Keep frequencies low; avoid values > `0.35 Hz`.
