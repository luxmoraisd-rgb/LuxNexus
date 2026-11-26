import { memo } from 'react';
import {
  CommentBubblePlusIcon,
  UserOutlineIcon,
  TrashIcon,
  EditIcon,
} from './BacklogIcons';
import { getProfileAvatarUrl, STATUS_CONFIG, TEAM_MEMBERS, TYPE_CONFIG, isTaskPastDueAndIncomplete } from './TaskRowUtils';
import TaskOwnerAvatar from './TaskOwnerAvatar';
import { copyTaskPermalink } from './taskPermalink';

const TaskRow = memo(({
  task,
  isChecked,
  isSprint1,
  statusConfig,
  typeConfig,
  onToggleTask,
  onOpenComments,
  onOpenOwnerPicker,
  onOpenStatusPicker,
  onOpenTypePicker,
  onOpenSPPicker,
  onOpenEpicPicker,
  onOpenEditTaskId,
  onDeleteTask,
  showToast,
  teamMembers = TEAM_MEMBERS,
  customColumns = [],
}) => {
  const membersList = Array.isArray(teamMembers) && teamMembers.length > 0 ? teamMembers : TEAM_MEMBERS;
  const ownerObj =
    typeof task.owner === 'object' && task.owner !== null
      ? {
          ...task.owner,
          id: task.owner.id || task.owner.email || '',
          name: task.owner.name || task.owner.username || 'Unassigned',
          initial: task.owner.initial || (task.owner.name ? task.owner.name[0].toUpperCase() : 'U'),
          avatarBg: task.owner.avatarBg || task.owner.avatarColor || '#6366f1',
          avatarUrl: getProfileAvatarUrl(task.owner),
        }
      : (() => {
          const member = membersList.find(
            (m) =>
              m.id === task.owner ||
              (m.username && m.username.toLowerCase() === String(task.owner || '').toLowerCase()) ||
              m.name?.toLowerCase() === String(task.owner || '').toLowerCase()
          );
          if (member) {
            return {
              ...member,
              initial: member.initial || member.initials || member.name?.[0]?.toUpperCase() || 'U',
              avatarBg: member.avatarBg || member.avatarColor || '#6366f1',
              avatarUrl: getProfileAvatarUrl(member),
            };
          }
          return task.owner
            ? {
                name: String(task.owner),
                initial: String(task.owner)[0]?.toUpperCase() || 'U',
                avatarBg: '#6366f1',
              }
            : null;
        })();
  const isDone = task.status === 'Done';


  const handleCopyId = async () => {
    try {
      await copyTaskPermalink(task.taskId);
      showToast(`Copied a direct link for ${task.taskId}.`, 'success');
    } catch (error) {
      console.error('[Backlog] Unable to copy task link.', error);
      showToast('Unable to copy the task link. Check clipboard permissions and try again.', 'error');
    }
  };

  return (
    <tr
      className={`backlog-row ${isChecked ? 'row-selected' : ''} ${isDone ? 'row-done' : ''}`}
      onClick={() => onOpenComments(task)}
      title="Click to open task card & details"
    >
      <td className={`td-accent ${isSprint1 ? 'sprint-1-bar' : 'backlog-bar'}`} />
      
      {/* Checkbox */}
      <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="backlog-custom-checkbox"
          checked={isChecked}
          onChange={() => onToggleTask(task.id)}
          aria-label={`Select ${task.title}`}
        />
      </td>

      {/* Task Title & Comment Action */}
      <td className="td-task" onClick={() => onOpenComments(task)}>
        <div className="backlog-task-title-cell">
          <span
            className={`backlog-task-name clickable-title ${isDone ? 'task-name-done' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(task);
            }}
            title="Click to open task card & comments"
          >
            {task.title}
          </span>
          {isTaskPastDueAndIncomplete(task) && (
            <span
              className="backlog-overdue-tag"
              title={`Due date finished: ${task.dueDate || task.due_date || 'Past date'} (Incomplete - in Backlog)`}
            >
              Past Due
            </span>
          )}
          <button
            type="button"
            className="backlog-task-comment-btn"
            title={`Discussion & updates (${task.comments?.length || 0})`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(task);
            }}
          >
            <CommentBubblePlusIcon />
            {task.comments?.length > 0 && (
              <span className="backlog-comment-count">
                {task.comments.length}
              </span>
            )}
          </button>
        </div>
      </td>

      {/* Owner Avatar */}
      <td className="td-owner" onClick={(e) => e.stopPropagation()}>
        <div
          className={`backlog-owner-avatar-wrapper ${onOpenOwnerPicker ? 'cursor-pointer' : ''}`}
          onClick={onOpenOwnerPicker ? (e) => onOpenOwnerPicker(task, e) : undefined}
          title={`Assigned to ${ownerObj ? ownerObj.name : 'Unassigned'}. Click to reassign`}
        >
          {ownerObj ? (
            <TaskOwnerAvatar key={ownerObj.avatarUrl || ownerObj.name} owner={ownerObj} />
          ) : (
            <div className="backlog-owner-avatar">
              <UserOutlineIcon size={16} />
            </div>
          )}
        </div>
      </td>

      {/* Status Badge */}
      <td className="td-status" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-cell-relative">
          <button
            type="button"
            className="backlog-badge-status"
            style={{
              backgroundColor: (statusConfig && statusConfig[task.status]?.bg) || STATUS_CONFIG[task.status]?.bg || '#ffab40',
              color: (statusConfig && statusConfig[task.status]?.text) || STATUS_CONFIG[task.status]?.text || '#202124',
            }}
            onClick={onOpenStatusPicker ? (e) => onOpenStatusPicker(task, e) : undefined}
            disabled={!onOpenStatusPicker}
            title="Click to change status"
          >
            {task.status}
          </button>
        </div>
      </td>

      {/* Type Badge */}
      <td className="td-type" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-cell-relative">
          <button
            type="button"
            className="backlog-badge-type"
            style={{
              backgroundColor: (typeConfig && typeConfig[task.type]?.bg) || TYPE_CONFIG[task.type]?.bg || '#f783ac',
              color: (typeConfig && typeConfig[task.type]?.text) || TYPE_CONFIG[task.type]?.text || '#202124',
            }}
            onClick={onOpenTypePicker ? (e) => onOpenTypePicker(task, e) : undefined}
            disabled={!onOpenTypePicker}
            title="Click to change task type"
          >
            {task.type}
          </button>
        </div>
      </td>

      {/* Task ID with Copy & Admin Edit */}
      <td className="td-id" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-task-id-cell-wrapper">
          <button
            type="button"
            className="backlog-task-id-btn"
            onClick={handleCopyId}
            onDoubleClick={(e) => {
              if (onOpenEditTaskId) onOpenEditTaskId(task, e);
            }}
            title="Click to copy a direct task link (double click to edit)"
          >
            {task.taskId}
          </button>
          {onOpenEditTaskId && (
            <button
              type="button"
              className="backlog-task-id-edit-icon"
              onClick={(e) => onOpenEditTaskId(task, e)}
              title="Edit task ID to a unique ID"
            >
              <EditIcon size={11} />
            </button>
          )}
        </div>
      </td>

      {/* Estimated SP with Editor */}
      <td className="td-sp">
        <button
          type="button"
          className="backlog-sp-btn"
          onClick={onOpenSPPicker ? (e) => onOpenSPPicker(task, e) : undefined}
          disabled={!onOpenSPPicker}
          title="Click to set story points"
        >
          {task.sp !== null && task.sp !== undefined ? `${task.sp} SP` : '-'}
        </button>
      </td>

      {/* Epic Dropdown Column */}
      <td className="td-epic" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-cell-relative">
          <button
            type="button"
            className={`backlog-badge-epic ${task.epic ? 'has-epic' : 'empty-epic'}`}
            onClick={onOpenEpicPicker ? (e) => onOpenEpicPicker(task, e) : undefined}
            disabled={!onOpenEpicPicker}
            title="Click to select epic"
          >
            <span className="epic-badge-text">{task.epic ? `⚡ ${task.epic}` : '+ Select Epic'}</span>
            <span className="epic-dropdown-arrow">▾</span>
          </button>
        </div>
      </td>


      {/* Quick Action */}
      <td className="td-actions">
        <div className="backlog-row-actions">
          {/* Delete Task */}
          {onDeleteTask && <button
            type="button"
            className="backlog-row-action-btn delete"
            onClick={() => onDeleteTask(task.id)}
            title="Delete task"
          >
            <TrashIcon size={13} />
          </button>}
        </div>
      </td>
      {customColumns.map((column) => (
        <td className="td-custom-column" key={column} style={{ minWidth: 120 }}>
          {task.customFields?.[column] ?? task[column] ?? ''}
        </td>
      ))}
    </tr>
  );
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;
