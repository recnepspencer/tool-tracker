# Jobs and assignments

Jobs belong to projects and have company-unique job numbers. Names may repeat. Administrators create, edit, archive, and restore jobs from the Jobs workspace. Archival ends current assignments and preserves history; restoring does not reassign former participants.

A person may work on several jobs. Crew, foreman, and supervisor are assignment responsibilities, separate from company access roles. Changing jobs never transfers tool custody.

Company rules independently configure joining and leaving as direct, approval required, or disabled. Field employees can request only their own participation and cannot promote themselves. Managers can explicitly assign people regardless of the self-service mode. Approval of a leave request targets the original assignment rather than a later replacement.

The API enforces active membership, company scope, revisions, and assignment intervals. The frontend displays current server policy and refreshes affected queries after commands. The Team directory joins real assignment and custody records. All reads and commands use authenticated sessions and the generated OpenAPI client.
