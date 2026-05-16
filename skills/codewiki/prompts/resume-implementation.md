Implement roadmap task {{task.id}} for {{project.label}}.

Selected task:
{{task.summary_block}}

Latest evidence and temporary session usage:
{{evidence}}

{{follow_up_intent_section}}

Preflight:
- Deterministic preflight color: {{preflight.color}}

Context packet or fallback map:
{{task.context_block}}

Task delta:
{{task.delta_block}}

Task source refs:
{{task.refs_block}}

Rules:
- Implement surgically from roadmap/build context, then submit build evidence to the validation gateway.
- Proceed only when the selected roadmap item is self-contained executable work. If it is a sprint/umbrella/container or mainly closes other tasks, stop and route grouping to sprint/planning instead.
- Treat parent context as expensive RAM: keep focused task, loaded view revisions, and small decisions; do not load raw wiki trees by default.
- Consume graph/status as a map first, then read linked source-of-truth docs/builds/roadmap/validation/code directly before semantic edits.
- Use fresh validation/research/architecture review only when the gateway or task policy requires independent context.
- Use graph/state to locate the roadmap item, linked builds, validation refs, code paths, and exact specs; read those sources before changing code or wiki surgically.
- During implementation, use lint, typecheck, tests, runtime feedback, and Pi-lens as short-cycle correction signals for mechanical code quality.
- Validation gateway should judge alignment/coherence; do not reduce it to linting or typechecking.
- Gather research only when uncertainty or unsupported claims require new evidence.
- Implement according to specs and roadmap; surface drift instead of silently choosing code over wiki.
- Keep public UX focused on wiki-bootstrap, wiki-status, wiki-config, wiki-resume, wiki-session-handoff, and /audit; Alt+W toggles the live status panel.
- Do not create a separate user-facing wiki-edit command; update roadmap/wiki artifacts automatically when user intent requires it.
- If intended design must change, update wiki docs and code consistently.
- If this task finishes, blocks, or needs evidence recorded, use codewiki_task to persist canonical task truth.
- If follow-up delta appears that is not already tracked, use codewiki_task action=create.
- Rebuild generated outputs before finishing.
- Rerun deterministic status before summarizing.

Helper-safe next steps:
- Work only on selected task and listed source refs unless fresh state proves scope changed.
- Honor artifact-status conflicts; do not override another holder unless user/policy explicitly says so.
- Treat temporary session usage as coordination evidence, not canonical task truth.
- Preserve user follow-up intent as a requirement input, but record durable decisions through builds/tasks/docs.

Output format:
- Changes made
- Task status recommendation: todo|in_progress|done|blocked
- Wiki updates made automatically, if any
- Remaining risks or follow-ups
