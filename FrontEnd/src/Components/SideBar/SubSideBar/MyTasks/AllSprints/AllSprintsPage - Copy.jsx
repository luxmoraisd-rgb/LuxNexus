import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AllSprints from './AllSprints';
import BacklogModals from '../Backlog/BacklogModals';
import { allSprintsApi, normalizeSprint, normalizeTask } from './allSprintsApi';
import { projectKeyApi, DEFAULT_PROJECT_KEY, getStoredSprints, getStoredTasks } from '../Backlog/backlogApi';
import { STATUS_CONFIG, TYPE_CONFIG } from '../Backlog/TaskRowUtils';
import '../Backlog/Backlog.css';
import './AllSprints.css';

export const AllSprintsPage = ({ rolePermissions, currentUser }) => {
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

  // Load from MongoDB backend API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewRes, keyRes] = await Promise.allSettled([
        allSprintsApi.getOverview(),
        projectKeyApi.get(),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        if (Array.isArray(overviewRes.value.sprints)) {
          setSprints(overviewRes.value.sprints);
        }
        if (Array.isArray(overviewRes.value.tasks)) {
          setAllTasks(overviewRes.value.tasks);
        }
      }
      if (keyRes.status === 'fulfilled' && keyRes.value) {
        setProjectKey(keyRes.value);
      }
    } catch (err) {
      console.warn('[AllSprintsPage] API load error:', err);
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

  // Task selection
  const handleToggleTask = useCallback((taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleToggleAllSprint = useCallback((sprintId) => {
    setSelectedTaskIds((prev) => {
      const sprintTaskIds = allTasks
        .filter((t) => String(t.sprintId) === String(sprintId))
        .map((t) => t.id);
      const allSelected = sprintTaskIds.length > 0 && sprintTaskIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        sprintTaskIds.forEach((id) => next.delete(id));
      } else {
        sprintTaskIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allTasks]);

  // Sprint expand / collapse
  const handleToggleSprintExpand = useCallback((sprintId) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === String(sprintId) ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  }, []);

  // Task inline updates
  const handleUpdateTaskStatus = useCallback(async (taskId, newStatus) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, status: newStatus } : t))
    );
    try {
      await allSprintsApi.updateTask(taskId, { status: newStatus });
      showToast(`Status updated to "${newStatus}"`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update status error:', err);
      showToast('Failed to update status on server', 'error');
    }
  }, [showToast]);

  const handleUpdateTaskType = useCallback(async (taskId, newType) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, type: newType } : t))
    );
    try {
      await allSprintsApi.updateTask(taskId, { task_type: newType });
      showToast(`Type updated to "${newType}"`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update type error:', err);
      showToast('Failed to update type on server', 'error');
    }
  }, [showToast]);

  const handleUpdateTaskOwner = useCallback(async (taskId, newOwner) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, owner: newOwner } : t))
    );
    try {
      await allSprintsApi.updateTask(taskId, { owner: newOwner });
      showToast(`Assignee updated to "${newOwner}"`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update owner error:', err);
      showToast('Failed to update owner on server', 'error');
    }
  }, [showToast]);

  const handleUpdateTaskSP = useCallback(async (taskId, newSP) => {
    const spVal = newSP !== null && newSP !== undefined ? Number(newSP) : null;
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, sp: spVal } : t))
    );
    try {
      await allSprintsApi.updateTask(taskId, { estimated_sp: spVal });
      showToast(`Story points updated to ${spVal} SP`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update SP error:', err);
      showToast('Failed to update SP on server', 'error');
    }
  }, [showToast]);

  const handleUpdateTaskEpic = useCallback(async (taskId, newEpic) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, epic: newEpic } : t))
    );
    try {
      await allSprintsApi.updateTask(taskId, { epic: newEpic });
      showToast(`Epic updated to "${newEpic}"`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update epic error:', err);
      showToast('Failed to update epic on server', 'error');
    }
  }, [showToast]);

  const handleMoveTask = useCallback(async (taskId, targetSprintId) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === String(taskId) ? { ...t, sprintId: String(targetSprintId) } : t))
    );
    try {
      await allSprintsApi.moveTask(taskId, targetSprintId);
      showToast('Task moved successfully', 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Move task error:', err);
      showToast('Failed to move task on server', 'error');
    }
  }, [showToast]);

  const handleDeleteTask = useCallback(async (taskId) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== String(taskId)));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    try {
      await allSprintsApi.deleteTask(taskId);
      showToast('Task deleted successfully', 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Delete task error:', err);
      showToast('Failed to delete task on server', 'error');
    }
  }, [showToast]);

  const handleRemoveEpic = useCallback(async (taskId) => {
    handleUpdateTaskEpic(taskId, '');
  }, [handleUpdateTaskEpic]);

  // Sprint operations
  const handleCreateSprint = useCallback(async () => {
    try {
      const nextNum = sprints.length + 1;
      const newSprint = await allSprintsApi.createSprint({
        name: `Sprint ${nextNum}`,
        dates: 'Add Sprint dates',
        goals: '',
        capacity: 20,
        status: 'future',
      });
      setSprints((prev) => [...prev, newSprint]);
      showToast(`Created Sprint ${nextNum}`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Create sprint error:', err);
      showToast('Failed to create sprint', 'error');
    }
  }, [sprints.length, showToast]);

  const handleSaveSprintDates = useCallback(async (sprintId, datesText) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === String(sprintId) ? { ...s, dates: datesText, duration_text: datesText } : s))
    );
    try {
      await allSprintsApi.updateSprintDates(sprintId, datesText);
      showToast('Sprint dates updated', 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update dates error:', err);
      showToast('Failed to save sprint dates', 'error');
    }
  }, [showToast]);

  const handleSaveCapacity = useCallback(async (sprintId, capacityLimit) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === String(sprintId) ? { ...s, capacity: capacityLimit, capacity_limit: capacityLimit } : s))
    );
    try {
      await allSprintsApi.updateSprintCapacity(sprintId, capacityLimit);
      showToast(`Capacity limit set to ${capacityLimit} SP`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Update capacity error:', err);
      showToast('Failed to save capacity limit', 'error');
    }
  }, [showToast]);

  const handleStartSprint = useCallback(async (sprintId, config) => {
    try {
      const updated = await allSprintsApi.startSprint(sprintId, config);
      setSprints((prev) =>
        prev.map((s) => (s.id === String(sprintId) ? updated : s))
      );
      showToast(`Started ${updated.name}`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Start sprint error:', err);
      showToast('Failed to start sprint', 'error');
    }
  }, [showToast]);

  const handleCompleteSprint = useCallback(async (sprintId, config) => {
    try {
      const updated = await allSprintsApi.completeSprint(sprintId, config);
      setSprints((prev) =>
        prev.map((s) => (s.id === String(sprintId) ? updated : s))
      );
      showToast(`Completed sprint`, 'success');
    } catch (err) {
      console.warn('[AllSprintsPage] Complete sprint error:', err);
      showToast('Failed to complete sprint', 'error');
    }
  }, [showToast]);

  // Target task helper for modals
  const activeTask = useMemo(() => {
    if (!activeTaskTarget) return null;
    if (typeof activeTaskTarget === 'string') {
      return allTasks.find((t) => t.id === activeTaskTarget) || null;
    }
    return activeTaskTarget;
  }, [activeTaskTarget, allTasks]);

  return (
    <main className="all-sprints-page-wrapper">
      {/* Toast notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main All Sprints View */}
      <AllSprints
        sprints={sprints}
        allTasks={allTasks}
        processedTasks={allTasks}
        selectedTaskIds={selectedTaskIds}
        statusConfig={STATUS_CONFIG}
        typeConfig={TYPE_CONFIG}
        onToggleTask={handleToggleTask}
        onToggleAllSprint={handleToggleAllSprint}
        onToggleSprintExpand={handleToggleSprintExpand}
        onOpenModal={handleOpenModal}
        onOpenComments={(task, e) => handleOpenModal('comments', task, e)}
        onOpenOwnerPicker={(task, e) => handleOpenModal('ownerPicker', task, e)}
        onOpenStatusPicker={(task, e) => handleOpenModal('statusPicker', task, e)}
        onOpenTypePicker={(task, e) => handleOpenModal('typePicker', task, e)}
        onOpenSPPicker={(task, e) => handleOpenModal('spPicker', task, e)}
        onOpenEpicPicker={(task, e) => handleOpenModal('epicPicker', task, e)}
        onMoveTask={handleMoveTask}
        onDeleteTask={handleDeleteTask}
        onRemoveEpic={handleRemoveEpic}
        onCreateSprint={handleCreateSprint}
        showToast={showToast}
        onGoToBacklog={() => navigate('/work/backlog')}
      />

      {/* Backlog Modals */}
      <BacklogModals
        activeModal={activeModal}
        onClose={handleCloseModal}
        activeTaskTarget={activeTask}
        anchorRect={anchorRect}
        sprints={sprints}
        allTasks={allTasks}
        projectKey={projectKey}
        currentUser={currentUser}
        rolePermissions={rolePermissions}
        statusConfig={STATUS_CONFIG}
        typeConfig={TYPE_CONFIG}
        onStatusChange={handleUpdateTaskStatus}
        onTypeChange={handleUpdateTaskType}
        onOwnerChange={handleUpdateTaskOwner}
        onSPChange={handleUpdateTaskSP}
        onEpicChange={handleUpdateTaskEpic}
        onUpdateSprintDates={handleSaveSprintDates}
        onStartSprint={handleStartSprint}
        onCompleteSprint={handleCompleteSprint}
        onCreateSprint={handleCreateSprint}
        onMoveTask={handleMoveTask}
        onDeleteTask={handleDeleteTask}
        navigate={navigate}
        showToast={showToast}
      />
    </main>
  );
};

export default AllSprintsPage;
