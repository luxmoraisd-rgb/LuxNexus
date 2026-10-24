import { useState, memo } from 'react';

const InlineTaskInput = memo(({
  onAddTask,
  isSprint1,
  availableTypes = ['Frontend', 'Backend', 'Feature', 'Bug', 'Quality'],
  defaultType = 'Frontend',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [selectedType, setSelectedType] = useState(defaultType);

  const handleSubmit = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddTask(trimmed, selectedType);
    setInputVal('');
    setIsAdding(false);
  };

  const handleCancel = () => {
    setInputVal('');
    setIsAdding(false);
  };

  return (
    <tr className="backlog-add-task-row">
      <td className={`td-accent ${isSprint1 ? 'sprint-1-bar' : 'backlog-bar'}`} />
      <td className="td-checkbox">
        <div className="backlog-checkbox-placeholder" />
      </td>
      <td className="td-task" colSpan={9}>
        {!isAdding ? (
          <button
            type="button"
            className="backlog-btn-add-inline"
            onClick={() => setIsAdding(true)}
          >
            + Add task
          </button>
        ) : (
          <div className="backlog-inline-input-wrapper">
            <input
              type="text"
              className="backlog-inline-task-input"
              placeholder="Type task name and press Enter..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
            />
            <select
              className="backlog-inline-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              title="Select task type (Frontend, Backend, etc.)"
            >
              {availableTypes.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="backlog-btn-save-inline"
              onClick={handleSubmit}
            >
              Add
            </button>
            <button
              type="button"
              className="backlog-btn-cancel-inline"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

InlineTaskInput.displayName = 'InlineTaskInput';

export default InlineTaskInput;
