# Dependency-Aware Multi-Agent Orchestration

Use this protocol whenever implementation is delegated. It is deliberately based on task readiness and file ownership rather than a fixed assumption that all backend work precedes all client work.

## Coordinator Invariants

- The main agent remains the coordinator and does not delegate scheduling, task-state updates, integration decisions, or final validation.
- Only the coordinator edits task checkboxes in `tasks.md`.
- Concurrent workers must have disjoint owned paths. A worker must stop and report before changing an undeclared path that another active worker may own.
- `[P]` is a hint created during task generation. The live dependency graph, current code, and file ownership decide whether work can actually run in parallel.
- A worker completion message is evidence to inspect, not authority to mark a task complete.
- Preserve user changes and other workers' edits. Never use destructive git recovery to make a worker result fit.

## Build and Validate the DAG

Prefer the `## Execution Coordination` table in `tasks.md`. Add missing edges that are proven by the artifacts or current code:

1. Setup and foundational providers precede their consumers.
2. When TDD is required, the test task precedes its matching implementation task.
3. Migrations, data models, schemas, and interface contracts precede services or clients that consume them.
4. Services precede endpoints or commands that call them; stable contracts may be consumed independently of unfinished provider internals.
5. Provider and consumer implementation precede their integration or end-to-end task.
6. Tasks that edit the same file, generated artifact, lockfile, central registry, or shared configuration are sequential.
7. Phase validation depends on every required task in that phase.

Every edge needs a short reason. If an inferred edge is uncertain, schedule conservatively and report the ambiguity. If the graph contains a cycle, unknown task ID, or contradiction with the task text, stop and recommend correcting `$speckit-tasks`; do not invent an execution order.

## Assign Execution Lanes

Classify tasks from their actual paths and responsibilities:

- `backend`: API, domain, services, database, authentication, jobs, and server tests.
- `client`: web, frontend, mobile, UI state, accessibility, and client tests.
- `quality`: contracts, end-to-end integration, cross-cutting validation, documentation, and release checks.
- `coordinator`: shared dependency files, task state, integration decisions, and small cross-lane changes unsafe to delegate.

Do not force a task into a lane merely because of its phase. A contract or integration task may cross backend and client boundaries and should either be split into disjoint tasks or kept with the coordinator.

## Schedule Ready Work

For the current allowed phase set:

1. Compute the ready set: incomplete tasks whose direct dependencies are all verified complete.
2. Remove tasks whose paths overlap another task selected for the same wave.
3. Group compatible tasks by lane and tightly related context. Prefer one bounded worker packet per active lane over one worker per tiny task.
4. Keep one concurrency slot for the coordinator, use no more than two active implementation workers by default, and respect any lower runtime worker limit.
5. Start backend and client workers together only if neither has a transitive dependency on the other and their owned paths are disjoint.
6. As each worker finishes, integrate and verify that result, update task state, and recompute the ready set. A newly unblocked task may start in a free slot while an unrelated worker from the original wave is still active. Wait for all relevant branches only at an explicit join, integration task, or phase checkpoint. Never pre-schedule from unverified worker claims or stale assumptions.

Contract-first nuance: a client that depends on a stable, versioned contract can often implement against a mock while the endpoint internals are built in parallel. The client must wait when response shape, error semantics, authentication behavior, generated types, or another consumed boundary is still being defined.

## Spawn Specialized Workers

In Codex, use descriptive names such as `backend_engineer`, `client_engineer`, and `integration_reviewer`. Give workers a fresh, bounded context (`fork_turns: "none"`) and a complete task packet instead of the coordinator's conversation history.

Spawn every implementation worker with all three explicit parameters:

```text
model: "gpt-5.6-luna"
reasoning_effort: "high"
fork_turns: "none"
```

These explicit spawn values prevent an accidentally more expensive coordinator model or reasoning effort from propagating to workers. Do not fall back silently to parent inheritance, `xhigh`, `max`, Sol, or Terra. If the runtime rejects the requested model or override, keep the task unstarted and report the incompatibility.

Do not delegate merely because a ready task exists. The coordinator should execute the work directly when it is small, sequential, cross-cutting, path-overlapping, or cheaper than constructing and validating a worker packet. Delegate when the ready work is independent, has disjoint ownership, and is substantial enough to amortize setup and context cost. Group consecutive ready tasks in one lane when they share relevant context and compatible ownership.

Workers are depth 1 and must not call `spawn_agent`, delegate, or create any depth-2 worker. Each worker packet must contain:

```text
ROLE
TASK_IDS
OBJECTIVE_AND_DONE_WHEN
DIRECT_DEPENDENCIES_AND_VERIFIED_OUTPUTS
READ_THESE_ARTIFACT_SECTIONS
OWNED_PATHS
DO_NOT_TOUCH_PATHS
RELEVANT_REQUIREMENTS_DECISIONS_CONTRACTS
PRESERVE_EXISTING_WIP
VALIDATION_COMMANDS
RETURN_CONTRACT
```

Include source paths and only the smallest relevant artifact sections. The worker must not automatically reread the complete skill, `spec.md`, `plan.md`, `research.md`, `quickstart.md`, `tasks.md`, every contract, or historical memory. It may perform an additional targeted read only when it discovers a concrete context gap required for safe completion, and it must report that deviation. Tell the worker that the workspace is shared and that it must stop and report before expanding file scope.

Keep tool output bounded. Prefer targeted `rg`, excerpt reads, semantic inspection, `git diff --stat`, `git diff --name-only`, `npm ls`, `npm explain`, batched registry queries, and short extraction scripts. Do not print whole lockfiles or large diffs, repeat already available queries, or rerun broad validation suites when the packet's narrow validation is sufficient.

## Worker Return Contract

Require this structured result:

```text
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | NEEDS_MANUAL_ESCALATION
TASKS: T###, ...
FILES: created/modified paths
DECISIONS: material decisions or none
VALIDATION: command and concise observed result for each check
BLOCKERS_OR_RISKS: blockers, risks, or none
CONTRACT_DEVIATIONS: deviations from the received packet or none
```

Return summaries, not raw logs. `DONE_WITH_CONCERNS` is not automatically complete. `NEEDS_CONTEXT` should receive only the missing context. `BLOCKED` keeps dependent nodes locked. `NEEDS_MANUAL_ESCALATION` is reserved for a new architectural decision, material ambiguity, or exceptionally complex debugging that Luna High cannot resolve reliably; do not respawn that task with a costlier model. The coordinator preserves independent progress and asks the user whether to retry it manually with Luna XHigh or Sol High.

## Integrate Results Continuously

After workers return, the coordinator must:

1. Inspect the actual diff and confirm every changed path was owned by that worker.
2. Reconcile imports, generated artifacts, schemas, and cross-lane contracts.
3. Confirm the worker's narrow verification without reflexively duplicating it, then run the phase checkpoint only when the applicable wave finishes the phase or another declared gate requires it.
4. Mark only verified tasks `[X]` in a single coordinator edit.
5. Record concerns and deviations, release newly ready nodes, and fill available worker slots immediately when ownership remains disjoint.

Use at most one focused repair handoff without replanning. If a repair expands scope, changes a contract, or creates a new dependency, update the execution model and communicate the impact before proceeding.

## Example

Suppose `T101` defines and validates an announcement API contract, `T102` implements the backend endpoint, `T103` implements the mobile API client, `T104` builds the mobile screen from that client, and `T105` runs the end-to-end flow.

- Run `T101` first.
- After the contract is stable, run `T102` with the backend worker and `T103` with the client worker in parallel if their paths are disjoint.
- As soon as `T103` is verified, run `T104` in the released client slot even if unrelated `T102` is still active.
- Run join task `T105` only after both `T102` and `T104` are verified.

This is more precise than either "all client work waits for backend" or "all `[P]` work starts immediately."
