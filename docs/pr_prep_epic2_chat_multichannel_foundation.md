# PR Prep: Chat Epic 2 Multi-Channel Foundation (Final Combined-PR Notes)

## Scope and Instruction Compliance
- Epic slice: Chat Epic 2 (multi-channel Town chat foundation with subscribe/unsubscribe/send protocol)
- This task: t_af56fc6f
- Parent implementation+QA handoff: t_f3095ed2
- Epic parent: t_a60a5c30
- Instruction: prepare PR-quality summary, validation evidence, risks, rollback notes, and reviewer checklist for final combined PR; do not open incremental PR unless requested.
- Result: documentation package prepared only; no incremental PR opened.

## Traceability and Dependency Chain
- Implementation/QA: t_f3095ed2
- PR-prep aggregation: t_af56fc6f (this task)
- Child dependency on board: t_36323656

Parent handoff states Chat Epic 2 implementation was applied in:
- lib/chat/channel.ts
- components/TownChatPanel.tsx
- app/town/[townId]/page.tsx
- server.ts

## Branch / Commit Integrity Snapshot
- Workspace: /root/.hermes/.worktrees/t_ecc084b5/bbtown
- Branch at prep time: hotfix/prisma-loanstatus-schema-compat-guard
- HEAD at prep time: 79f8f72
- origin/main at prep time: 22de28f
- merge-base(HEAD, origin/main): 79f8f72

Assessment:
- Workspace contains multiple unrelated in-flight changes and untracked PR-prep docs from other epics/features.
- Final combined PR must stage only intended Chat Epic 2 hunks in the four files listed above to avoid scope contamination.

## Problem and Root Cause
Problem:
- Town chat was effectively single-threaded at the experience level and did not provide a robust multi-channel foundation for global, town shard, and whisper streams in one consistent panel.

Root cause:
- Missing canonical channel identity helpers and missing socket contracts for subscribe/unsubscribe/send acknowledgements meant channel state, history replay, and merged timeline behavior were not formalized end-to-end.

## What Changed (from parent t_f3095ed2)
1) Canonical channel key primitives:
   - Added channel helper logic for canonical keys:
     - global
     - town:{townId}:{shardId}
     - whisper:{minUser}:{maxUser}

2) Town chat panel state model:
   - Added TownChatPanel with split state for `listenSet` (channels currently subscribed) and `writeTarget` (channel currently being sent to).
   - Enforced non-empty listen invariant and auto-add behavior so write target remains represented in active subscriptions.

3) Multi-channel timeline behavior:
   - Merged messages across channels into a unified timeline with per-message channel badges.
   - Added messageId-based dedupe behavior to reduce duplicate render artifacts.

4) Socket protocol additions (server + client wiring):
   - Added `chat.subscribe` with ack + history replay semantics.
   - Added `chat.unsubscribe` for removing active channel subscriptions.
   - Added `chat.send` ack/error handling with auth checks.

5) Interaction ergonomics:
   - Keyboard shortcuts wired in panel for multi-channel workflow:
     - Ctrl/Cmd+K
     - Ctrl/Cmd+L
     - Alt+1
     - Alt+2

6) Feature-flag gating:
   - TownChatPanel render path is gated so either `NEXT_PUBLIC_CHAT_EPIC3_ENABLED=true` or `NEXT_PUBLIC_CHAT_EPIC1_ENABLED=true` must be enabled.

## QA Evidence and Validation Summary
From parent handoff metadata t_f3095ed2:
- Validation command run: npm run build
- Outcome: pass

Additional parent notes:
- Chat history is currently in-memory server state (bounded) and does not persist to DB.
- Whisper flow can be initiated via explicit peer username entry in panel; no player-card context hook yet.

Interpretation for final combined PR gate:
- Parent evidence supports Chat Epic 2 functional acceptance and build integrity for the implemented slice.
- Final combined PR should still rerun full validation against the exact staged combined diff.

Recommended final-gate commands:
- npx prisma generate
- npx tsc --noEmit --pretty false
- npm run build

## Risk Assessment
Overall risk for Chat Epic 2 slice: medium.

Key risks:
1) Shared-file isolation risk:
   - `app/town/[townId]/page.tsx` and `server.ts` are high-churn files with cross-epic edits; accidental hunk inclusion is likely without careful staging.
2) Session-state behavior risk:
   - listenSet/writeTarget invariants could regress if later UI changes bypass panel state guards.
3) Channel-identity drift risk:
   - Any divergence from canonical key helpers across client/server can cause split subscriptions, missing history, or misrouted whispers.
4) Non-persistent history expectations risk:
   - In-memory bounded history may not meet product expectations for reconnect durability.
5) Feature-flag drift risk:
   - Mixed deployment flag settings can cause TownChatPanel visibility mismatch across environments.

## Rollback Plan
1) Immediate containment via feature flags:
   - Disable panel exposure by ensuring both `NEXT_PUBLIC_CHAT_EPIC3_ENABLED=false` and `NEXT_PUBLIC_CHAT_EPIC1_ENABLED=false` in affected environments.
2) Revert Chat Epic 2 hunks in:
   - lib/chat/channel.ts
   - components/TownChatPanel.tsx
   - app/town/[townId]/page.tsx
   - server.ts
3) Re-run typecheck/build and smoke-test Town chat for baseline single-channel behavior and socket stability.

No schema migration rollback is required for this slice.

## Reviewer Checklist (Chat Epic 2 slice)
- [ ] Verify only intended Chat Epic 2 hunks are staged in the four declared files.
- [ ] Verify canonical channel keys are constructed exactly as global, town:{townId}:{shardId}, whisper:{minUser}:{maxUser}.
- [ ] Verify listenSet/writeTarget split behavior and non-empty listen invariant in TownChatPanel.
- [ ] Verify write-target auto-add into listenSet prevents write-to-unsubscribed-channel edge cases.
- [ ] Verify merged multi-channel timeline rendering with channel badges and messageId dedupe.
- [ ] Verify socket contract behavior for chat.subscribe/chat.unsubscribe/chat.send including ack/error paths and auth checks.
- [ ] Verify keyboard shortcuts Ctrl/Cmd+K, Ctrl/Cmd+L, Alt+1, Alt+2 behave as expected and do not conflict with existing inputs.
- [ ] Verify feature-flag gating and fallback behavior (`NEXT_PUBLIC_CHAT_EPIC3_ENABLED` or `NEXT_PUBLIC_CHAT_EPIC1_ENABLED`).
- [ ] Verify no unrelated hunks from concurrent in-flight work are included.

## Ready-to-Paste Section for Final Combined PR Body
Epic 2 (Chat): multi-channel foundation
- Adds canonical channel key helpers for global/town/whisper addressing (`global`, `town:{townId}:{shardId}`, `whisper:{minUser}:{maxUser}`).
- Introduces TownChatPanel multi-channel state model (`listenSet` vs `writeTarget`) with non-empty listen invariant and auto-add safeguards.
- Adds unified cross-channel timeline with channel badges and messageId dedupe behavior.
- Implements socket contracts for `chat.subscribe`, `chat.unsubscribe`, and `chat.send` with ack/error handling and history replay.
- Wires keyboard shortcuts for fast channel workflow and gates panel exposure behind chat feature flags.

Validation note
- Parent validation reported `npm run build` passing; final combined PR should rerun full validation on exact staged combined diff.

## PR Creation Status
- No incremental PR opened in this task (as required).
