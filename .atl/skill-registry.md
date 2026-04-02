# Skill Registry

**Project**: sistema-asistencia-taller
**Generated**: 2026-04-01
**Mode**: engram

---

## Project Conventions

| File | Description |
|------|-------------|
| `AGENTS.md` | Full project documentation - stack, architecture, API, routes, data models, conventions |

---

## User-Level Skills

| Skill | Trigger | Location |
|-------|---------|-----------|
| sdd-init | "sdd init", "iniciar sdd", "openspec init" | `~/.config/opencode/skills/sdd-init/SKILL.md` |
| sdd-propose | SDD orchestrator launches | `~/.config/opencode/skills/sdd-propose/SKILL.md` |
| sdd-spec | SDD orchestrator launches | `~/.config/opencode/skills/sdd-spec/SKILL.md` |
| sdd-design | SDD orchestrator launches | `~/.config/opencode/skills/sdd-design/SKILL.md` |
| sdd-tasks | SDD orchestrator launches | `~/.config/opencode/skills/sdd-tasks/SKILL.md` |
| sdd-apply | SDD orchestrator launches | `~/.config/opencode/skills/sdd-apply/SKILL.md` |
| sdd-verify | SDD orchestrator launches | `~/.config/opencode/skills/sdd-verify/SKILL.md` |
| sdd-archive | SDD orchestrator launches | `~/.config/opencode/skills/sdd-archive/SKILL.md` |
| sdd-explore | SDD orchestrator launches | `~/.config/opencode/skills/sdd-explore/SKILL.md` |
| issue-creation | Creating GitHub issue, bug report, feature request | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| branch-pr | Creating PR, opening PR, preparing for review | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| skill-creator | Creating new AI agent skill | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| go-testing | Writing Go tests, teatest | `~/.config/opencode/skills/go-testing/SKILL.md` |
| judgment-day | "judgment day", "dual review", "doble review" | `~/.config/opencode/skills/judgment-day/SKILL.md` |

---

## Project-Level Skills

| Skill | Trigger | Location |
|-------|---------|-----------|
| django-expert | Django models, views, serializers, APIs, ORM, migrations | `.agents/skills/django-expert/SKILL.md` |
| frontend-design | Web components, pages, React, UI design | `.agents/skills/frontend-design/SKILL.md` |
| ui-ux-pro-max | UI/UX design intelligence | `.agents/skills/ui-ux-pro-max/SKILL.md` |
| vercel-react-best-practices | React/Next.js performance, components, data fetching | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| solidity-security | Smart contracts, blockchain security | `.agents/skills/solidity-security/SKILL.md` |

---

## Testing Infrastructure

| Layer | Status | Tool |
|-------|--------|------|
| Backend Unit | ⚠️ Empty template | Django TestCase |
| Backend Integration | ❌ Not installed | — |
| Frontend Unit | ❌ Not installed | — |
| Frontend E2E | ❌ Not installed | — |
| Coverage | ❌ Not available | — |

---

## Quality Tools

| Tool | Status | Command |
|------|--------|---------|
| ESLint | ✅ Available | `npm run lint` |
| TypeScript | ✅ Available | `tsc --noEmit` |
| Python Linter | ❌ Not installed | — |
| Formatter | ❌ Not configured | — |

---

## Notes

- Strict TDD Mode disabled (no test infrastructure)
- Project uses Django 6 + DRF + React 19 + Vite + TypeScript
- All text in Spanish (user-facing)
- JWT auth with refresh tokens