# Feature Specification: Consolidação de Experiência e Qualidade do Aplicativo

**Feature Branch**: `feat/account-and-resourse-management`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Permitir que o professor criador exclua sua sala; permitir que o usuário atualize nome ou e-mail; solicitar confirmação antes de excluir ou atualizar; disponibilizar documentação interativa da API; melhorar o design do aplicativo com uma referência visual ou design system; e consolidar quality gates e testes automatizados."

## Verified Baseline

The repository review on 2026-08-22 established the following starting point:

- Classroom ownership and owner-only deletion already exist on the server, including data-model support and unit coverage. The mobile owner flow and end-to-end coverage of the deletion contract are still missing.
- Profile name and email updates already exist on the server with validation and automated coverage. The mobile profile remains read-only.
- Announcement deletion already asks for confirmation. Announcement editing is present as local work in progress but saves without confirmation, and confirmation behavior is not yet consistent across update and delete actions.
- The application has no discoverable interactive API reference.
- A shared visual token file and a green/neutral visual direction exist, but they are not yet a documented, app-wide design foundation.
- Automated backend and mobile checks already run in repository workflows. Backend behavior tests and coverage checks exist; mobile checks currently emphasize static quality and environment health rather than automated user-behavior tests. Repository inspection cannot confirm whether external merge-protection settings make every check mandatory.

This feature completes and integrates the existing baseline; it does not require rebuilding behavior that already satisfies the acceptance criteria.

## Clarifications

### Session 2026-08-22

- Q: Após uma alteração de e-mail bem-sucedida, o que deve acontecer com as sessões ativas do usuário? → A: Manter o dispositivo atual conectado com a identidade atualizada e encerrar as sessões dos demais dispositivos.
- Q: Se não houver permissão para tornar os checks obrigatórios na hospedagem do repositório, esta feature poderá ser considerada concluída? → A: Não; a feature permanece bloqueada até que os checks sejam configurados como obrigatórios.
- Q: Quais critérios mensuráveis de contraste e tamanho mínimo de toque devem ser obrigatórios nas telas contempladas pela feature? → A: Contraste WCAG 2.2 nível AA; alvos de toque mínimos de 44×44 pt no iOS e 48×48 dp no Android.
- Q: Após o professor confirmar a exclusão de uma sala, por quanto tempo a sala, seus vínculos e seus avisos devem permanecer armazenados? → A: Remover permanentemente a sala, seus vínculos e seus avisos, sem período de recuperação.
- Q: Se a resposta da exclusão de uma sala for perdida e o aplicativo repetir a mesma solicitação após a sala já ter sido removida, qual resultado o usuário deve receber? → A: Tratar a repetição como sucesso e retornar o usuário à lista de salas atualizada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete an Owned Classroom Safely (Priority: P1)

As a professor who created a classroom, I can delete that classroom from the mobile application after reviewing an explicit warning, so that obsolete classrooms and their dependent content do not remain active by mistake.

**Why this priority**: Classroom deletion changes shared data for every participant and is the highest-risk missing end-to-end flow.

**Independent Test**: Create a classroom as one professor, add participants and an announcement, then delete it from that professor's account. Verify the confirmation, the final disappearance of the classroom and dependent content, and denial for every non-owner account.

**Acceptance Scenarios**:

1. **Given** a professor is the creator of a classroom, **When** the professor opens that classroom, **Then** the delete action is available and clearly identifies the classroom affected.
2. **Given** the owner selects delete, **When** the confirmation is displayed, **Then** no data changes until the owner explicitly confirms.
3. **Given** the owner confirms deletion, **When** the operation succeeds, **Then** the classroom, memberships, and classroom announcements are permanently removed without a recovery period, are no longer accessible, and the owner receives success feedback.
4. **Given** a parent or a professor who did not create the classroom, **When** that account attempts deletion through any client, **Then** the deletion is denied and the classroom remains unchanged.
5. **Given** the owner confirmed a deletion that completed but its response was lost, **When** the application repeats that same deletion request, **Then** the repeated request is treated as successful and the owner is returned to the refreshed classroom list without a false error.

---

### User Story 2 - Update My Name or Email (Priority: P1)

As an authenticated user in any supported role, I can edit my own name or email, review the proposed changes, and save them so that my account identity stays accurate.

**Why this priority**: Correct identity information affects sign-in, authorship, and how users recognize one another across classrooms and announcements.

**Independent Test**: From professor, parent, and administrator accounts, update only the name, only the email, and both fields together; verify equivalent self-service access, validation, confirmation, immediate display in the profile and home greeting, persistence after a new session, and rejection of a duplicate email.

**Acceptance Scenarios**:

1. **Given** an authenticated user is viewing their profile, **When** they choose to edit it, **Then** the current name and email are available for editing while role information remains read-only.
2. **Given** the user enters a valid new name or unused email, **When** they review and confirm the update, **Then** the new values are saved and displayed throughout the app.
3. **Given** the user enters an invalid or already-used email, **When** they attempt to continue, **Then** the update is not applied and a clear field-level message explains the problem.
4. **Given** the confirmation shows the proposed changes, **When** the user cancels, **Then** the stored profile remains unchanged and the entered values remain available for correction.
5. **Given** authenticated professor, parent, and administrator accounts, **When** each account submits a valid change to its own name or email, **Then** every supported role receives the same self-service behavior without gaining permission to change another account.

---

### User Story 3 - Confirm Every Update or Deletion (Priority: P1)

As a mobile user, I receive a consistent confirmation before every explicit update or deletion so that I can recover from an accidental tap before data changes.

**Why this priority**: Consistent prevention is more reliable than protecting only one high-risk screen and directly reduces accidental data loss or unintended edits.

**Independent Test**: Exercise every user-visible update and delete action in the current app and verify that each presents a consistent summary with cancel and confirm choices before sending the operation.

**Acceptance Scenarios**:

1. **Given** a user selects an update action, **When** the entered data is valid, **Then** a confirmation summarizes what will change before the update is applied.
2. **Given** a user selects a delete action, **When** the confirmation appears, **Then** it names the affected item and clearly states that the action is destructive.
3. **Given** any confirmation is open, **When** the user cancels or dismisses it, **Then** no operation is sent and no stored data changes.
4. **Given** the user confirms an action but it fails, **When** the failure is returned, **Then** the app preserves the current context and provides a useful recovery message without reporting false success.

---

### User Story 4 - Use an Interactive API Reference (Priority: P2)

As a developer learning or maintaining the product, I can discover the available API operations, their authentication rules, inputs, outputs, and errors in an interactive reference so that I can understand and exercise contracts without reading every source file.

**Why this priority**: A trustworthy API reference shortens onboarding and makes contract gaps visible before mobile integration work is considered complete.

**Independent Test**: Open the reference in a non-production environment, authorize with a valid development credential, find every public operation, inspect its schemas, and execute one read and one protected mutation.

**Acceptance Scenarios**:

1. **Given** the API is running in an allowed environment, **When** a developer opens the documented reference location, **Then** all externally supported operations are grouped and searchable by domain.
2. **Given** a protected operation, **When** the developer reviews it, **Then** required authentication, permissions, input fields, success responses, and relevant error responses are visible.
3. **Given** the API is running in production without explicit authorization to expose documentation, **When** someone requests the reference location, **Then** the interactive reference is unavailable.

---

### User Story 5 - Experience a Consistent and Accessible Interface (Priority: P2)

As a professor or parent, I encounter a coherent visual language and predictable interaction states across authentication, classrooms, announcements, and profile screens so that I can complete common tasks without relearning the interface.

**Why this priority**: Consistency and accessibility improve comprehension across every feature and reduce the cost of future screen work.

**Independent Test**: Review the primary flows against the documented visual foundation and complete representative tasks with screen-reader labels, clear focus/touch targets, and distinguishable loading, empty, error, success, and destructive states.

**Acceptance Scenarios**:

1. **Given** a user navigates among primary screens, **When** equivalent controls and states appear, **Then** they use the same visual hierarchy, terminology, spacing, and interaction pattern.
2. **Given** a screen has no data, is loading, succeeds, or fails, **When** that state is reached, **Then** the state is visually clear and provides the next appropriate action.
3. **Given** a user relies on accessibility support, **When** they navigate interactive controls, **Then** controls expose meaningful names, roles, and states, meet WCAG 2.2 Level AA contrast, and provide touch targets of at least 44×44 points on iOS and 48×48 density-independent pixels on Android.
4. **Given** a destructive action is available, **When** it is displayed, **Then** its styling is distinguishable from primary and neutral actions without relying on color alone.

---

### User Story 6 - Rely on Automated Delivery Gates (Priority: P2)

As a maintainer, I receive automated and actionable validation for every proposed change so that regressions in permissions, data integrity, contracts, and critical mobile behavior cannot be integrated unnoticed.

**Why this priority**: Existing automation provides a foundation, but the requested behaviors need complete regression coverage and enforced acceptance rules.

**Independent Test**: Submit one compliant change and representative changes that break formatting, compilation, a critical backend rule, and a critical mobile behavior; verify that only the compliant change satisfies all required gates.

**Acceptance Scenarios**:

1. **Given** a proposed change passes all required checks, **When** automated validation completes, **Then** each gate reports success with enough detail to audit what ran.
2. **Given** any required check fails, **When** validation completes, **Then** integration is blocked and the failure identifies the affected component and check.
3. **Given** a change affects authentication, authorization, persistence, or an external contract, **When** its validation suite runs, **Then** the relevant boundary behavior is exercised automatically.
4. **Given** a change affects a critical mobile flow, **When** its validation suite runs, **Then** the user-visible behavior and validation rules are exercised automatically in addition to static checks.

### Edge Cases

- A classroom is deleted while another participant is viewing or refreshing it; the participant receives a not-found state and a safe route back rather than stale content or a crash.
- A classroom owner tries to leave their own classroom without deleting it; the app prevents creation of an ownerless classroom and directs the owner to the appropriate action.
- A deletion confirmation is shown twice because of rapid taps, or the application retries after a successful response is lost; the mutation is applied only once, the repeated request is treated as successful, and the user returns to the refreshed classroom list without a false error.
- An update contains no effective changes; the app does not send a redundant operation and explains that nothing changed.
- A name contains surrounding whitespace, accents, or the maximum allowed length; normalization and validation are consistent between form and stored profile.
- An email differs only by letter case or surrounding whitespace from an existing account; uniqueness is evaluated on its normalized value.
- A profile email changes while multiple sessions are active; the current device remains connected with the updated identity, while every other session is invalidated and must sign in again with the new email.
- Connectivity is lost after confirmation; the app does not claim success and allows the user to retry without duplicating the mutation.
- The interactive API reference starts while part of the contract metadata is missing; delivery validation fails rather than publishing a misleading partial reference.
- A visual reference conflicts with accessibility, Portuguese content length, or existing product identity; usability and accessibility requirements take precedence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST associate every classroom with exactly one creating professor who remains its owner while the classroom exists.
- **FR-002**: Only the professor who owns a classroom MUST be permitted to delete it; all other authenticated and unauthenticated actors MUST be denied without changing classroom data.
- **FR-003**: The mobile application MUST expose classroom deletion only to the owning professor and MUST still rely on server-side authorization as the final authority.
- **FR-004**: Deleting a classroom MUST permanently remove the classroom, its memberships, and its announcements without a recovery period and without leaving orphaned or partially visible records.
- **FR-005**: Every classroom deletion request MUST present the classroom name, destructive consequences, and separate cancel and confirm choices before any deletion occurs.
- **FR-006**: Every authenticated user MUST be able to update their own name, email, or both, regardless of supported role.
- **FR-007**: Profile updates MUST reject blank names, malformed emails, emails already assigned to another account, unsupported fields, and requests that attempt to alter another user's profile.
- **FR-008**: Successful profile changes MUST appear in every current-account identity display without requiring an application restart, including the profile and home greeting in the current mobile scope, and MUST persist into later sessions. After an email change, the current device MUST remain authenticated with the updated identity, while all other active sessions MUST be invalidated and require a new sign-in with the updated email.
- **FR-009**: Role changes and password changes MUST NOT be exposed as part of this profile-editing scope.
- **FR-010**: Every explicit user-facing update or delete action in the current mobile scope MUST require an affirmative confirmation after validation and before the operation is submitted.
- **FR-011**: Update confirmations MUST summarize the affected item and changed values; delete confirmations MUST identify the affected item and describe irreversible or cascading consequences.
- **FR-012**: Cancelling or dismissing a confirmation MUST produce no stored change, and a failed confirmed action MUST preserve useful user context and display a Portuguese recovery message.
- **FR-013**: Repeated taps or retries MUST NOT cause the same confirmed mutation to be applied more than once. If a classroom deletion completed but its response was lost, repeating that same confirmed request MUST be treated as successful and the mobile application MUST return the owner to the refreshed classroom list without displaying a false failure.
- **FR-014**: The product MUST maintain a documented visual foundation covering colors, typography, spacing, shape, icons, component states, destructive actions, and accessibility expectations.
- **FR-015**: Primary authentication, classroom, announcement, and profile flows MUST use reusable visual and interaction patterns from that foundation, including loading, empty, error, success, disabled, and pressed states where applicable.
- **FR-016**: The chosen visual direction MUST be documented with either an approved external reference or an explicit evolution of the existing green/neutral product identity before broad redesign work begins.
- **FR-017**: Interactive controls MUST provide meaningful accessibility labels and roles, visible state feedback, WCAG 2.2 Level AA contrast, and minimum touch targets of 44×44 points on iOS and 48×48 density-independent pixels on Android.
- **FR-018**: Maintainers MUST have a discoverable interactive reference for every externally supported API operation in development and test environments.
- **FR-019**: The API reference MUST describe operation purpose, parameters, request and response fields, authentication and role requirements, successful outcomes, and relevant validation, authorization, conflict, and not-found outcomes.
- **FR-020**: The interactive reference MUST support authenticated exploration with development credentials and MUST be disabled or explicitly protected in production.
- **FR-021**: Every proposed repository change MUST run automated component-appropriate gates that cover formatting, static correctness, buildability, automated behavior tests, and environment or dependency health.
- **FR-022**: Changes affecting persistence, authentication, authorization, or external contracts MUST include automated boundary coverage; critical mobile flows MUST include automated behavior coverage in addition to static validation.
- **FR-023**: Every required gate MUST be configured as an enforced integration check in the repository hosting settings. A required gate failure MUST prevent the change from being considered ready to integrate and MUST provide actionable failure output; the feature MUST NOT be considered complete until this enforcement is active.
- **FR-024**: Automated coverage MUST include owner-only classroom deletion and cascading effects, profile name and email updates including conflicts, confirmation behavior for update and delete flows, and availability and completeness of the API reference.
- **FR-025**: Existing role-based authentication, Portuguese user-facing language, classroom membership rules, and announcement-author permissions MUST remain unchanged except where this specification explicitly extends behavior.

### Key Entities

- **User**: An authenticated professor, parent, or administrator with a unique normalized email, display name, role, and session identity. This feature allows self-service changes only to name and email.
- **Classroom**: A named school communication space with one creating professor as owner, zero or more members, and zero or more announcements. Ownership determines deletion permission. Its terminal lifecycle transition is permanent deletion together with all memberships and announcements, with no recoverable state or retention period.
- **Announcement**: A classroom-bound message with an author and active period; it is dependent content when its classroom is deleted and an independently editable/deletable item where current permissions allow.
- **Confirmation Decision**: A transient user decision that identifies the pending action and target, summarizes changes or consequences, and records confirm or cancel before a mutation is submitted.
- **API Operation Description**: Maintainer-facing contract information for an externally supported operation, including inputs, outputs, authentication, permissions, and errors.
- **Visual Foundation**: The approved set of reusable visual tokens, component patterns, interaction states, content conventions, and accessibility rules for the mobile experience.
- **Quality Gate Result**: The auditable pass or failure outcome for a required automated validation category associated with a proposed change.
- **Device Session**: An independently revocable authenticated session associated with one user and device context. The session that performs an email change remains active, while the user's other active sessions become invalid.
- **Deletion Retry Record**: A minimal, non-recoverable record that proves an owned-classroom deletion completed and allows only the same owner to repeat an ambiguous request as a success without retaining classroom content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated authorization scenarios, 100% of classroom deletion attempts by the owner succeed and 100% of attempts by non-owners or unauthenticated actors are rejected without data loss.
- **SC-002**: At least 95% of test participants can locate and complete an owned-classroom deletion, including confirmation, in under 45 seconds without assistance.
- **SC-003**: At least 95% of test participants can update a name or email and verify the new value in under two minutes without assistance.
- **SC-004**: 100% of user-visible update and delete actions in the agreed mobile scope show an explicit confirmation, and cancellation causes zero persisted changes in automated scenarios.
- **SC-005**: After a successful profile update, the new identity is visible in the profile and home greeting within two seconds, every other current-account identity display remains consistent, and the identity remains correct after the next sign-in; after an email change, the current device remains authenticated and every other previously active session is rejected when it next attempts authenticated access or renewal.
- **SC-006**: 100% of externally supported API operations appear in the interactive reference with authentication, request, success, and relevant error information, and a new developer can successfully exercise one read and one protected mutation within 15 minutes.
- **SC-007**: 100% of audited primary screens conform to the approved visual foundation; all targeted interactive controls meet WCAG 2.2 Level AA contrast and minimum touch targets of 44×44 points on iOS and 48×48 density-independent pixels on Android; and the accessibility review finds no unresolved critical issue in the targeted flows.
- **SC-008**: At least 90% of representative professor and parent tasks are completed on the first attempt during usability review of the redesigned primary flows.
- **SC-009**: 100% of proposed changes run all applicable automated gates; each gate is enforced as required by the repository hosting settings, and deliberately introduced failures in each required category are detected and prevent readiness approval. If enforcement cannot be configured, the feature receives no completion approval.
- **SC-010**: Every critical behavior introduced or completed by this feature has at least one automated success scenario and one relevant failure or permission scenario, with all such scenarios passing before the feature is accepted.

## Assumptions

- Existing server-side classroom ownership, deletion, profile update, and associated tests are the baseline to integrate and extend, not work to discard or duplicate.
- The current authenticated account is sufficient authorization to request a name or email change in this increment; separate email verification and password re-entry are out of scope unless planning identifies a mandatory security constraint.
- A changed email becomes the identifier for the next sign-in. The device that performs the change remains authenticated with refreshed identity information, while all other active sessions are invalidated.
- “Confirmations when deleting or updating” means every explicit save/update and delete action exposed in the current mobile product. Creation, joining a classroom, navigation, and sign-out are outside that wording unless they independently warrant confirmation.
- The current direct displays of the authenticated account's name or email are the profile and the home greeting. Any additional current-account display discovered during implementation joins the same update-and-verification inventory rather than becoming an implicit exception.
- Confirmation is requested after local validation so users are not asked to confirm data that is already known to be invalid.
- The visual work will evolve the existing green/neutral direction unless the project owner provides and approves a different screenshot or link before planning is finalized.
- The interactive API reference is intended for learning, development, and testing. Production exposure is not required and is denied by default.
- Existing automated workflows are a foundation. Completion includes missing critical behavior tests and verification that required checks are enforced by the repository hosting settings. Changing organization-wide policy is outside repository scope, but lack of permission to enable required checks blocks this feature's completion.
- No new user roles, classroom transfer-of-ownership flow, account deletion flow, or broad password-management redesign is included in this feature.

## Dependencies

- Existing role-based authentication and session handling must continue to identify the current user reliably.
- Existing classroom ownership and dependent-data relationships must be preserved during integration.
- The mobile client and server contract must be planned and validated together for classroom deletion and profile updates.
- A product owner must approve the visual reference or the documented evolution of the current visual direction before broad redesign acceptance.
- Repository-hosting permissions must allow maintainers to mark automated checks as required for integration; until that enforcement is active, this feature remains incomplete.
