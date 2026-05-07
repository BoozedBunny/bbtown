# PR Prep: Epic 3 Chat Slash Command + Whisper Composer (Final Combined-PR Notes)

## Scope and Instruction Compliance
- Epic slice: Chat Epic 3 (/ command menu + /w whisper recipient UX + whisper send wiring)
- This task: t_1648974f
- Parent implementation+QA handoff: t_5993f0c9
- Epic parent: t_be9f0291
- Instruction: prepare PR-quality summary, validation evidence, risks, rollback notes, and reviewer checklist for final combined PR; do not open incremental PR unless requested.
- Result: documentation package prepared only; no incremental PR opened.

## Traceability and Dependency Chain
- Implementation/QA: t_5993f0c9
- PR-prep aggregation: t_1648974f (this task)
- Child dependency on board: t_36323656

Parent handoff states Epic 3 implementation was applied in:
- app/town/[townId]/page.tsx
- app/town/[townId]/town-types.ts
- components/TownChatPanel.tsx
- lib/chat/parseChatInput.ts
- lib/chat/suggestions.ts

## Branch / Commit Integrity Snapshot
- Workspace: /root/.hermes/.worktrees/t_ecc084b5/bbtown
- Branch at prep time: hotfix/prisma-loanstatus-schema-compat-guard
- HEAD at prep time: 79f8f72
- origin/main at prep time: 22de28f
- merge-base(HEAD, origin/main): 79f8f72

Assessment:
- Workspace contains multiple unrelated in-flight changes and untracked docs from other epics/features.
- Final combined PR must stage only intended Chat Epic 3 hunks in the five files listed above to avoid scope contamination.

## Problem and Root Cause
Problem:
- Town chat lacked a first-class slash-command UX and private whisper composition flow, making private messaging discoverability and correctness weak in active multiplayer rooms.

Root cause:
- Missing client-side command parsing/suggestion primitives and missing composer/panel integration to route /w inputs into existing whisper socket protocol, plus insufficient local participant identity context for recipient targeting.

## What Changed (from parent t_5993f0c9)
1) Slash command chat UX:
   - Added command menu interactions for slash-prefixed input.
   - Added parsing/validation flow to recognize whisper intents and reject invalid forms.

2) Whisper recipient autocomplete and keyboard navigation:
   - Added /w recipient suggestion system with keyboard navigation support.
   - Recipient source is known Town chat participants learned from chat history/messages (no dedicated presence feed yet).

3) Whisper send wiring to existing protocol:
   - Wired parsed whisper payloads to existing chat socket contract, including whisper channel key construction and chat:send/chat:history integration path.

4) Town chat panel integration:
   - Added TownChatPanel usage in town page and extended typing/user context to carry id/username required for whisper routing.

5) Feature-flag gating:
   - Epic 3 behavior is gated by NEXT_PUBLIC_CHAT_EPIC3_ENABLED with fallback to NEXT_PUBLIC_CHAT_EPIC1_ENABLED.

## QA Evidence and Validation Summary
From parent handoff metadata t_5993f0c9:
- Validation command run: npm run build
- Outcome: failed
- Failure classification: pre-existing baseline runtime build issue, not attributed to Epic 3 diff
- Reported error: Next runtime PageNotFoundError: Cannot find module for page: /_document

Interpretation for final combined PR gate:
- Parent validation indicates Epic 3 compile/type surfaces were not flagged as direct failures, but full build gate is currently blocked by a known baseline issue.
- Final combined PR must rerun validation on exact staged diff once baseline /_document runtime build issue is resolved or confirmed unaffected in target branch state.

Recommended final-gate commands:
- npx prisma generate
- npx tsc --noEmit --pretty false
- npm run build

## Risk Assessment
Overall risk for Chat Epic 3 slice: medium.

Key risks:
1) Shared-file isolation risk:
   - app/town/[townId]/page.tsx is high-churn with cross-epic edits; accidental hunk inclusion is likely without careful staging.
2) Recipient resolution risk:
   - Autocomplete depends on participant discovery from observed history/messages; users not yet observed may not be suggestible.
3) Command parsing edge-case risk:
   - Slash command parser changes can regress normal chat text handling or malformed whisper behavior if edge cases are missed.
4) Feature-flag drift risk:
   - Mixed environment flag settings (EPIC3 vs EPIC1 fallback) can produce inconsistent behavior across deployments.

## Rollback Plan
1) Immediate containment via feature flags:
   - Set NEXT_PUBLIC_CHAT_EPIC3_ENABLED=false (and ensure fallback behavior via NEXT_PUBLIC_CHAT_EPIC1_ENABLED remains expected).
2) Revert Epic 3 hunks in:
   - app/town/[townId]/page.tsx
   - app/town/[townId]/town-types.ts
   - components/TownChatPanel.tsx
   - lib/chat/parseChatInput.ts
   - lib/chat/suggestions.ts
3) Re-run typecheck/build and smoke-test Town chat flows: plain message send, slash command menu, whisper recipient autocomplete, and whisper delivery path.

No schema migration rollback is required for this slice.

## Reviewer Checklist (Chat Epic 3 slice)
- [ ] Verify only intended Chat Epic 3 hunks are staged in the five declared files.
- [ ] Verify slash command menu appears and behaves correctly for slash-prefixed input.
- [ ] Verify /w parsing accepts valid recipient/message forms and rejects invalid forms without breaking normal chat input.
- [ ] Verify recipient suggestion list and keyboard navigation behavior (Arrow keys/Enter/Escape paths).
- [ ] Verify whisper send path uses existing socket contract (whisper channel key + chat:send/chat:history expectations).
- [ ] Verify user id/username propagation in town typing context is sufficient for whisper routing.
- [ ] Verify feature-flag behavior: NEXT_PUBLIC_CHAT_EPIC3_ENABLED and fallback to NEXT_PUBLIC_CHAT_EPIC1_ENABLED.
- [ ] Verify no unrelated hunks from concurrent in-flight work are included.

## Ready-to-Paste Section for Final Combined PR Body
Epic 3 (Chat): slash commands + whisper composer
- Adds slash-command UX with parsing/validation for chat input, including /w whisper intent handling.
- Introduces whisper recipient autocomplete with keyboard navigation backed by known chat participants from history/messages.
- Wires whisper sends into existing socket protocol (whisper channel key + chat:send/chat:history path) and extends town typing/user context with id/username for routing.
- Adds feature-flag controls: NEXT_PUBLIC_CHAT_EPIC3_ENABLED with fallback to NEXT_PUBLIC_CHAT_EPIC1_ENABLED.

Validation note
- Parent validation ran npm run build and hit a known baseline Next runtime issue (PageNotFoundError for /_document); final combined PR should rerun full validation on exact staged combined diff.

## PR Creation Status
- No incremental PR opened in this task (as required).
