import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ActiveSprint from './ActiveSprint';
import BacklogModals from '../Backlog/BacklogModals';
import { activeSprintApi, normalizeSprint, normalizeTask } from './activeSprintApi';
import { sprintApi, taskApi, projectKeyApi, DEFAULT_PROJECT_KEY, getStoredSprints, getStoredTasks } from '../Backlog/backlogApi';
import { STATUS_CONFIG, TYPE_CONFIG, isTaskPastDueAndIncomplete } from '../Backlog/TaskRowUtils';
import './ActiveSprint.css';

export const ActiveSprintPage = ({ rolePermissions, currentUser }) => {
  const navigate = useNavigate();

  // Core data states
  const [sprints, setSprints] = useState(() => {
    const stored = getStoredSprints();
    return Array.isArray(stored) ? stored.map(normalizeSprint) : [];
  });
  const [allTasks, setAllTasks] = useState(() => {
    const stored = getStoredTasks();
    return Array.isArray(stored) ? stored.map(normalizeTask) : [];
  });
  const [projectKey, setProjectKey] = useState(DEFAULT_PROJECT_KEY);
  const [isLoading, setIsLoading] = useState(true);

  // Modal & Selection state
  const [activeModal, setActiveModal] = useState(null);
  const [activeTaskTarget, setActiveTaskTarget] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Load from API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [apiSprints, apiTasks, key] = await Promise.allSettled([
        activeSprintApi.getAllSprints(),
        activeSprintApi.getSprintTasks(),
        projectKeyApi.get(),
      ]);

      if (apiSprints.status === 'fulfilled' && Array.isArray(apiSprints.value)) {
        setSprints(apiSprints.value);
      }
      if (apiTasks.status === 'fulfilled' && Array.isArray(apiTasks.value)) {
        setAllTasks(apiTasks.value);
      }
      if (key.status === 'fulfilled' && key.value) {
        setProjectKey(key.value);
      }
    } catch (err) {
      console.warn('[ActiveSprintPage] API load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen for cross-view updates
    const syncTasks = (e) => {
      if (Array.isArray(e.detail)) setAllTasks(e.detail.map(normalizeTask));
    };
    const syncSprints = (e) => {
      if (Array.isArray(e.detail)) setSprints(e.detail.map(normalizeSprint));
    };

    window.addEventListener('nexus:backlog-tasks-changed', syncTasks);
    window.addEventListener('nexus:backlog-sprints-changed', syncSprints);
    return () => {
      window.removeEventListener('nexus:backlog-tasks-changed', syncTasks);
      window.removeEventListener('nexus:backlog-sprints-changed', syncSprints);
    };
  }, [loadData]);

  // Modal open & close
  const handleOpenModal = useCallback((modalName, target = null, e = null) => {
    if (e && e.currentTarget && typeof e.currentTarget.getBoundingClientRect === 'function') {
      const rect = e.currentTarget.getBoundingClientRect();
      setAnchorRect({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setAnchorRect(null);
    }
    setActiveTaskTarget(target);
    setActiveModal(modalName);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
    setActiveTaskTarget(null);
    setAnchorRect(null);
  }, []);

  // Task selection toggle
  const handleToggleTask = useCallback((id) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAllSprint = useCallback((sprintId) => {
    const targetTasks = allTasks.filter((t) => String(t.sprintId) === String(sprintId));
    const ids = targetTasks.map((t) => t.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTaskIds.has(id));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allTasks, selectedTaskIds]);

  // Status Change Handler (API integrated)
  const handleStatusChange = useCallback(async (taskId, newStatus) => {
    setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    showToast(`Status updated to "${newStatus}"`, 'info');
    await activeSprintApi.updateTask(taskId, { status: newStatus });
  }, [showToast]);

  // Start Sprint Handler (API integrated)
  const handleStartSprint = useCallback(async (sprintId) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, isStarted: true, status: 'active' } : s))
    );
    const sprintObj = sprints.find((s) => s.id === sprintId);
    handleCloseModal();
    showToast(`${sprintObj?.name || 'Sprint'} is now Active! 🚀`, 'success');
    await activeSprintApi.startSprint(sprintId);
    await sprintApi.start(sprintId);
  }, [sprints, handleCloseModal, showToast]);

  // Complete Sprint Handler (API integrated)
  const handleCompleteSprint = useCallback(async (sprintId) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, isStarted: false, isCompleted: true, status: 'completed' } : s))
    );
    setAllTasks((prev) =>
      prev.map((t) => (t.sprintId === sprintId && t.status !== 'Done' ? { ...t, sprintId: 'backlog' } : t))
    );
    const sprintObj = sprints.find((s) => s.id === sprintId);
    handleCloseModal();
    showToast(`${sprintObj?.name || 'Sprint'} completed! 🎉 Incomplete tasks moved to Backlog.`, 'success');
    await activeSprintApi.completeSprint(sprintId);
    await sprintApi.complete(sprintId);
  }, [sprints, handleCloseModal, showToast]);

  // Delete Task Handler (API integrated)
  const handleDeleteTask = useCallback(async (taskId) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    showToast('Task deleted successfully', 'info');
    await activeSprintApi.deleteTask(taskId);
  }, [showToast]);

  // Create Task Handler (API integrated)
  const handleCreateTask = useCallback(async (taskInput) => {
    const rawDueDate = taskInput.dueDate || taskInput.due_date || '';
    const status = taskInput.status || 'Ready to start';
    const isPastIncomplete = isTaskPastDueAndIncomplete({ dueDate: rawDueDate, status });
    const targetSprint = isPastIncomplete ? 'backlog' : (taskInput.sprint || 'backlog');

    const newTask = {
      id: `task-${Date.now()}`,
      taskId: `LUX-${Date.now().toString().slice(-3)}`,
      title: taskInput.title,
      status,
      type: taskInput.type || 'Frontend',
      sp: taskInput.sp || 3,
      sprintId: targetSprint,
      dueDate: rawDueDate,
      owner: 'siva',
    };
    setAllTasks((prev) => [...prev, newTask]);
    if (isPastIncomplete && taskInput.sprint && taskInput.sprint !== 'backlog') {
      showToast('Task has a past due date and was placed in Backlog', 'info');
    } else {
      showToast(`Task created!`, 'success');
    }
    try {
      const created = await activeSprintApi.createTask(newTask);
      setAllTasks((prev) => prev.map((t) => (t.id === newTask.id ? { ...t, ...created } : t)));
    } catch {
      // Keep optimistic
    }
  }, [showToast]);

  // Move Task Handler (API integrated)
  const handleMoveTask = useCallback(async (taskId, targetSprint) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, sprintId: targetSprint } : t))
    );
    showToast(`Task moved to ${targetSprint === 'backlog' ? 'Backlog' : 'Sprint'}`, 'info');
    await activeSprintApi.moveTask(taskId, { sprintId: targetSprint });
  }, [showToast]);

  // Update Sprint Dates Handler (API integrated)
  const handleUpdateSprintDates = useCallback(async (sprintId, datesText) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, dates: datesText } : s))
    );
    handleCloseModal();
    showToast(`Sprint timeline updated to "${datesText}"`, 'success');
    await activeSprintApi.updateDates(sprintId, { durationText: datesText });
  }, [handleCloseModal, showToast]);

  return (
    <div className="backlog-root-container">
      {/* Toast Alert */}
      {toast.show && (
        <div className={`backlog-toast toast-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navigation Breadcrumbs */}
      <div className="active-sprint-page-nav">
        <div className="active-sprint-breadcrumbs">
          <button
            type="button"
            onClick={() => navigate('/work/backlog')}
            className="active-sprint-breadcrumb-link"
          >
            Backlog
          </button>
          <span className="active-sprint-breadcrumb-divider">/</span>
          <span className="active-sprint-breadcrumb-active">Active Sprint</span>
        </div>

        <div className="active-sprint-nav-actions">
          <button
            type="button"
            className="active-sprint-nav-btn"
            onClick={() => navigate('/work/tasks')}
          >
            Kanban Board
          </button>
          <button
            type="button"
            className="active-sprint-nav-btn"
            onClick={() => navigate('/work/backlog')}
          >
            Backlog View
          </button>
        </div>
      </div>

      {/* Active Sprint Component */}
      <ActiveSprint
        sprints={sprints}
        allTasks={allTasks}
        processedTasks={allTasks}
        selectedTaskIds={selectedTaskIds}
        statusConfig={STATUS_CONFIG}
        typeConfig={TYPE_CONFIG}
        onToggleTask={handleToggleTask}
        onToggleAllSprint={handleToggleAllSprint}
        onOpenModal={handleOpenModal}
        onOpenComments={(task) => handleOpenModal('taskComments', task)}
        onOpenOwnerPicker={(task, e) => handleOpenModal('ownerPicker', task, e)}
        onOpenStatusPicker={(task, e) => handleOpenModal('statusPicker', task, e)}
        onOpenTypePicker={(task, e) => handleOpenModal('typePicker', task, e)}
        onOpenSPPicker={(task, e) => handleOpenModal('spPicker', task, e)}
        onOpenEpicPicker={(task, e) => handleOpenModal('epicPicker', task, e)}
        onMoveTask={handleMoveTask}
        onDeleteTask={handleDeleteTask}
        onUpdateTaskStatus={handleStatusChange}
        onCreateTask={handleCreateTask}
        showToast={showToast}
        onGoToBacklog={() => navigate('/work/backlog')}
        currentUser={currentUser}
        rolePermissions={rolePermissions}
      />

      {/* Shared Backlog / Sprint Modals */}
      <BacklogModals
        activeModal={activeModal}
        activeTaskTarget={activeTaskTarget}
        anchorRect={anchorRect}
        onClose={handleCloseModal}
        sprints={sprints}
        allTasks={allTasks}
        projectKey={projectKey}
        statusConfig={STATUS_CONFIG}
        typeConfig={TYPE_CONFIG}
        onStartSprint={handleStartSprint}
        onCompleteSprint={handleCompleteSprint}
        onUpdateSprintDates={handleUpdateSprintDates}
        onCreateTask={handleCreateTask}
        onDeleteTask={handleDeleteTask}
        onStatusChange={handleStatusChange}
        onOwnerChange={(taskId, owner) => {
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, owner } : t)));
          activeSprintApi.updateTask(taskId, { owner });
          handleCloseModal();
        }}
        onTypeChange={(taskId, type) => {
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, type } : t)));
          activeSprintApi.updateTask(taskId, { type });
          handleCloseModal();
        }}
        onSPChange={(taskId, sp) => {
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, sp } : t)));
          activeSprintApi.updateTask(taskId, { sp });
          handleCloseModal();
        }}
        onEpicChange={(taskId, epic) => {
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, epic } : t)));
          activeSprintApi.updateTask(taskId, { epic });
          handleCloseModal();
        }}
        showToast={showToast}
      />
    </div>
  );
};

export default ActiveSprintPage;
