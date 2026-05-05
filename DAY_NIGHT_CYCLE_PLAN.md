# Day/Night Cycle Rebalance + Sky Integration Plan

## Current issues in `components/DayNightCycle.tsx`
- Hard switch at 06:00/18:00 (`isDay`) causes abrupt lighting jumps.
- Day directional intensity is fixed at `3.0` + ambient `0.6` (likely source of overexposure on bright/albedo-heavy materials).
- Night uses ambient `0.3` with no moon/fill directional source; this often crushes detail in darker assets.
- `Environment preset` flips from `city` to `night` with no transition; specular reflections pop.

## Implementation goals
1. Smooth transitions across dawn/day/dusk/night (no binary switch).
2. Lower noon harshness while preserving readability.
3. Lift deep night values enough for gameplay visibility.
4. Keep backward compatibility by adding a non-Sky fallback mode.

## Proposed architecture
Use a normalized solar factor and phase interpolation:
- `dayProgress`: map local time to [0..1] for a 24h cycle.
- `sunElevation`: sinusoidal elevation where sunrise/sunset are near 0 and noon is max.
- `lightFactor = clamp(smoothstep(-0.12, 0.25, sunElevation), 0, 1)` for soft day-night blend.

### Suggested formulas
- `t = (hours + minutes/60 + seconds/3600) / 24`
- `theta = (t - 0.25) * 2π` (sunrise near t=0.25)
- `sunYNorm = sin(theta)`
- `lightFactor = smoothstep(-0.10, 0.22, sunYNorm)`

## Light tuning ranges (starting values)
Use lerp by `lightFactor` unless noted.

- Ambient light intensity: `0.28 -> 0.55`
  - Night floor 0.28 prevents full black crush.
  - Day cap 0.55 avoids washing out PBR contrast.

- Directional (sun) intensity: `0.12 -> 1.65`
  - Keep non-zero at night for moonlike fill (`~0.10-0.20`).
  - Reduce current noon 3.0 down to ~1.5-1.8.

- Directional color by phase:
  - Night: `#9bb6ff`
  - Dawn/dusk band: `#ffd6a5` blend window around `lightFactor 0.2..0.45`
  - Day: `#fff4df`

- Shadow softness/perf:
  - `shadow-mapSize` 1024 default, optional 2048 in high quality mode.
  - Increase bias slightly (e.g. `-0.00015`) if acne appears after intensity changes.

## Sky integration with `@react-three/drei/Sky`
Feasible with current setup, but avoid double contribution conflicts.

### Integration approach
1. Add `Sky` component and compute `sunPosition` from same solar model:
   - radius 100-200 world units
   - `sunPosition = [cos(theta)*r, max(-2, sunYNorm*r), sin(theta)*r*0.25]`
2. Keep `Environment` initially for reflections, but freeze preset (do not swap city/night abruptly).
3. Drive Sky params by `lightFactor`:
   - `turbidity`: `9 -> 3.2` (hazy dawn/night to clearer day)
   - `rayleigh`: `0.45 -> 2.1` (stronger daytime atmospheric scattering)
   - `mieCoefficient`: `0.014 -> 0.005`
   - `mieDirectionalG`: `0.88 -> 0.76`
4. Exposure control should be done via Canvas renderer tone mapping exposure if needed:
   - preferred range `0.72 -> 1.0` over cycle
   - if not touching renderer globally, simulate with light intensity curve only.

### Important compatibility notes
- If `Environment` remains dynamic with preset switching while Sky is enabled, visual popping is likely.
- `Sky` + high ambient + high sun can overbrighten; cap one of them (recommended: sun cap <= 1.8).
- Current `<Canvas shadows>` does not set explicit tone mapping. If scene is still overexposed after rebalance, set:
  - `gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}`
  - then animate exposure in a narrow band only.

## Backward-compatible rollout plan
Phase 1 (safe):
- Keep `Environment` and directional/ambient lights.
- Replace hard day/night branch with interpolated curves.
- No Sky yet.

Phase 2 (feature flag):
- Add `enableSky` prop (default `false`) in `DayNightCycle`.
- When true, render `<Sky .../>` and use static `Environment` preset.

Phase 3 (optional renderer tuning):
- Add `toneMappingExposure` curve at Canvas level only if phase 2 still shows clipping.

## Fallback if Sky conflicts with scene
If Sky causes horizon mismatch, fog artifacts, or reflection inconsistency:
1. Disable Sky (`enableSky=false`).
2. Keep interpolated light curves (biggest quality gain already).
3. Use only `Environment` preset static `city` + subtle night dimming via lightFactor.
4. Optionally add very low-intensity hemisphere light (`0.08-0.15`) for nighttime readability.

## Acceptance criteria (realism + playability)
1. No abrupt brightness jumps at 06:00/18:00; transitions look continuous across 2-3 minute observation.
2. Noon highlights are reduced vs baseline (no obvious white clipping on bright roof/ground textures).
3. Night still allows identifying roads/buildings without UI aids (playability check).
4. Shadows remain readable and stable (no severe acne/flicker regression).
5. FPS impact from Sky path remains acceptable (target: <=5% drop on baseline hardware).
6. Feature flag fallback (`enableSky=false`) restores non-Sky behavior without breakage.

## Suggested code-level refactor
In `DayNightCycle.tsx`:
- Replace `isDay` boolean branch with computed curve object:
  - `sunPosition`, `ambientIntensity`, `sunIntensity`, `sunColor`, `skyParams`, `envPreset`.
- Keep a minimum directional light at night (moon fill), not zero.
- Introduce helper functions:
  - `smoothstep`, `lerp`, `clamp`, `getSolarState(date)` for readability/testability.

This plan should be handed to implementer task `t_01de88a5` as implementation guidance.