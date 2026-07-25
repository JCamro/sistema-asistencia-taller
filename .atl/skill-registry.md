# Skill Registry — sistema-asistencia-taller

Last updated: 2026-07-24 (sdd-init re-run)

## Sources scanned

- C:\Users\Usuario\.config\opencode\skills (22 skills)
- C:\Users\Usuario\.agents\skills (4 skills)
- Project-level: none

## Contract

**Delegator use only.** This registry is an index, not a summary. Any agent that launches subagents reads it to select relevant skills, then passes exact `SKILL.md` paths for the subagent to read before work.

`SKILL.md` remains the source of truth. Do not inject generated summaries or compact rules by default; pass paths so subagents load the full runtime contract and preserve author intent.

## Skills

### SDD Skills (infrastructure)

| Skill | Trigger / description | Scope | Path |
|-------|----------------------|-------|------|
| `sdd-init` | Initialize SDD context, testing capabilities, registry, persistence | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-init\SKILL.md` |
| `sdd-explore` | Explore SDD ideas before committing to a change | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-explore\SKILL.md` |
| `sdd-propose` | Create SDD change proposal with intent, scope, approach | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-propose\SKILL.md` |
| `sdd-spec` | Write SDD delta specs with requirements and scenarios | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-spec\SKILL.md` |
| `sdd-design` | Create SDD technical design and architecture approach | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-design\SKILL.md` |
| `sdd-tasks` | Break SDD change into implementation tasks | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-tasks\SKILL.md` |
| `sdd-apply` | Implement SDD tasks from specs and design | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-apply\SKILL.md` |
| `sdd-verify` | Execute tests and prove implementation matches specs | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-verify\SKILL.md` |
| `sdd-archive` | Archive completed SDD change by syncing delta specs | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-archive\SKILL.md` |
| `sdd-onboard` | Walk users through SDD workflow on real codebase | sdd | `C:\Users\Usuario\.config\opencode\skills\sdd-onboard\SKILL.md` |

### User Skills

| Skill | Trigger / description | Scope | Path |
|-------|----------------------|-------|------|
| `branch-pr` | Create Gentle AI pull requests with issue-first checks | user | `C:\Users\Usuario\.config\opencode\skills\branch-pr\SKILL.md` |
| `chained-pr` | Split oversized changes into chained PRs | user | `C:\Users\Usuario\.config\opencode\skills\chained-pr\SKILL.md` |
| `cognitive-doc-design` | Design docs that reduce cognitive load | user | `C:\Users\Usuario\.config\opencode\skills\cognitive-doc-design\SKILL.md` |
| `comment-writer` | Write warm, direct collaboration comments | user | `C:\Users\Usuario\.config\opencode\skills\comment-writer\SKILL.md` |
| `go-testing` | Go testing patterns (teatest, golden files) | user | `C:\Users\Usuario\.config\opencode\skills\go-testing\SKILL.md` |
| `issue-creation` | Create GitHub issues with issue-first checks | user | `C:\Users\Usuario\.config\opencode\skills\issue-creation\SKILL.md` |
| `judgment-day` | Adversarial dual review with fix rounds | user | `C:\Users\Usuario\.config\opencode\skills\judgment-day\SKILL.md` |
| `skill-creator` | Create LLM-first skills with valid frontmatter | user | `C:\Users\Usuario\.config\opencode\skills\skill-creator\SKILL.md` |
| `skill-improver` | Audit and upgrade existing skills | user | `C:\Users\Usuario\.config\opencode\skills\skill-improver\SKILL.md` |
| `work-unit-commits` | Plan commits as reviewable work units | user | `C:\Users\Usuario\.config\opencode\skills\work-unit-commits\SKILL.md` |
| `find-skills` | Discover and install agent skills | user | `C:\Users\Usuario\.agents\skills\find-skills\SKILL.md` |
| `grill-me` | Stress-test plans and designs | user | `C:\Users\Usuario\.agents\skills\grill-me\SKILL.md` |
| `tdd` | Test-driven development (red-green-refactor) | user | `C:\Users\Usuario\.agents\skills\tdd\SKILL.md` |
| `web-master` | Web frontend design, build, critique, audit, test | user | `C:\Users\Usuario\.agents\skills\web-master\SKILL.md` |

## Convention Files

- `AGENTS.md`: `C:\Trabajos\Proyectos\sistema-asistencia-taller\AGENTS.md`

## Loading protocol

1. Match task context and target files against the `Trigger / description` column.
2. Pass only the matching `Path` values to the subagent under `## Skills to load before work`.
3. Instruct the subagent to read those exact `SKILL.md` files before reading, writing, reviewing, testing, or creating artifacts.
4. If no matching skill exists, proceed without project skill injection and report `skill_resolution: none`.
