import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MoreIcon,
  SparklePlusIcon,
  InfoCircleIcon,
  PlayIcon,
  CheckIcon,
} from '../Backlog/BacklogIcons';
import {
  CheckCircle2,
  Clock,
  Target,
  Flame,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Users,
  Edit3,
} from 'lucide-react';
import TaskRow from '../Backlog/TaskRow';
import { STATUS_CONFIG, TYPE_CONFIG, TEAM_MEMBERS, isTaskPastDueAndIncomplete } from '../Backlog/TaskRowUtils';
import { activeSprintApi, normalizeSprint, normalizeTask } from './activeSprintApi';
import './ActiveSprint.css';

const ActiveSprint = memo(({
  sprints = [],
  allTasks = [],
  processedTasks = [],
  selectedTaskIds = new Set(),
  statusConfig = {},
  typeConfig = {},
  currentUser,
  rolePermissions,
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
  onCreateTask,
  onUpdateTaskStatus,
  showToast,
  onGoToBacklog,
}) => {
  // Active sprint switcher if multiple exist
  const activeSprints = useMemo(
    () => sprints.filter((s) => Boolean(s.isStarted)),
    [sprints]
  );

  const [selectedSprintId, setSelectedSprintId] = useState(null);

  useEffect(() => {
    const handleSelectSprint = (e) => {
      if (e.detail) {
        setSelectedSprintId(String(e.detail));
      }
    };
    window.addEventListener('nexus:select-active-sprint', handleSelectSprint);
    return () => window.removeEventListener('nexus:select-active-sprint', handleSelectSprint);
  }, []);

  const activeSprint = useMemo(() => {
    if (activeSprints.length === 0) return null;
    if (selectedSprintId) {
      return activeSprints.find((s) => String(s.id) === String(selectedSprintId)) || activeSprints[0];
    }
    return activeSprints[0];
  }, [activeSprints, selectedSprintId]);

  const plannedSprints = useMemo(
    () => (sprints || []).filter((s) => !s.isStarted && !s.isCompleted),
    [sprints]
  );

  const firstPlannedSprint = plannedSprints[0] || null;

  // Local modals state for Active Sprint specific operations
  const [activeModalState, setActiveModalState] = useState(null);
  const [capacityInput, setCapacityInput] = useState(20);
  const [goalInput, setGoalInput] = useState('');
  const [standupUpdates, setStandupUpdates] = useState([
    { id: 1, author: 'Sivakumar', update: 'Integrated backend sprint capacity & dates APIs. Next up: Real-time syncing.' },
    { id: 2, author: 'Alex', update: 'Reviewing PR for active sprint table components and real-time syncing.' },
  ]);
  const [standupDraft, setStandupDraft] = useState('');

  // Sync capacity & goals input when activeSprint changes
  useEffect(() => {
    if (activeSprint) {
      setCapacityInput(activeSprint.capacityLimit || activeSprint.capacity_limit || 20);
      setGoalInput(activeSprint.goals || activeSprint.goal || '');
    }
  }, [activeSprint]);

  // Tasks belonging to active sprint (past-due incomplete tasks automatically roll over to Backlog)
  const sprintTasks = useMemo(() => {
    if (!activeSprint) return [];
    const source = Array.isArray(processedTasks) && processedTasks.length > 0 ? processedTasks : allTasks;
    return source.filter((t) => String(t.sprintId) === String(activeSprint.id) && !isTaskPastDueAndIncomplete(t));
  }, [processedTasks, allTasks, activeSprint]);

  // Story points calculations & metrics
  const metrics = useMemo(() => {
    const totalTasks = sprintTasks.length;
    const totalSp = sprintTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);
    const capacityLimit = activeSprint?.capacityLimit || 20;

    const doneTasks = sprintTasks.filter((t) => t.status === 'Done');
    const doneSp = doneTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);

    const inProgressTasks = sprintTasks.filter((t) => t.status === 'In Progress' || t.status === 'In Review');
    const inProgressSp = inProgressTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);

    const readyTasks = sprintTasks.filter((t) => t.status === 'Ready to start');
    const readySp = readyTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);

    const donePct = capacityLimit > 0 ? Math.min(100, Math.round((doneSp / capacityLimit) * 100)) : 0;
    const inProgressPct = capacityLimit > 0 ? Math.min(100, Math.round((inProgressSp / capacityLimit) * 100)) : 0;

    return {
      totalTasks,
      totalSp,
      capacityLimit,
      doneTasksCount: doneTasks.length,
      doneSp,
      donePct,
      inProgressSp,
      inProgressPct,
      readySp,
      capacityPct: capacityLimit > 0 ? Math.round((totalSp / capacityLimit) * 100) : 0,
    };
  }, [sprintTasks, activeSprint]);

  // Breakdown stats for table footer
  const statusStats = useMemo(() => {
    const total = sprintTasks.length;
    if (total === 0) return [];
    const statusCounts = {};
    sprintTasks.forEach((t) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      pct: (count / total) * 100,
      color: statusConfig[status]?.bg || STATUS_CONFIG[status]?.bg || '#8085a6',
    }));
  }, [sprintTasks, statusConfig]);

  const typeStats = useMemo(() => {
    const total = sprintTasks.length;
    if (total === 0) return [];
    const typeCounts = {};
    sprintTasks.forEach((t) => {
      typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      pct: (count / total) * 100,
      color: typeConfig[type]?.bg || TYPE_CONFIG[type]?.bg || '#8085a6',
    }));
  }, [sprintTasks, typeConfig]);

  // Save Capacity Limit Handler
  const handleSaveCapacity = useCallback(async () => {
    if (!activeSprint) return;
    const limit = Number(capacityInput);
    setActiveModalState(null);
    showToast(`Sprint capacity limit set to ${limit} SP`, 'success');
    await activeSprintApi.updateCapacity(activeSprint.id, limit);
  }, [activeSprint, capacityInput, showToast]);

  // Save Sprint Goal Handler
  const handleSaveGoal = useCallback(async () => {
    if (!activeSprint) return;
    setActiveModalState(null);
    showToast('Sprint goal updated successfully', 'success');
    await activeSprintApi.updateGoals(activeSprint.id, goalInput);
  }, [activeSprint, goalInput, showToast]);

  // =========================================================================
  // RENDER: EMPTY STATE (NO ACTIVE SPRINT IN PROGRESS)
  // =========================================================================
  if (activeSprints.length === 0) {
    return (
      <div className="active-sprint-empty-state">
        <div className="active-sprint-empty-card">
          <div className="active-sprint-empty-badge">
            <span className="active-sprint-pulse-dot" />
            <span>Active Sprint Only</span>
          </div>
          <div className="active-sprint-empty-icon-wrap">
            <PlayIcon size={32} />
          </div>
          <h3 className="active-sprint-empty-title">No Active Sprint In Progress</h3>
          <p className="active-sprint-empty-desc">
            This view displays only currently active sprints. You do not have an active sprint running right now.
            Head to the Backlog to plan and click <strong>Start</strong> on a sprint.
          </p>

          {/* Planned Sprints Ready to Start */}
          {plannedSprints.length > 0 && (
            <div className="active-sprint-planned-list">
              <span className="active-sprint-planned-heading">
                Planned Sprints Ready to Start:
              </span>
              {plannedSprints.map((sprint) => {
                const count = allTasks.filter((t) => String(t.sprintId) === String(sprint.id)).length;
                const sp = allTasks
                  .filter((t) => String(t.sprintId) === String(sprint.id))
                  .reduce((acc, t) => acc + (Number(t.sp) || 0), 0);

                return (
                  <div key={sprint.id} className="active-sprint-planned-item">
                    <div className="active-sprint-planned-info">
                      <span className="active-sprint-planned-name">{sprint.name}</span>
                      <span className="active-sprint-planned-meta">
                        {count} {count === 1 ? 'issue' : 'issues'} · {sp} Story Points · {sprint.dates || 'Dates not set'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="active-sprint-start-quick-btn"
                      onClick={() => onOpenModal && onOpenModal('startSprint', sprint, null)}
                    >
                      <PlayIcon size={12} />
                      <span>Start Sprint</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="active-sprint-empty-actions">
            {onGoToBacklog && (
              <button
                type="button"
                className="active-sprint-btn-primary"
                onClick={onGoToBacklog}
              >
                <span>Back to Backlog</span>
              </button>
            )}
            {firstPlannedSprint && onOpenModal && (
              <button
                type="button"
                className="active-sprint-btn-secondary"
                onClick={() => onOpenModal('startSprint', firstPlannedSprint, null)}
              >
                <PlayIcon size={13} />
                <span>Start {firstPlannedSprint.name}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="active-sprint-container">
      {/* Multi-Active Sprint Switcher Bar */}
      {activeSprints.length > 1 && (
        <div className="active-sprint-switcher-bar">
          <div className="active-sprint-switcher-label">
            <Layers size={15} />
            <span>Active Sprints ({activeSprints.length}):</span>
          </div>
          <div className="active-sprint-switcher-tabs">
            {activeSprints.map((s) => {
              const isSelected = String(s.id) === String(activeSprint.id);
              const count = allTasks.filter(
                (t) => String(t.sprintId || '') === String(s.id || '')
              ).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`active-sprint-tab-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedSprintId(s.id)}
                  title={`Switch to ${s.name}`}
                >
                  <span className="active-sprint-pill-status-dot" />
                  <span className="active-sprint-pill-name">{s.name}</span>
                  <span className="active-sprint-pill-badge">
                    {count} {count === 1 ? 'issue' : 'issues'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. HERO & SPRINT METRICS BANNER */}
      <section className="active-sprint-hero">
        <div className="active-sprint-hero-top">
          <div>
            <div className="active-sprint-title-group">
              <h1 className="active-sprint-title">
                {activeSprint.name}
              </h1>
              <div className="active-sprint-live-badge">
                <span className="active-sprint-pulse-dot" />
                <span>Active Sprint</span>
              </div>
            </div>

            <div className="active-sprint-meta-chips">
              <button
                type="button"
                className="active-sprint-meta-chip"
                onClick={(e) => onOpenModal && onOpenModal('sprintDates', activeSprint, e)}
                title="Click to edit sprint dates manually"
              >
                <Calendar size={13} />
                <span>{activeSprint.dates || 'Add Sprint dates'}</span>
              </button>

              <div className="active-sprint-meta-chip days-left">
                <Clock size={13} />
                <span>Iteration in Progress</span>
              </div>

              <div className="active-sprint-meta-chip">
                <Target size={13} />
                <span>{metrics.totalTasks} issues committed</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="active-sprint-hero-actions">
            <button
              type="button"
              className="active-sprint-action-btn secondary"
              onClick={() => setActiveModalState('dailyStandup')}
              title="Open Daily Standup feed and updates"
            >
              <Users size={14} />
              <span>Daily Standup</span>
            </button>

            <button
              type="button"
              className="active-sprint-action-btn secondary"
              onClick={() => setActiveModalState('capacityModal')}
              title="Configure team story points capacity limit"
            >
              <Flame size={14} />
              <span>Capacity ({metrics.totalSp}/{metrics.capacityLimit} SP)</span>
            </button>

            <button
              type="button"
              className="active-sprint-action-btn primary"
              onClick={() => onOpenModal && onOpenModal('completeSprint', activeSprint, null)}
              title="Complete this sprint"
            >
              <CheckIcon size={13} />
              <span>Complete Sprint</span>
            </button>

            <button
              type="button"
              className="backlog-header-icon-btn"
              title="Sprint options & settings"
              onClick={(e) => onOpenModal && onOpenModal('sprintMore', activeSprint, e)}
            >
              <MoreIcon />
            </button>
          </div>
        </div>

        {/* Sprint Goal Bar */}
        <div className="active-sprint-goal-bar">
          <div className="active-sprint-goal-content">
            <span className="active-sprint-goal-label">Goal:</span>
            <span>{activeSprint.goals || activeSprint.goal || 'No sprint goal specified yet. Click to define goal.'}</span>
          </div>
          <button
            type="button"
            className="active-sprint-goal-edit-btn"
            onClick={() => setActiveModalState('goalModal')}
            title="Edit sprint goal"
          >
            <Edit3 size={14} />
          </button>
        </div>

        {/* Sprint Metrics Progress Bar */}
        <div className="active-sprint-metrics-grid">
          <div className="active-sprint-metric-box">
            <div className="active-sprint-metric-header">
              <span>Velocity & Scope</span>
              <Flame size={14} color="#f59e0b" />
            </div>
            <span className="active-sprint-metric-value">{metrics.totalSp} SP</span>
            <span className="active-sprint-metric-sub">{metrics.totalTasks} total tasks committed</span>
            <div className="active-sprint-progress-wrapper">
              <div className="active-sprint-progress-track">
                <div
                  className="active-sprint-progress-fill done"
                  style={{ width: `${metrics.donePct}%` }}
                  title={`Done: ${metrics.doneSp} SP`}
                />
                <div
                  className="active-sprint-progress-fill in-progress"
                  style={{ width: `${metrics.inProgressPct}%` }}
                  title={`In Progress: ${metrics.inProgressSp} SP`}
                />
              </div>
            </div>
          </div>

          <div className="active-sprint-metric-box">
            <div className="active-sprint-metric-header">
              <span>Completed Work</span>
              <CheckCircle2 size={14} color="#10b981" />
            </div>
            <span className="active-sprint-metric-value" style={{ color: '#10b981' }}>
              {metrics.doneSp} SP
            </span>
            <span className="active-sprint-metric-sub">{metrics.doneTasksCount} issues resolved</span>
          </div>

          <div className="active-sprint-metric-box">
            <div className="active-sprint-metric-header">
              <span>Capacity Planned</span>
              <Target size={14} color="#3b82f6" />
            </div>
            <span className="active-sprint-metric-value">{metrics.capacityLimit} SP</span>
            <span className="active-sprint-metric-sub">
              {metrics.capacityPct}% capacity allocated
            </span>
          </div>
        </div>
      </section>



      {/* 2. ACTIVE SPRINT TABLE VIEW ONLY */}

      {/* TABLE / LIST VIEW */}
      <section className="backlog-group-section active-sprint-section active-sprint-table-only">
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
                      checked={sprintTasks.length > 0 && sprintTasks.every((t) => selectedTaskIds.has(t.id))}
                      onChange={() => onToggleAllSprint && onToggleAllSprint(activeSprint.id)}
                      aria-label={`Select all ${activeSprint.name} tasks`}
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
                      <span>Story Points</span>
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
                    isSprint1={true}
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

                {sprintTasks.length === 0 && (
                  <tr className="active-sprint-empty-table-row">
                    <td colSpan={11} className="active-sprint-empty-table-cell">
                      <p>No tasks currently assigned to {activeSprint.name}.</p>
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot>
                <tr className="backlog-table-summary-row">
                  <td className="td-accent sprint-1-bar-transparent" />
                  <td className="td-checkbox" />
                  <td className="td-task">
                    <button
                      type="button"
                      className="backlog-btn-inline-create"
                      onClick={() =>
                        onOpenModal &&
                        onOpenModal('createTask', { sprint: activeSprint.id, sprintId: activeSprint.id })
                      }
                      title={`Create issue in ${activeSprint.name}`}
                    >
                      + Create issue in {activeSprint.name}
                    </button>
                  </td>
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
                      <span className="backlog-sp-sum-val">{metrics.totalSp} SP</span>
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
        </section>

      {/* =====================================================================
          4. LOCAL ACTIVE SPRINT DIALOGS & MODALS
          ===================================================================== */}
      {/* Capacity Modal */}
      {activeModalState === 'capacityModal' && (
        <div className="active-sprint-modal-overlay" onClick={() => setActiveModalState(null)}>
          <div className="active-sprint-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="active-sprint-modal-header">
              <h3 className="active-sprint-modal-title">Configure Sprint Capacity</h3>
              <button
                type="button"
                className="active-sprint-modal-close"
                onClick={() => setActiveModalState(null)}
              >
                ✕
              </button>
            </div>
            <div className="active-sprint-modal-body">
              <p className="active-sprint-modal-desc">
                Set the story points capacity planned for <strong>{activeSprint.name}</strong>. This updates the burndown metrics and header gauge.
              </p>
              <div className="active-sprint-modal-field">
                <label className="active-sprint-modal-label">Capacity Limit (Story Points)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  className="active-sprint-modal-input"
                />
              </div>
            </div>
            <div className="active-sprint-modal-footer">
              <button
                type="button"
                className="active-sprint-action-btn secondary"
                onClick={() => setActiveModalState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="active-sprint-action-btn primary"
                onClick={handleSaveCapacity}
              >
                Save Capacity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {activeModalState === 'goalModal' && (
        <div className="active-sprint-modal-overlay" onClick={() => setActiveModalState(null)}>
          <div className="active-sprint-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="active-sprint-modal-header">
              <h3 className="active-sprint-modal-title">Edit Sprint Goal</h3>
              <button
                type="button"
                className="active-sprint-modal-close"
                onClick={() => setActiveModalState(null)}
              >
                ✕
              </button>
            </div>
            <div className="active-sprint-modal-body">
              <p className="active-sprint-modal-desc">
                Define what the development team aims to achieve by the end of {activeSprint.name}.
              </p>
              <textarea
                rows={3}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="e.g. Complete authentication, task management APIs, and mobile responsive dashboard"
                className="active-sprint-modal-textarea"
              />
            </div>
            <div className="active-sprint-modal-footer">
              <button
                type="button"
                className="active-sprint-action-btn secondary"
                onClick={() => setActiveModalState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="active-sprint-action-btn primary"
                onClick={handleSaveGoal}
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Standup Modal */}
      {activeModalState === 'dailyStandup' && (
        <div className="active-sprint-modal-overlay" onClick={() => setActiveModalState(null)}>
          <div className="active-sprint-modal-card active-sprint-standup-card" onClick={(e) => e.stopPropagation()}>
            <div className="active-sprint-modal-header">
              <h3 className="active-sprint-modal-title">Daily Standup · {activeSprint.name}</h3>
              <button
                type="button"
                className="active-sprint-modal-close"
                onClick={() => setActiveModalState(null)}
              >
                ✕
              </button>
            </div>
            <div className="active-sprint-modal-body">
              <div className="active-sprint-standup-list">
                {standupUpdates.map((su) => (
                  <div key={su.id} className="active-sprint-standup-item">
                    <span className="active-sprint-standup-author">{su.author}</span>
                    <p className="active-sprint-standup-text">{su.update}</p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!standupDraft.trim()) return;
                  setStandupUpdates((prev) => [
                    ...prev,
                    { id: Date.now(), author: currentUser?.name || 'Sivakumar', update: standupDraft.trim() },
                  ]);
                  setStandupDraft('');
                  showToast('Daily standup update shared!', 'success');
                }}
                className="active-sprint-standup-form"
              >
                <label className="active-sprint-modal-label">
                  Post Your Update (Yesterday / Today / Blockers):
                </label>
                <textarea
                  rows={2}
                  value={standupDraft}
                  onChange={(e) => setStandupDraft(e.target.value)}
                  placeholder="Yesterday I finished... Today I'm working on... No blockers."
                  className="active-sprint-modal-textarea"
                  required
                />
                <button type="submit" className="active-sprint-action-btn primary" style={{ alignSelf: 'flex-end' }}>
                  Post Update
                </button>
              </form>
            </div>
            <div className="active-sprint-modal-footer">
              <button
                type="button"
                className="active-sprint-action-btn secondary"
                onClick={() => setActiveModalState(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ActiveSprint.displayName = 'ActiveSprint';

export default ActiveSprint;
