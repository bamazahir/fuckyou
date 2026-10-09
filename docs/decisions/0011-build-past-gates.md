# 0011 — Keep building past the gates (builder's call)

Date: 2026-10-09 · Status: accepted

## Context
After M4 the builder said they haven't done any builder checks yet (setup, devices, alpha, launch) and asked to "keep building as much as you can without these". SPEC §15 says not to start a milestone before the previous gate is met.

## Decision
- Build M5, then M6 and M7 now. The gates are deferred, not passed: every unmet one is tracked in `docs/OPEN-ITEMS.md` and in the shared "open items" doc.
- Anything a later milestone needs from a device, an account or a person is added to that list instead of being assumed.
- M6's lofi station stays off until the builder supplies licensed tracks (SPEC §11). The noise stations are generated in the browser and need no files.

## Consequences
- If the M4 gate later fails, the plan still applies (interview 5, fix the top reason). Features built ahead may then be cut.
- The builder's first real use will exercise several milestones at once, so the real-device checks matter more.
