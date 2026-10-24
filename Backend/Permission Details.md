# Role Permission Details

The backend uses role permissions to control access to tasks, sprints, teams,
board settings, and reports. A user's role is stored on their account. Permission
policies for Team Lead and User can be changed by an Admin from the Permissions
screen; the values below are the default policy.

## Roles

### Admin

An Admin has every permission, and the backend enforces this regardless of any
saved policy values. Admins can:

- View all tasks, boards, and task details.
- Create, assign, edit, and delete any task.
- Update tasks assigned to them.
- Create, start, and update sprints.
- Manage team membership and team-level settings.
- Change board columns, views, and project settings.
- View reports and team progress.
- Change the Team Lead and User permission policies.

Admin permissions are always enabled and cannot be switched off in the
Permissions screen.

### Team Lead

The default Team Lead policy allows them to:

- View tasks, boards, and task details.
- Create, assign, edit, and delete any task.
- Update tasks assigned to them.
- Create, start, and update sprints.
- Manage team membership and team-level settings.

By default, Team Leads cannot change board settings or view reports. An Admin
can adjust these Team Lead permissions.

### User

The default User policy allows them to:

- View tasks, boards, and task details.
- Update tasks assigned to them.

By default, Users cannot manage all tasks, manage sprints, manage the team,
change board settings, or view reports. An Admin can adjust these User
permissions.

## Permission definitions

| Permission key | Meaning |
| --- | --- |
| `view_tasks` | Access task lists, boards, and task details. |
| `manage_tasks` | Create, assign, edit, and delete any task; upload files and links to Ready to start. |
| `update_assigned_tasks` | Change tasks assigned to the current user. |
| `manage_sprints` | Create, start, and update sprints. |
| `manage_team` | Manage team membership and team-level settings. |
| `manage_board` | Change board columns, views, and project settings. |
| `view_reports` | Access reporting and team progress information. |

## Task update rules

Task access is also checked at the task level. A user with `manage_tasks` can
update or delete any task. A user with `update_assigned_tasks` can update a task
only when they are its assignee; that permission alone does not allow deletion
or creation. Viewing tasks requires `view_tasks`.

## Policy management

Only an authenticated Admin can save permission policy changes. Changes can
affect the Team Lead and User policies. Admin permissions remain fully enabled
even if a request or previously saved policy contains disabled Admin values.

The role and policy enforcement is implemented in
`AppCore/Auth/role_permissions.py`; the policy endpoint is implemented in
`AppCore/Auth/views/permissions.py`.
