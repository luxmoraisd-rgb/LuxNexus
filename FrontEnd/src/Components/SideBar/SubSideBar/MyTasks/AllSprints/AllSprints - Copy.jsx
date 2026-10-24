import { memo, useState, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MoreIcon,
  SparklePlusIcon,
  InfoCircleIcon,
  PlayIcon,
  CheckIcon,
  RefreshIcon,
} from '../Backlog/BacklogIcons';
import TaskRow from '../Backlog/TaskRow';
import { STATUS_CONFIG, TYPE_CONFIG, isTaskPastDueAndIncomplete } from '../Backlog/TaskRowUtils';
import InlineTaskInput from '../Backlog/InlineTaskInput';
import '../Backlog/Backlog.css';
import './AllSprints.css';

/**
 * AllSprints Component
 * Displays ALL sprints across the project with a high-level metrics banner,
 * status filters (All, Active, Planned, Completed), and individual sprint tables.
 */
const AllSprints = memo(({
  sprints = [],
  allTasks = [],
  processedTasks = [],
  selectedTaskIds = new Set(),
  statusConfig = {},
  typeConfig = {},
  onToggleTask,
  onToggleAllSprint,
  onToggleSprintExpand,
  onOpenModal,
  onOpenComments,
  onOpenOwnerPicker,
  onOpenStatusPicker,
  onOpenTypePicker,
  onOpenSPPicker,
  onOpenEpicPicker,
  onMoveTask,
  onDeleteTask,
  onRemoveEpic,
  onAddTaskToSprint,
  onCreateSprint,
  showToast,
  onGoToBacklog,
}) => {
  // Filter state: 'all' | 'active' | 'planned' | 'completed'
  const [filterState, setFilterState] = useState('all');

  // Breakdown counts
  const activeSprintsCount = useMemo(
    () => sprints.filter((s) => s.isStarted && !s.isCompleted).length,
    [sprints]
  );

  const plannedSprintsCount = useMemo(
    () => sprints.filter((s) => !s.isStarted && !s.isCompleted).length,
    [sprints]
  );

  const completedSprintsCount = useMemo(
    () => sprints.filter((s) => Boolean(s.isCompleted)).length,
    [sprints]
  );

  const effectiveTasks = useMemo(() => {
    return Array.isArray(processedTasks) && processedTasks.length > 0 ? processedTasks : (allTasks || []);
  }, [processedTasks, allTasks]);

  // Total committed Story Points across all sprints
  const totalCommittedSP = useMemo(() => {
    const sprintIds = new Set(sprints.map((s) => String(s.id)));
    return effectiveTasks
      .filter((t) => sprintIds.has(String(t.sprintId)))
      .reduce((sum, t) => sum + (Number(t.sp) || 0), 0);
  }, [sprints, effectiveTasks]);

  // Filtered sprints to display based on the active tab/chip
  const visibleSprints = useMemo(() => {
    switch (filterState) {
      case 'active':
        return sprints.filter((s) => s.isStarted && !s.isCompleted);
      case 'planned':
        return sprints.filter((s) => !s.isStarted && !s.isCompleted);
      case 'completed':
        return sprints.filter((s) => Boolean(s.isCompleted));
      case 'all':
      default:
        return sprints;
    }
  }, [sprints, filterState]);

  // Handle empty project sprints state
  if (sprints.length === 0) {
    return (
      <div className="all-sprints-empty-state">
        <div className="all-sprints-empty-card">
          <div className="all-sprints-empty-icon-wrap">
            <RefreshIcon size={30} />
          </div>
          <h3 className="all-sprints-empty-title">No Sprints Created Yet</h3>
          <p className="all-sprints-empty-desc">
            You don't have any sprints created in this project. Create your first sprint
            to start organizing tasks, estimating story points, and tracking velocity.
          </p>
          <div className="all-sprints-empty-actions">
            {onCreateSprint && (
              <button
                type="button"
                className="all-sprints-btn-primary"
                onClick={onCreateSprint}
              >
                + Create First Sprint
              </button>
            )}
            {onGoToBacklog && (
              <button
                type="button"
                className="all-sprints-btn-secondary"
                onClick={onGoToBacklog}
              >
                Go to Backlog
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="all-sprints-container">
      {/* 1. High-Level Metrics & Overview Banner */}
      <div className="all-sprints-overview-banner">
        <div className="all-sprints-banner-top">
          <div className="all-sprints-title-wrap">
            <div className="all-sprints-icon-badge">
              <RefreshIcon size={20} />
            </div>
            <div>
              <h2 className="all-sprints-title">All Project Sprints</h2>
              <p className="all-sprints-subtitle">
                Comprehensive overview of active iterations, planned roadmaps, and commitments
              </p>
            </div>
          </div>

          <div className="all-sprints-banner-actions">
            {onCreateSprint && (
              <button
                type="button"
                className="all-sprints-btn-create"
                onClick={onCreateSprint}
                title="Create a new sprint"
              >
                + Create Sprint
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="all-sprints-stats-grid">
          <div className="all-sprints-stat-card">
            <div className="all-sprints-stat-icon total">Σ</div>
            <div className="all-sprints-stat-info">
              <span className="all-sprints-stat-num">{sprints.length}</span>
              <span className="all-sprints-stat-label">Total Sprints</span>
            </div>
          </div>

          <div className="all-sprints-stat-card">
            <div className="all-sprints-stat-icon active">▶</div>
            <div className="all-sprints-stat-info">
              <span className="all-sprints-stat-num">{activeSprintsCount}</span>
              <span className="all-sprints-stat-label">Active Now</span>
            </div>
          </div>

          <div className="all-sprints-stat-card">
            <div className="all-sprints-stat-icon planned">⏱</div>
            <div className="all-sprints-stat-info">
              <span className="all-sprints-stat-num">{plannedSprintsCount}</span>
              <span className="all-sprints-stat-label">Planned</span>
            </div>
          </div>

          <div className="all-sprints-stat-card">
            <div className="all-sprints-stat-icon sp">★</div>
            <div className="all-sprints-stat-info">
              <span className="all-sprints-stat-num">{totalCommittedSP} SP</span>
              <span className="all-sprints-stat-label">Committed Points</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="all-sprints-filter-bar">
        <div className="all-sprints-filter-chips">
          <button
            type="button"
            className={`all-sprints-chip ${filterState === 'all' ? 'active' : ''}`}
            onClick={() => setFilterState('all')}
          >
            <span>All Sprints</span>
            <span className="all-sprints-chip-count">{sprints.length}</span>
          </button>

          <button
            type="button"
            className={`all-sprints-chip ${filterState === 'active' ? 'active' : ''}`}
            onClick={() => setFilterState('active')}
          >
            <span>Active</span>
            <span className="all-sprints-chip-count">{activeSprintsCount}</span>
          </button>

          <button
            type="button"
            className={`all-sprints-chip ${filterState === 'planned' ? 'active' : ''}`}
            onClick={() => setFilterState('planned')}
          >
            <span>Planned</span>
            <span className="all-sprints-chip-count">{plannedSprintsCount}</span>
          </button>

          {completedSprintsCount > 0 && (
            <button
              type="button"
              className={`all-sprints-chip ${filterState === 'completed' ? 'active' : ''}`}
              onClick={() => setFilterState('completed')}
            >
              <span>Completed</span>
              <span className="all-sprints-chip-count">{completedSprintsCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Sprints List */}
      <div className="all-sprints-list">
        {visibleSprints.length === 0 ? (
          <div className="all-sprints-empty-card" style={{ margin: '20px auto' }}>
            <h4 className="all-sprints-empty-title">
              No {filterState} sprints found
            </h4>
            <p className="all-sprints-empty-desc">
              There are no sprints matching the "{filterState}" filter in this project.
            </p>
            <button
              type="button"
              className="all-sprints-btn-secondary"
              onClick={() => setFilterState('all')}
            >
              Show All Sprints
            </button>
          </div>
        ) : (
          visibleSprints.map((sprint) => {
            const sprintTasks = effectiveTasks.filter((t) => String(t.sprintId || '') === String(sprint.id || '') && !isTaskPastDueAndIncomplete(t));
            const spSum = sprintTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);

            // Status stats per sprint
            const total = sprintTasks.length;
            const statusCounts = {};
            sprintTasks.forEach((t) => {
              statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            });
            const statusStats =
              total === 0
                ? []
                : Object.entries(statusCounts).map(([status, count]) => ({
                    status,
                    count,
                    pct: (count / total) * 100,
                    color: statusConfig[status]?.bg || STATUS_CONFIG[status]?.bg || '#8085a6',
                  }));

            // Type stats per sprint
            const typeCounts = {};
            sprintTasks.forEach((t) => {
              typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
            });
            const typeStats =
              total === 0
                ? []
                : Object.entries(typeCounts).map(([type, count]) => ({
                    type,
                    count,
                    pct: (count / total) * 100,
                    color: typeConfig[type]?.bg || TYPE_CONFIG[type]?.bg || '#8085a6',
                  }));

            const allSelected =
              sprintTasks.length > 0 && sprintTasks.every((t) => selectedTaskIds.has(t.id));
            const isExpanded = sprint.isExpanded !== false;

            return (
              <section
                key={sprint.id}
                className={`backlog-group-section all-sprints-section ${
                  sprint.isStarted ? 'is-active-sprint' : ''
                }`}
              >
                <div className="backlog-group-header">
                  <div
                    className="backlog-group-header-left cursor-pointer"
                    onClick={() => onToggleSprintExpand && onToggleSprintExpand(sprint.id)}
                  >
                    <button
                      type="button"
                      className="backlog-accordion-toggle-btn sprint-1-toggle"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDownIcon size={16} />
                      ) : (
                        <ChevronRightIcon size={16} />
                      )}
                    </button>
                    <h2 className="backlog-group-title sprint-1-title">{sprint.name}</h2>

                    {sprint.isStarted ? (
                      <span className="sprint-status-badge active">Active</span>
                    ) : sprint.isCompleted ? (
                      <span className="sprint-status-badge completed">Completed</span>
                    ) : (
                      <span className="sprint-status-badge planned">Planned</span>
                    )}

                    <span className="backlog-task-count-pill">
                      {sprintTasks.length} {sprintTasks.length === 1 ? 'issue' : 'issues'}
                    </span>
                  </div>

                  <div className="backlog-group-header-right">
                    <button
                      type="button"
                      className="backlog-header-link-btn"
                      onClick={(e) => onOpenModal && onOpenModal('sprintDates', sprint, e)}
                      title="Click to edit sprint dates manually"
                    >
                      {sprint.dates || 'Add Sprint dates'}
                    </button>

                    <button
                      type="button"
                      className="backlog-header-link-btn"
                      onClick={(e) => onOpenModal && onOpenModal('capacity', sprint, e)}
                      title="View team story points capacity"
                    >
                      Capacity
                    </button>

                    {sprint.isStarted && (
                      <div className="backlog-standup-wrapper">
                        <button
                          type="button"
                          className="backlog-header-link-btn active-standup"
                          onClick={() => onOpenModal && onOpenModal('dailyStandup', sprint, null)}
                          title="Open daily standup logs & updates"
                        >
                          Daily standup
                        </button>
                        <div className="backlog-standup-indicator" />
                      </div>
                    )}

                    {sprint.isStarted ? (
                      <button
                        type="button"
                        className="backlog-btn-complete-sprint"
                        onClick={() => onOpenModal && onOpenModal('completeSprint', sprint, null)}
                        title={`Complete ${sprint.name}`}
                      >
                        <CheckIcon size={13} />
                        <span>Complete sprint</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="backlog-btn-start-sprint"
                        onClick={() => onOpenModal && onOpenModal('startSprint', sprint, null)}
                        title={`Start ${sprint.name}`}
                      >
                        <PlayIcon size={13} />
                        <span>Start sprint</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="backlog-header-icon-btn"
                      title={`${sprint.name} settings & actions`}
                      onClick={(e) => onOpenModal && onOpenModal('sprintMore', sprint, e)}
                    >
                      <MoreIcon />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="backlog-table-wrapper">
                    <table className="backlog-table">
                      <colgroup>
                        <col className="col-accent sprint-1-accent" />
                        <col className="col-checkbox" />
                        <col className="col-task" />
                        <col className="col-owner" />
                        <col className="col-status" />
                        <col className="col-type" />
                        <col className="col-id" />
                        <col className="col-sp" />
                        <col className="col-epic" />
                        <col className="col-actions" />
                        <col className="col-add" />
                      </colgroup>

                      <thead>
                        <tr className="backlog-table-head-row">
                          <th className="th-accent sprint-1-bar" />
                          <th className="th-checkbox">
                            <input
                              type="checkbox"
                              className="backlog-custom-checkbox"
                              checked={allSelected}
                              onChange={() => onToggleAllSprint && onToggleAllSprint(sprint.id)}
                              aria-label={`Select all ${sprint.name} tasks`}
                            />
                          </th>
                          <th className="th-task">Task</th>
                          <th className="th-owner">Owner</th>
                          <th className="th-status">Status</th>
                          <th className="th-type">
                            <div className="th-type-content">
                              <span>Type</span>
                              <span className="th-sparkle-plus">
                                <SparklePlusIcon />
                              </span>
                            </div>
                          </th>
                          <th className="th-id">Task ID</th>
                          <th className="th-sp">
                            <div className="th-with-info">
                              <span>Estimated SP</span>
                              <InfoCircleIcon />
                            </div>
                          </th>
                          <th className="th-epic">
                            <div className="th-with-info">
                              <span>Epic</span>
                              <InfoCircleIcon />
                            </div>
                          </th>
                          <th className="th-actions">Actions</th>
                          <th className="th-add-col">
                            <button
                              type="button"
                              className="backlog-btn-add-col"
                              title="Add custom column"
                              onClick={(e) => onOpenModal && onOpenModal('addColumn', null, e)}
                            >
                              +
                            </button>
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {sprintTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            isChecked={selectedTaskIds.has(task.id)}
                            isSprint1={sprint.isStarted}
                            statusConfig={statusConfig}
                            typeConfig={typeConfig}
                            onToggleTask={onToggleTask}
                            onOpenComments={onOpenComments}
                            onOpenOwnerPicker={onOpenOwnerPicker}
                            onOpenStatusPicker={onOpenStatusPicker}
                            onOpenTypePicker={onOpenTypePicker}
                            onOpenSPPicker={onOpenSPPicker}
                            onOpenEpicPicker={onOpenEpicPicker}
                            onOpenEditTaskId={(targetTask, e) =>
                              onOpenModal && onOpenModal('editTaskId', targetTask, e)
                            }
                            onMoveTask={(taskId) => onMoveTask && onMoveTask(taskId, 'backlog')}
                            onDeleteTask={onDeleteTask}
                            onRemoveEpic={onRemoveEpic}
                            showToast={showToast}
                          />
                        ))}

                        {/* Inline Add Task Row for this sprint */}
                        <InlineTaskInput
                          onAddTask={(title, type) =>
                            onAddTaskToSprint && onAddTaskToSprint(sprint.id, title, type)
                          }
                          isSprint1={sprint.isStarted}
                          availableTypes={Object.keys(typeConfig || TYPE_CONFIG)}
                          defaultType="Frontend"
                        />
                      </tbody>

                      <tfoot>
                        <tr className="backlog-table-summary-row">
                          <td className="td-accent sprint-1-bar-transparent" />
                          <td className="td-checkbox" />
                          <td className="td-task" />
                          <td className="td-owner" />

                          <td className="td-status">
                            <div className="backlog-segmented-bar">
                              {statusStats.map((seg) => (
                                <div
                                  key={seg.status}
                                  className="backlog-segment-piece"
                                  style={{
                                    width: `${seg.pct}%`,
                                    backgroundColor: seg.color,
                                  }}
                                  title={`${seg.status}: ${seg.count}`}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="td-type">
                            <div className="backlog-segmented-bar">
                              {typeStats.map((seg) => (
                                <div
                                  key={seg.type}
                                  className="backlog-segment-piece"
                                  style={{
                                    width: `${seg.pct}%`,
                                    backgroundColor: seg.color,
                                  }}
                                  title={`${seg.type}: ${seg.count}`}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="td-id" />

                          <td className="td-sp">
                            <div className="backlog-sp-summary-box">
                              <span className="backlog-sp-sum-val">{spSum} SP</span>
                              <span className="backlog-sp-sum-label">sum</span>
                            </div>
                          </td>

                          <td className="td-epic" />
                          <td className="td-actions" />
                          <td className="td-empty" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
});

AllSprints.displayName = 'AllSprints';

export default AllSprints;
