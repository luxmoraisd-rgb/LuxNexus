import { memo } from 'react';
import {
  CommentBubblePlusIcon,
  UserOutlineIcon,
  MoveUpIcon,
  MoveDownIcon,
  TrashIcon,
  EditIcon,
} from './BacklogIcons';
import { STATUS_CONFIG, TEAM_MEMBERS, TYPE_CONFIG, isTaskPastDueAndIncomplete } from './TaskRowUtils';

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
  onMoveTask,
  onDeleteTask,
  showToast,
  teamMembers = TEAM_MEMBERS,
}) => {
  const membersList = Array.isArray(teamMembers) && teamMembers.length > 0 ? teamMembers : TEAM_MEMBERS;
  const ownerObj =
    typeof task.owner === 'object' && task.owner !== null
      ? {
          id: task.owner.id || task.owner.email || '',
          name: task.owner.name || task.owner.username || 'Unassigned',
          initial: task.owner.initial || (task.owner.name ? task.owner.name[0].toUpperCase() : 'U'),
          avatarBg: task.owner.avatarBg || '#6366f1',
        }
      : membersList.find(
          (m) =>
            m.id === task.owner ||
            (m.username && m.username.toLowerCase() === String(task.owner || '').toLowerCase()) ||
            m.name?.toLowerCase() === String(task.owner || '').toLowerCase() ||
            (m.id === 'sivakumar' && task.owner === 'siva')
        ) ||
        (task.owner
          ? {
              name: String(task.owner),
              initial: String(task.owner)[0]?.toUpperCase() || 'U',
              avatarBg: '#137333',
            }
          : null);
  const isDone = task.status === 'Done';


  const handleCopyId = () => {
    navigator.clipboard.writeText(task.taskId);
    showToast(`Copied ${task.taskId} to clipboard!`, 'info');
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
          className="backlog-owner-avatar-wrapper cursor-pointer"
          onClick={(e) => onOpenOwnerPicker(task, e)}
          title={`Assigned to ${ownerObj ? ownerObj.name : 'Unassigned'}. Click to reassign`}
        >
          {ownerObj ? (
            <div
              className="backlog-owner-initial-avatar"
              style={{ backgroundColor: ownerObj.avatarBg }}
            >
              {ownerObj.initial}
            </div>
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
            onClick={(e) => onOpenStatusPicker(task, e)}
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
            onClick={(e) => onOpenTypePicker(task, e)}
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
            title="Click to copy task ID (double click to edit)"
          >
            {task.taskId}
          </button>
          {onOpenEditTaskId && (
            <button
              type="button"
              className="backlog-task-id-edit-icon"
              onClick={(e) => onOpenEditTaskId(task, e)}
              title="Admin: Edit Task ID to unique ID"
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
          onClick={(e) => onOpenSPPicker(task, e)}
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
            onClick={(e) => onOpenEpicPicker(task, e)}
            title="Click to select epic"
          >
            <span className="epic-badge-text">{task.epic ? `⚡ ${task.epic}` : '+ Select Epic'}</span>
            <span className="epic-dropdown-arrow">▾</span>
          </button>
        </div>
      </td>


      {/* Quick Actions (Move & Delete) */}
      <td className="td-actions">
        <div className="backlog-row-actions">
          {/* Move between Sprint and Backlog */}
          <button
            type="button"
            className="backlog-row-action-btn"
            onClick={() => onMoveTask(task.id, isSprint1 ? 'backlog' : 'sprint1')}
            title={isSprint1 ? 'Move to Backlog' : 'Move to Sprint 1'}
          >
            {isSprint1 ? <MoveDownIcon size={13} /> : <MoveUpIcon size={13} />}
          </button>

          {/* Delete Task */}
          <button
            type="button"
            className="backlog-row-action-btn delete"
            onClick={() => onDeleteTask(task.id)}
            title="Delete task"
          >
            <TrashIcon size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;
