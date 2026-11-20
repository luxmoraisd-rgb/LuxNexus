# Role Permission Details

The backend enforces a fixed workspace policy. Permission values are displayed
read-only in the Permissions screen and cannot be edited there.

## Roles

### Admin

Members, Team Leads, and Admins have the same access to application modules and
actions, including tasks, reports, portfolios, people, teams, invitations, and
chat. The Admin role itself remains limited to email addresses listed in
`NEXUS_ADMIN_EMAILS`; an Admin-role account with an unconfigured email is treated
as a Member.

### Team Lead

Team Leads have the same application access as Members and Admins.

### Member

Members have the same application access as Team Leads and Admins.

The Permissions screen remains read-only. Only configured Admin identities may
be assigned the Admin role.

## Permission definitions

| Permission key | Meaning |
| --- | --- |
| `view_tasks` | Access task lists, boards, and task details. |
| `manage_tasks` | Create, assign, edit, and delete any task. |
| `update_assigned_tasks` | Change tasks assigned to the current user. |
| `manage_sprints` | Create, start, and update sprints. |
| `manage_team` | Manage team membership and team-level settings. |
| `manage_board` | Change board columns, views, and project settings. |
| `view_reports` | Access reporting and team progress information. |
| `manage_portfolios` | View, create, update, and delete portfolios. |
| `invite_members` | Invite people and manage the directory and teams. |
| `manage_own_profile` | Update the current user's profile and personal settings. |

The role and policy enforcement is implemented in
`AppCore/Auth/role_permissions.py`; the read-only policy endpoint is implemented
in `AppCore/Auth/views/permissions.py`.
