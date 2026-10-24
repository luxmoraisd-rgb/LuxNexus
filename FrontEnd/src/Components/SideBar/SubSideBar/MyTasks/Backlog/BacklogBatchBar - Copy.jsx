import { memo } from 'react';
import { MoveUpIcon, MoveDownIcon, CheckIcon, TrashIcon, CloseIcon } from './BacklogIcons';

const BacklogBatchBar = memo(({
  selectedCount,
  onMoveToSprint1,
  onMoveToBacklog,
  onMarkDone,
  onDeleteSelected,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="backlog-batch-bar" role="toolbar" aria-label="Batch actions">
      <div className="batch-bar-left">
        <span className="batch-bar-count-badge">{selectedCount}</span>
        <span className="batch-bar-label">
          {selectedCount === 1 ? 'task selected' : 'tasks selected'}
        </span>
      </div>

      <div className="batch-bar-divider" />

      <div className="batch-bar-actions">
        <button
          type="button"
          className="batch-bar-btn"
          onClick={onMoveToSprint1}
          title="Move selected tasks to Sprint 1"
        >
          <MoveUpIcon size={14} />
          <span>Move to Sprint 1</span>
        </button>

        <button
          type="button"
          className="batch-bar-btn"
          onClick={onMoveToBacklog}
          title="Move selected tasks to Backlog"
        >
          <MoveDownIcon size={14} />
          <span>Move to Backlog</span>
        </button>

        <button
          type="button"
          className="batch-bar-btn"
          onClick={onMarkDone}
          title="Mark selected tasks as Done"
        >
          <CheckIcon size={14} />
          <span>Mark Done</span>
        </button>

        <button
          type="button"
          className="batch-bar-btn delete"
          onClick={onDeleteSelected}
          title="Delete selected tasks"
        >
          <TrashIcon size={14} />
          <span>Delete</span>
        </button>
      </div>

      <div className="batch-bar-divider" />

      <button
        type="button"
        className="batch-bar-close-btn"
        onClick={onClearSelection}
        title="Deselect all"
        aria-label="Clear selection"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
});

BacklogBatchBar.displayName = 'BacklogBatchBar';

export default BacklogBatchBar;
