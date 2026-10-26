# Jobs and assignments

Jobs belong to projects and have company-unique job numbers. Names may repeat. Administrators create, edit, archive, and restore jobs from the Jobs workspace. Archival ends current assignments and preserves history; restoring does not reassign former participants.

A person may work on several jobs. Crew, foreman, and supervisor are assignment responsibilities, separate from company access roles. Changing jobs never transfers tool custody.

Company rules independently configure joining and leaving as direct, approval required, or disabled. Field employees can request only their own participation and cannot promote themselves. Managers can explicitly assign people regardless of the self-service mode. Approval of a leave request targets the original assignment rather than a later replacement.

The API enforces active membership, company scope, revisions, and assignment intervals. The frontend displays current server policy and refreshes affected queries after commands. The Team directory joins real assignment and custody records. All reads and commands use authenticated sessions and the generated OpenAPI client.

Job lists use searchable rows with separate project, job, archive/restore and roster dialogs. Direct participation uses the original field switch, backed by confirmed assignments and a retryable command. Approval rules show a request action, pending state and withdrawal action, rather than offering a second request or changing membership before approval. When self-service is disabled, the row explains that a manager must add or remove the person. Joining and leaving can use different rules. Closed jobs do not offer new assignments. Current assignments load once for the workspace; a selected roster loads its history separately.

Assignment and participation reads include durable person, job and actor names. A request stores its own decision note. Offboarding and job closure reject outstanding requests with the recorded reason, and historical names do not depend on the active-person picker. Review eligibility comes from the same intent validation used by the command, including the exact assignment referenced by a leave request.
