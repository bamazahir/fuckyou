# Third-party skills

Vendored copies (unmodified unless noted). Update by re-copying from upstream; keep each LICENSE file.

| Skills | Upstream | Commit | License |
|---|---|---|---|
| grill-me, grilling, to-tickets, tdd, codebase-design, setup-matt-pocock-skills, implement-spec | github.com/mattpocock/skills | b0618bc | MIT |
| supabase, supabase-postgres-best-practices | github.com/supabase/agent-skills | c9be0e9 | MIT |
| react-best-practices, web-design-guidelines | github.com/vercel-labs/agent-skills | 063bee9 | MIT (per upstream README) |
| frontend-design, webapp-testing | github.com/anthropics/skills | 683bc88 | Apache-2.0 (LICENSE.txt in each folder) |
| threejs-* (10 skills) | github.com/CloudAI-X/threejs-skills | b1c6230 | MIT (per upstream README; no LICENSE file upstream) |
| web-asset-generator | github.com/alonw0/web-asset-generator | c6d56dc | MIT |
| sharp-edges, supply-chain-risk-auditor, spec-to-code-compliance (+ `.claude/agents/sharp-edges-analyzer.md`, `.claude/agents/spec-compliance-checker.md`, `.claude/workflows/spec-compliance.js`) | github.com/trailofbits/skills | 82fe822 | CC BY-SA 4.0 |

Modifications: removed `agents/openai.yaml` files. In `spec-to-code-compliance/SKILL.md`, the agent reference `spec-to-code-compliance:spec-compliance-checker` became `spec-compliance-checker` (it is installed as a project agent, not a plugin).

Project-specific (ours): `ship-audit`, `studyroom-look`.
