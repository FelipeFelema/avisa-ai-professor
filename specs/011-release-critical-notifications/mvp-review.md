# Deadline review — Spec 011

Historical P0 review, 2026-10-06. Superseded scope: on 2026-10-07 the owner authorized full 011 including P1 and local build/export; see tasks.md and final-validation.md. No commits, push/PR or deployment.

2026-10-06. Owner authorized P0 implementation phase by phase after this review. No P1 implementation before P0 completion and validation; no Spec012/build/push/PR/rebase authorized.

## Mandatory flow and scope

US1 + US2 form the complete MVP: professor publishes → same-classroom eligible installations only → authenticated existing push transport → tap fetches the authorized current announcement. US1 by itself is only a backend increment. Optional T046–T053 has no edge into mandatory release. Keep reminders disabled/unimplemented for this run.

No standalone cosmetic polish or architectural project exists in the task list. Privacy, migration/recovery, authorization/concurrency tests, applicable gates and concise operational instructions are essential P0. No future Spec012 is created or populated. Delivery receipts, registration, consent and test protection are reused from010; extending their business integration is not rebuilding them.

## Proposed consolidation before implementation

61 atomic task IDs are useful traceability, but are not 61 necessary separate executions. Execute 46 packets, retaining IDs and every acceptance/security check. This avoids renumbering the FR/SC matrix and makes task completion granular and honest: a packet does not close its unverified IDs automatically.

| Original IDs grouped together | Reason                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| T001 + T002                   | One review/baseline record.                                                                               |
| T006–T010                     | One additive schema change, one generation/validation checkpoint.                                         |
| T012 + T013                   | Lock tests first, then the matching reusable primitive.                                                   |
| T014 + T015                   | Private flags/cleanup integration; service/worker registration stays at T029 after implementations exist. |
| T026 + T027                   | Worker tests first, then bounded dispatcher.                                                              |
| T028 + T029                   | Business receipt integration and final module wiring.                                                     |
| T031 + T032                   | Backend story regression/evidence once.                                                                   |
| T042 + T043                   | Session cancellation plus existing channel verification; no new native work.                              |
| T044 + T045                   | Mobile story regression/evidence once.                                                                    |
| T055 + T056                   | Minimum operational documentation and contract/migration review.                                          |
| T057 + T058                   | One final validation packet with independent backend/mobile commands; each result remains distinct.       |
| T060 + T061                   | Walkthrough/evidence consolidation; real/manual/CI evidence cannot be fabricated.                         |

These twelve consolidations remove fifteen separate execution steps: **38 P0 packets + 8 optional P1 packets = 46**, while keeping **53 mandatory IDs + 8 optional IDs = 61**. No essential scenario is removed or transferred elsewhere. Only coordinator updates task states after verification.

## Dependency clarification

T015's early module composition cannot reference unimplemented services/workers. It covers configuration registration and cleanup order only. T029 performs final module service/worker registration after T023–T028 exist. Models/migration precede new persistence consumers; payload contract allows US2 mock tests independently of real business dispatch. Shared source files remain sequential.

The foundation's010 T073/T074 and Doctor/CI gates remain open; latest owner authorization permits011 implementation but does not waive release dependencies. Real environment migrations, credentials, EAS artifacts and device walkthrough require their existing operational steps; this run uses isolated test storage and mocked transport.
