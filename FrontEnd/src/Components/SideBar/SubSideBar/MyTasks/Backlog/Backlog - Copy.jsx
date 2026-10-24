import { useState, useMemo, useCallback, useDeferredValue, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshIcon,
  LinkIcon,
  MoreIcon,
  SearchIcon,
  UserOutlineIcon,
  FilterFunnelIcon,
  SortIcon,
  InfoCircleIcon,
  SparklePlusIcon,
  PlayIcon,
  CloseIcon,
  CheckIcon,
} from './BacklogIcons';
import TaskRow from './TaskRow';
import {
  STATUS_CONFIG,
  TYPE_CONFIG,
  TEAM_MEMBERS,
  parseTaskId,
  getNextJiraTaskId,
  isPastDate,
  isTaskPastDueAndIncomplete,
} from './TaskRowUtils';
import BacklogBatchBar from './BacklogBatchBar';
import KanbanBoard from '../Kanban/KanbanBoard';
import {
  sprintApi,
  taskApi,
  projectKeyApi,
  DEFAULT_PROJECT_KEY,
  getStoredTasks,
  getStoredSprints,
  getStoredProjectKey,
} from './backlogApi';
import './Backlog.css';

const BacklogModals = lazy(() => import('./BacklogModals'));
const ActiveSprint = lazy(() => import('../ActiveSprint/ActiveSprint'));
const AllSprints = lazy(() => import('../AllSprints/AllSprints'));

const BOARD_MEMBERS_STORAGE_KEY = 'nexus-board-members';
const INVITATIONS_STORAGE_KEY = 'nexus-invitations';

const getTaskCreationErrorMessage = (error) => {
  const responseData = error.response?.data;
  if (responseData && typeof responseData === 'object') {
    const details = Object.entries(responseData)
      .map(([field, value]) => {
        const message = Array.isArray(value) ? value.join(', ') : String(value);
        return `${field}: ${message}`;
      })
      .join('; ');
    if (details) return details;
  }
  return error.message || 'Please try again.';
};

const getBoardPeople = () => {
  try {
    const storedPeople = [BOARD_MEMBERS_STORAGE_KEY, INVITATIONS_STORAGE_KEY]
      .flatMap((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return [];

        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
          console.warn(`[MyTasks] Ignoring invalid people data in ${key}.`);
          return [];
        } catch (error) {
          console.warn(`[MyTasks] Ignoring malformed people data in ${key}.`, error);
          return [];
        }
      })
      .filter((person) => person && typeof person.name === 'string' && person.name.trim());

    const uniquePeople = new Map();
    storedPeople.forEach((person) => {
      const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : '';
      const id = person.id ?? (email || person.name.trim().toLowerCase());
      const key = email || String(id);
      if (!uniquePeople.has(key)) {
        uniquePeople.set(key, {
          ...person,
          id: String(id),
          name: person.name.trim(),
          email,
          initial: person.initial || person.avatar || person.name.trim()[0].toUpperCase(),
          avatarBg: person.avatarBg || '#6366f1',
        });
      }
    });

    return { members: Array.from(uniquePeople.values()), error: null };
  } catch (error) {
    console.error('[MyTasks] Unable to load board people.', error);
    return { members: [], error };
  }
};

const Backlog = ({ defaultTab = 'Backlog', rolePermissions, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromLocation = (pathname, fallback) => {
    if (pathname === '/work/all-sprints' || pathname === '/all-sprints') return 'All Sprints';
    if (pathname === '/work/active-sprint' || pathname === '/active-sprint') return 'Active Sprint';
    if (pathname === '/work/backlog' || pathname === '/backlog') return 'Backlog';
    if (pathname === '/work/tasks' || pathname === '/tasks') return 'Kanban';
    return fallback || 'Backlog';
  };

  // Active board view tab
  const [activeTab, setActiveTab] = useState(() => getTabFromLocation(location.pathname, defaultTab));

  useEffect(() => {
    const matchedTab = getTabFromLocation(location.pathname, defaultTab);
    setActiveTab(matchedTab);
  }, [location.pathname, defaultTab]);
  const [boardTabs, setBoardTabs] = useState(['Backlog', 'Kanban', 'Active Sprint', 'All Sprints']);

  // Accordion state
  const [isBacklogExpanded, setIsBacklogExpanded] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Bulk / Batch task selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  // SPRINTS: Pure in-memory React state (populated from API database only)
  const [sprints, setSprints] = useState(() => getStoredSprints() || []);

  // PROJECT KEY: Managed via API database (default LUX)
  const [projectKey, setProjectKey] = useState(() => getStoredProjectKey() || DEFAULT_PROJECT_KEY);

  // Loading state
  const [isLoading, setIsLoading] = useState(() => (getStoredTasks() || []).length === 0);

  
  const [selectedPersonFilter, setSelectedPersonFilter] = useState('all');
  const [personFilterMembers, setPersonFilterMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState(null); // 'title-asc' | 'id-asc' | 'sp-desc' | 'status'
  const [groupBy, setGroupBy] = useState('sprint');

  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
  }, []);
  const requirePermission = useCallback((allowed, message) => {
    if (allowed) return true;
    showToast(message, 'error');
    return false;
  }, [showToast]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);


  const [statusConfig, setStatusConfig] = useState({
    'In Progress': { bg: '#ffab40', text: '#202124' },
    'Ready to start': { bg: '#0073ea', text: '#ffffff' },
    'In Review': { bg: '#a25ddc', text: '#ffffff' },
    'Done': { bg: '#00c875', text: '#ffffff' },
  });

  const [typeConfig, setTypeConfig] = useState({
    'Frontend': { bg: '#579bfc', text: '#ffffff' },
    'Backend': { bg: '#784bd1', text: '#ffffff' },
    'Feature': { bg: '#20d997', text: '#202124' },
    'Bug': { bg: '#e2445c', text: '#ffffff' },
    'Quality': { bg: '#f783ac', text: '#202124' },
  });

  const handleUpdateStatusColor = useCallback((statusKey, newBgColor) => {
    const isLight = (hex) => {
      if (!hex || hex[0] !== '#') return false;
      let c = hex.substring(1);
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      if (isNaN(num)) return false;
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
    };

    setStatusConfig((prev) => ({
      ...prev,
      [statusKey]: {
        bg: newBgColor,
        text: isLight(newBgColor) ? '#1a1d2d' : '#ffffff',
      },
    }));
  }, []);

  const handleUpdateTypeColor = useCallback((typeKey, newBgColor) => {
    const isLight = (hex) => {
      if (!hex || hex[0] !== '#') return false;
      let c = hex.substring(1);
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      if (isNaN(num)) return false;
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
    };

    setTypeConfig((prev) => ({
      ...prev,
      [typeKey]: {
        bg: newBgColor,
        text: isLight(newBgColor) ? '#1a1d2d' : '#ffffff',
      },
    }));
  }, []);

  const handleAddNewType = useCallback((typeName, color = '#579bfc') => {
    if (!typeName || !typeName.trim()) return;
    const cleanName = typeName.trim();
    const isLight = (hex) => {
      if (!hex || hex[0] !== '#') return false;
      let c = hex.substring(1);
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      if (isNaN(num)) return false;
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
    };

    setTypeConfig((prev) => {
      if (prev[cleanName]) return prev;
      return {
        ...prev,
        [cleanName]: {
          bg: color,
          text: isLight(color) ? '#1a1d2d' : '#ffffff',
        },
      };
    });
    showToast(`Type "${cleanName}" added`, 'success');
  }, [showToast]);

  
  const [activeModal, setActiveModal] = useState(null);
  const [activeTaskTarget, setActiveTaskTarget] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);

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

  const handleOpenPersonFilter = useCallback((event) => {
    if (activeTab === 'Kanban') {
      const result = getBoardPeople();
      setPersonFilterMembers(result.members);
      if (result.error) {
        showToast('Unable to load board people from browser storage', 'error');
      }
      if (
        selectedPersonFilter !== 'all' &&
        !result.members.some((person) => String(person.id) === String(selectedPersonFilter))
      ) {
        setSelectedPersonFilter('all');
      }
    }
    handleOpenModal('personFilter', null, event);
  }, [activeTab, handleOpenModal, selectedPersonFilter, showToast]);

  const activePersonFilterMembers = activeTab === 'Kanban' ? personFilterMembers : TEAM_MEMBERS;
  const personFilterTitle = activeTab === 'Kanban' ? 'People invited to this board' : 'Filter by Person';

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
    setActiveTaskTarget(null);
    setAnchorRect(null);
  }, []);


  // ALL TASKS: Pure in-memory React state (populated from API database only - NO browser storage)
  const [allTasks, setAllTasks] = useState(() => getStoredTasks() || []);
  // Role-based admin restrictions removed: open access to all tasks and board capabilities
  const canManageTasks = rolePermissions ? rolePermissions.manage_tasks !== false : true;
  const canManageTeam = rolePermissions ? rolePermissions.manage_team !== false : true;
  const canManageSprints = rolePermissions ? rolePermissions.manage_sprints !== false : true;
  const canManageBoard = rolePermissions ? rolePermissions.manage_board !== false : true;
  const canEditTask = useCallback((_taskId) => true, []);

  /**
   * Load all tasks, sprints and configuration from backend API database
   */
  const loadApiData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [apiSprints, apiTasks, apiKey] = await Promise.allSettled([
        sprintApi.getAll(),
        taskApi.getAll(),
        projectKeyApi.get(),
      ]);

      if (apiSprints.status === 'fulfilled' && Array.isArray(apiSprints.value)) {
        setSprints(apiSprints.value);
      }
      if (apiTasks.status === 'fulfilled' && Array.isArray(apiTasks.value)) {
        setAllTasks(
          apiTasks.value.map((t) => {
            let item = t.status === 'Stuck' ? { ...t, status: 'Ready to start' } : t;
            if (item.type === 'Task') {
              item = { ...item, type: 'Frontend' };
            }
            return item;
          })
        );
      }
      if (apiKey.status === 'fulfilled' && apiKey.value && apiKey.value !== 'TMYT') {
        setProjectKey(apiKey.value);
      }

      const isLive = apiSprints.status === 'fulfilled' || apiTasks.status === 'fulfilled';
      setApiStatus({
        isConnected: Boolean(isLive),
        isPreparing: !isLive,
        message: isLive
          ? 'Connected to Backlog API database'
          : 'Backlog API is under preparation on backend. Frontend ready for database integration.',
        lastChecked: new Date(),
      });
    } catch (err) {
      console.info('[Backlog] Backend API preparing phase notice:', err?.message);
      setApiStatus({
        isConnected: false,
        isPreparing: true,
        message: 'Backend endpoint /api/backlog is in preparation phase.',
        lastChecked: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    const initData = async () => {
      try {
        const [apiSprints, apiTasks, apiKey] = await Promise.allSettled([
          sprintApi.getAll(),
          taskApi.getAll(),
          projectKeyApi.get(),
        ]);

        if (!isSubscribed) return;

        if (apiSprints.status === 'fulfilled' && Array.isArray(apiSprints.value)) {
          setSprints(apiSprints.value);
        }
        if (apiTasks.status === 'fulfilled' && Array.isArray(apiTasks.value)) {
          setAllTasks(
            apiTasks.value.map((t) => {
              let item = t.status === 'Stuck' ? { ...t, status: 'Ready to start' } : t;
              if (item.type === 'Task') {
                item = { ...item, type: 'Frontend' };
              }
              if (isTaskPastDueAndIncomplete(item)) {
                item = { ...item, sprintId: 'backlog' };
              }
              return item;
            })
          );
        }
        if (apiKey.status === 'fulfilled' && apiKey.value && apiKey.value !== 'TMYT') {
          setProjectKey(apiKey.value);
        }
      } catch (err) {
        console.info('[Backlog] API database load notice:', err?.message);
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    initData();
    return () => {
      isSubscribed = false;
    };
  }, []);

  useEffect(() => {
    const handleTasksChanged = (e) => {
      if (Array.isArray(e.detail)) {
        setAllTasks(e.detail);
      }
    };
    const handleSprintsChanged = (e) => {
      if (Array.isArray(e.detail)) {
        setSprints(e.detail);
      }
    };
    const handleKeyChanged = (e) => {
      if (e.detail) {
        setProjectKey(e.detail);
      }
    };
    window.addEventListener('nexus:backlog-tasks-changed', handleTasksChanged);
    window.addEventListener('nexus:backlog-sprints-changed', handleSprintsChanged);
    window.addEventListener('nexus:project-key-changed', handleKeyChanged);
    return () => {
      window.removeEventListener('nexus:backlog-tasks-changed', handleTasksChanged);
      window.removeEventListener('nexus:backlog-sprints-changed', handleSprintsChanged);
      window.removeEventListener('nexus:project-key-changed', handleKeyChanged);
    };
  }, []);

  const [automations, setAutomations] = useState([
    { id: 1, name: 'When status moves to Done -> Notify team in Slack', enabled: true },
    { id: 2, name: 'When issue is created -> Assign sequential task ID (LUX-xxx)', enabled: true },
    { id: 3, name: 'When sprint begins -> Post daily standup announcement', enabled: false },
  ]);

  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseModal]);

  
  const processTasks = useCallback((taskList) => {
    let result = [...taskList];

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q) ||
          (t.epic && t.epic.toLowerCase().includes(q))
      );
    }

    if (selectedPersonFilter !== 'all') {
      result = result.filter((t) => t.owner === selectedPersonFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((t) => t.type === typeFilter);
    }

    if (sortBy === 'title-asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'id-asc') {
      result.sort((a, b) => a.taskId.localeCompare(b.taskId));
    } else if (sortBy === 'sp-desc') {
      result.sort((a, b) => (Number(b.sp) || 0) - (Number(a.sp) || 0));
    } else if (sortBy === 'status') {
      result.sort((a, b) => a.status.localeCompare(b.status));
    }

    return result;
  }, [deferredSearchQuery, selectedPersonFilter, statusFilter, typeFilter, sortBy]);

  const processedTasks = useMemo(() => processTasks(allTasks), [processTasks, allTasks]);

  const backlogTasks = useMemo(
    () => processedTasks.filter((t) => !t.sprintId || t.sprintId === 'backlog' || isTaskPastDueAndIncomplete(t)),
    [processedTasks]
  );

  const backlogSPSum = useMemo(() => {
    return backlogTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);
  }, [backlogTasks]);

  const sprint1Tasks = useMemo(
    () => (sprints[0]?.id ? processedTasks.filter((t) => String(t.sprintId || '') === String(sprints[0].id || '') && !isTaskPastDueAndIncomplete(t)) : []),
    [processedTasks, sprints]
  );

  const sprint1SPSum = useMemo(() => {
    return sprint1Tasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);
  }, [sprint1Tasks]);

  const sprint1Dates = sprints[0]?.dates || 'Add Sprint dates';
  const isSprint1Started = sprints[0]?.isStarted || false;

  // Status stats (Sprint 1)
  const sprint1StatusStats = useMemo(() => {
    const total = sprint1Tasks.length;
    if (total === 0) return [];
    const counts = {};
    sprint1Tasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      pct: (count / total) * 100,
      color: statusConfig[status]?.bg || STATUS_CONFIG[status]?.bg || '#8085a6',
    }));
  }, [sprint1Tasks, statusConfig]);

  
  const backlogStatusStats = useMemo(() => {
    const total = backlogTasks.length;
    if (total === 0) return [];
    const counts = {};
    backlogTasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      pct: (count / total) * 100,
      color: statusConfig[status]?.bg || STATUS_CONFIG[status]?.bg || '#8085a6',
    }));
  }, [backlogTasks, statusConfig]);


  const backlogTypeStats = useMemo(() => {
    const total = backlogTasks.length;
    if (total === 0) return [];
    const counts = {};
    backlogTasks.forEach((t) => {
      counts[t.type] = (counts[t.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      pct: (count / total) * 100,
      color: typeConfig[type]?.bg || TYPE_CONFIG[type]?.bg || '#8085a6',
    }));
  }, [backlogTasks, typeConfig]);

 
  const handleToggleTask = useCallback((id) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAllSprint = useCallback((sprintId) => {
    const targetTasks = allTasks.filter((t) => String(t.sprintId || '') === String(sprintId || ''));
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

  const handleToggleAllBacklog = useCallback(() => {
    const targetTasks = allTasks.filter((t) => !t.sprintId || t.sprintId === 'backlog');
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

 
  const handleMoveTask = useCallback(async (taskId, targetSprint) => {
    if (!requirePermission(canManageTasks || canManageSprints, 'You do not have permission to move tasks between sprints.')) return;
    setAllTasks((prev) =>
      prev.map((t) => (String(t.id) === String(taskId) ? { ...t, sprintId: String(targetSprint) } : t))
    );
    const targetSprintObj = sprints.find((s) => String(s.id) === String(targetSprint));
    const targetName = targetSprint === 'backlog' ? 'Backlog' : (targetSprintObj?.name || 'Sprint');
    showToast(`Task moved to ${targetName}`, 'info');
    await taskApi.move(taskId, { sprintId: targetSprint });
  }, [canManageSprints, canManageTasks, requirePermission, sprints, showToast]);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (!requirePermission(canManageTasks, 'You do not have permission to delete tasks.')) return;
    setAllTasks((prev) => prev.filter((t) => String(t.id) !== String(taskId)));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    showToast('Task deleted successfully', 'info');
    await taskApi.delete(taskId);
  }, [canManageTasks, requirePermission, showToast]);

  const handleCreateTaskFromModal = useCallback(async (taskInput, { showSuccessToast = true } = {}) => {
    const {
      title,
      type,
      sp,
      status,
      dueDate,
    } = taskInput;
    const sprint = taskInput.sprint ?? taskInput.sprintId;
    const customTaskId = taskInput.customTaskId ?? taskInput.taskId;
    if (!requirePermission(canManageTasks, 'You do not have permission to create tasks.')) return false;
    let finalTaskId = customTaskId ? customTaskId.trim().toUpperCase() : '';
    if (!finalTaskId) {
      finalTaskId = getNextJiraTaskId(allTasks, projectKey).taskId;
    } else {
      const parsed = parseTaskId(finalTaskId);
      if (parsed?.prefix && parsed.prefix !== projectKey) {
        setProjectKey(parsed.prefix);
        projectKeyApi.set(parsed.prefix);
        showToast(`Project key set to "${parsed.prefix}". Next tasks will automatically continue ${parsed.prefix}-xxx`, 'info');
      }

      const isTaken = allTasks.some((t) => t.taskId && t.taskId.trim().toUpperCase() === finalTaskId);
      if (isTaken) {
        showToast(`Task ID "${finalTaskId}" is already in use. Auto-continued next available ID.`, 'warning');
        finalTaskId = getNextJiraTaskId(allTasks, parsed?.prefix || projectKey).taskId;
      }
    }

    const isPastIncomplete = isTaskPastDueAndIncomplete({ dueDate, status });
    const targetSprintId = isPastIncomplete ? 'backlog' : (sprint || 'backlog');

    const newTask = {
      id: `task-${Date.now()}`,
      title,
      owner: 'siva',
      status: status || 'Ready to start',
      type: type || 'Frontend',
      taskId: finalTaskId,
      sp: sp ?? null,
      epic: '',
      githubLink: '',
      comments: [],
      sprintId: targetSprintId,
      dueDate: dueDate || '',
    };
    setAllTasks((prev) => [...prev, newTask]);
    try {
      const createdTask = await taskApi.create(newTask);
      setAllTasks((prev) => prev.map((task) => (
        task.id === newTask.id ? { ...task, ...createdTask } : task
      )));
      const sprintObj = sprints.find((s) => String(s.id) === String(targetSprintId));
      if (showSuccessToast) {
        if (isPastIncomplete && sprint && sprint !== 'backlog') {
          showToast(`Task ${finalTaskId} has a past due date and was placed in Backlog`, 'info');
        } else {
          showToast(`Task ${finalTaskId} added to ${sprintObj ? sprintObj.name : 'Backlog'}!`, 'success');
        }
      }
      return true;
    } catch (error) {
      setAllTasks((prev) => prev.filter((task) => task.id !== newTask.id));
      const message = getTaskCreationErrorMessage(error);
      showToast(`Unable to create task: ${message}`, 'error');
      return false;
    }
  }, [allTasks, canManageTasks, projectKey, requirePermission, sprints, showToast]);

  
  const handleUpdateProjectKey = useCallback((newKey) => {
    if (!requirePermission(canManageBoard, 'You do not have permission to change board settings.')) return;
    const clean = (newKey || '').trim().toUpperCase();
    if (!clean) {
      showToast('Project Key cannot be empty', 'error');
      return;
    }
    setProjectKey(clean);
    projectKeyApi.set(clean);
    showToast(`Project Key updated to "${clean}". Next tasks will continue automatically like Jira.`, 'success');
  }, [canManageBoard, requirePermission, showToast]);

  const handleUpdateTaskId = useCallback((taskId, newCustomTaskId) => {
    if (!requirePermission(canManageTasks, 'You do not have permission to change task identifiers.')) return false;
    const trimmedId = (newCustomTaskId || '').trim().toUpperCase();
    if (!trimmedId) {
      showToast('Task ID cannot be empty', 'error');
      return false;
    }
    const isTaken = allTasks.some((t) => t.id !== taskId && t.taskId?.trim().toUpperCase() === trimmedId);
    if (isTaken) {
      showToast(`Task ID "${trimmedId}" is already taken by another task! Unique ID required.`, 'error');
      return false;
    }

    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, taskId: trimmedId } : t))
    );
    taskApi.update(taskId, { taskId: trimmedId });
    setActiveTaskTarget((prev) => (prev && prev.id === taskId ? { ...prev, taskId: trimmedId } : prev));
    showToast(`Task ID updated to ${trimmedId} successfully!`, 'success');
    return true;
  }, [allTasks, canManageTasks, requirePermission, showToast]);


  const handleCreateSprint = useCallback(async ({ name, goal, dates }) => {
    if (!requirePermission(canManageSprints, 'You do not have permission to create sprints.')) return;
    const sprintNum = sprints.length + 1;
    const newName = name?.trim() || `Sprint ${sprintNum}`;
    const newSprint = {
      id: `sprint-${Date.now()}`,
      name: newName,
      goal: goal?.trim() || '',
      dates: dates?.trim() || 'Add Sprint dates',
      isStarted: false,
      isExpanded: true,
    };
    setSprints((prev) => [...prev, newSprint]);
    setActiveModal(null);
    showToast(`${newName} created successfully! 🚀 (API Dispatched)`, 'success');
    const createdSprint = await sprintApi.create(newSprint);
    if (createdSprint.id !== newSprint.id) {
      setSprints((prev) =>
        prev.map((sprint) => sprint.id === newSprint.id ? { ...sprint, ...createdSprint } : sprint)
      );
    }
  }, [canManageSprints, requirePermission, sprints.length, showToast]);

  const handleUpdateSprintDates = useCallback(async (sprintId, newDates) => {
    if (!requirePermission(canManageSprints, 'You do not have permission to update sprints.')) return;
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, dates: newDates } : s))
    );
    setActiveModal(null);
    showToast(`Sprint timeline updated to "${newDates}"`, 'success');
    await sprintApi.update(sprintId, { dates: newDates });
  }, [canManageSprints, requirePermission, showToast]);

  const handleToggleSprintExpand = useCallback((sprintId) => {
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  }, []);

  const handleDeleteSprint = useCallback(async (sprintId) => {
    if (!requirePermission(canManageSprints, 'You do not have permission to delete sprints.')) return;
    const sprintObj = sprints.find((s) => s.id === sprintId);
    setAllTasks((prev) =>
      prev.map((t) => (t.sprintId === sprintId ? { ...t, sprintId: 'backlog' } : t))
    );
    setSprints((prev) => prev.filter((s) => s.id !== sprintId));
    setActiveModal(null);
    showToast(`${sprintObj?.name || 'Sprint'} deleted. Tasks moved to Backlog.`, 'info');
    await sprintApi.delete(sprintId);
  }, [canManageSprints, requirePermission, sprints, showToast]);

  const handleStartSprint = useCallback(async (sprintId) => {
    if (!requirePermission(canManageSprints, 'You do not have permission to start sprints.')) return;
    const targetId = sprintId || sprints[0]?.id;
    if (!targetId) return;
    setSprints((prev) =>
      prev.map((s) => (s.id === targetId ? { ...s, isStarted: true } : s))
    );
    const sprintObj = sprints.find((s) => s.id === targetId);
    setActiveModal(null);
    showToast(`${sprintObj?.name || 'Sprint'} started! 🚀 Tracking active burndown.`, 'success');
    await sprintApi.start(targetId);
  }, [canManageSprints, requirePermission, sprints, showToast]);

  const handleCompleteSprint = useCallback(async (sprintId) => {
    if (!requirePermission(canManageSprints, 'You do not have permission to complete sprints.')) return;
    const targetId = sprintId || sprints[0]?.id;
    if (!targetId) return;
    setSprints((prev) =>
      prev.map((s) => (s.id === targetId ? { ...s, isStarted: false } : s))
    );
    setAllTasks((prev) =>
      prev.map((t) =>
        t.sprintId === targetId && t.status !== 'Done' ? { ...t, sprintId: 'backlog' } : t
      )
    );
    const sprintObj = sprints.find((s) => s.id === targetId);
    const sprintTasksList = allTasks.filter((t) => t.sprintId === targetId);
    const completedCount = sprintTasksList.filter((t) => t.status === 'Done').length;
    setActiveModal(null);
    showToast(`${sprintObj?.name || 'Sprint'} completed! 🎉 ${completedCount} tasks delivered.`, 'success');
    await sprintApi.complete(targetId);
  }, [allTasks, canManageSprints, requirePermission, sprints, showToast]);

  const handleMoveAllToBacklog = useCallback(async (sprintId) => {
    if (!requirePermission(canManageTasks || canManageSprints, 'You do not have permission to move tasks between sprints.')) return;
    const targetId = sprintId || sprints[0]?.id;
    if (!targetId) return;
    setAllTasks((prev) =>
      prev.map((t) => (t.sprintId === targetId ? { ...t, sprintId: 'backlog' } : t))
    );
    setActiveModal(null);
    showToast('All tasks moved to Backlog', 'info');
  }, [canManageSprints, canManageTasks, requirePermission, sprints, showToast]);

  const handleStatusChange = useCallback(async (taskId, newStatus) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => {
      if (String(t.id) === String(taskId)) {
        const merged = { ...t, status: newStatus };
        if (isTaskPastDueAndIncomplete(merged)) {
          merged.sprintId = 'backlog';
        }
        return merged;
      }
      return t;
    }));
    setActiveTaskTarget((prev) => {
      if (prev && String(prev.id) === String(taskId)) {
        const merged = { ...prev, status: newStatus };
        if (isTaskPastDueAndIncomplete(merged)) {
          merged.sprintId = 'backlog';
        }
        return merged;
      }
      return prev;
    });
    setActiveModal((prev) => (prev === 'statusPicker' ? null : prev));
    showToast(`Status updated to "${newStatus}"`, 'info');
    await taskApi.update(taskId, { status: newStatus });
  }, [canEditTask, requirePermission, showToast]);

  const handleTypeChange = useCallback(async (taskId, newType) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, type: newType } : t)));
    setActiveTaskTarget((prev) => (prev && String(prev.id) === String(taskId) ? { ...prev, type: newType } : prev));
    setActiveModal((prev) => (prev === 'typePicker' ? null : prev));
    showToast(`Type changed to "${newType}"`, 'info');
    await taskApi.update(taskId, { type: newType });
  }, [canEditTask, requirePermission, showToast]);

  const handleOwnerChange = useCallback(async (taskId, newOwner) => {
    if (!requirePermission(canManageTasks, 'You do not have permission to reassign tasks.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, owner: newOwner } : t)));
    setActiveTaskTarget((prev) => (prev && String(prev.id) === String(taskId) ? { ...prev, owner: newOwner } : prev));
    setActiveModal((prev) => (prev === 'ownerPicker' ? null : prev));
    const member = TEAM_MEMBERS.find((m) => m.id === newOwner);
    showToast(`Assigned to ${member ? member.name : newOwner}`, 'info');
    await taskApi.update(taskId, { owner: newOwner });
  }, [canManageTasks, requirePermission, showToast]);

  const handleSPChange = useCallback(async (taskId, newSP) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, sp: newSP } : t)));
    setActiveTaskTarget((prev) => (prev && String(prev.id) === String(taskId) ? { ...prev, sp: newSP } : prev));
    setActiveModal((prev) => (prev === 'spPicker' ? null : prev));
    showToast(`Story Points updated to ${newSP || 0} SP`, 'info');
    await taskApi.update(taskId, { sp: newSP });
  }, [canEditTask, requirePermission, showToast]);

  const handleEpicChange = useCallback(async (taskId, newEpic) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, epic: newEpic } : t)));
    setActiveTaskTarget((prev) => (prev && String(prev.id) === String(taskId) ? { ...prev, epic: newEpic } : prev));
    setActiveModal((prev) => (prev === 'epicPicker' ? null : prev));
    showToast(newEpic ? `Epic set to "${newEpic}"` : 'Epic removed', 'info');
    await taskApi.update(taskId, { epic: newEpic });
  }, [canEditTask, requirePermission, showToast]);

  const handleRemoveEpic = useCallback(async (taskId) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, epic: '' } : t)));
    setActiveTaskTarget((prev) => (prev && String(prev.id) === String(taskId) ? { ...prev, epic: '' } : prev));
    showToast('Epic removed', 'info');
    await taskApi.update(taskId, { epic: '' });
  }, [canEditTask, requirePermission, showToast]);

  const handleGithubLink = useCallback(async (taskId, branch) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    setAllTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, githubLink: branch } : t)));
    setActiveModal(null);
    showToast(`Linked to GitHub branch ${branch}`, 'success');
    await taskApi.update(taskId, { githubLink: branch });
  }, [canEditTask, requirePermission, showToast]);

  const handleSelectBoardView = useCallback(
    (viewLabel) => {
      setActiveModal(null);
      setBoardTabs((prev) => {
        if (!prev.includes(viewLabel)) {
          return [...prev, viewLabel];
        }
        return prev;
      });
      setActiveTab(viewLabel);
      if (viewLabel === 'Kanban') {
        navigate('/work/tasks', { replace: true });
      } else if (viewLabel === 'Backlog') {
        navigate('/work/backlog', { replace: true });
      } else if (viewLabel === 'Active Sprint') {
        navigate('/work/active-sprint', { replace: true });
      } else if (viewLabel === 'All Sprints') {
        navigate('/work/all-sprints', { replace: true });
      }
      showToast(`Switched to "${viewLabel}" view`, 'success');
    },
    [navigate, showToast]
  );

  const handlePostComment = useCallback(async (taskId, text, authorName = 'Sivakumar') => {
    if (!requirePermission(canEditTask(taskId), 'You can only comment on tasks assigned to you.')) return;
    const member = TEAM_MEMBERS.find((m) => m.name === authorName) || {
      name: authorName || 'Sivakumar',
      role: 'Developer',
      avatarBg: '#0052cc',
      initial: (authorName || 'S')[0],
    };

    const newComment = {
      id: Date.now(),
      author: member.name,
      role: member.role || 'Developer',
      avatarBg: member.avatarBg || '#0052cc',
      initial: member.initial || member.name[0],
      text,
      time: 'Just now',
      likes: 0,
      isLiked: false,
    };

    setAllTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments || []), newComment] } : t
      );
      return updated;
    });

    setActiveTaskTarget((prev) =>
      prev && prev.id === taskId ? { ...prev, comments: [...(prev.comments || []), newComment] } : prev
    );
    showToast('Developer comment posted! (API Dispatched)', 'success');
    await taskApi.addComment(taskId, newComment);
  }, [canEditTask, requirePermission, showToast]);

  const handleToggleCommentLike = useCallback((taskId, commentId) => {
    if (!requirePermission(canEditTask(taskId), 'You can only react to comments on tasks assigned to you.')) return;
    setAllTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== taskId) return t;
        const newComments = (t.comments || []).map((c) => {
          if (c.id !== commentId) return c;
          const isLiked = !c.isLiked;
          return {
            ...c,
            isLiked,
            likes: Math.max(0, (c.likes || 0) + (isLiked ? 1 : -1)),
          };
        });
        return { ...t, comments: newComments };
      });
      return updated;
    });

    setActiveTaskTarget((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      const newComments = (prev.comments || []).map((c) => {
        if (c.id !== commentId) return c;
        const isLiked = !c.isLiked;
        return {
          ...c,
          isLiked,
          likes: Math.max(0, (c.likes || 0) + (isLiked ? 1 : -1)),
        };
      });
      return { ...prev, comments: newComments };
    });
  }, [canEditTask, requirePermission]);

  const handleDeleteComment = useCallback(async (taskId, commentId) => {
    if (!requirePermission(canEditTask(taskId), 'You can only remove comments from tasks assigned to you.')) return;
    setAllTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== taskId) return t;
        return { ...t, comments: (t.comments || []).filter((c) => c.id !== commentId) };
      });
      return updated;
    });

    setActiveTaskTarget((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      return { ...prev, comments: (prev.comments || []).filter((c) => c.id !== commentId) };
    });
    showToast('Comment removed', 'info');
    await taskApi.deleteComment(taskId, commentId);
  }, [canEditTask, requirePermission, showToast]);

  const handleUpdateTaskDetails = useCallback(async (taskId, updates) => {
    if (!requirePermission(canEditTask(taskId), 'You can only update tasks assigned to you.')) return;
    let finalUpdates = { ...updates };
    setAllTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) {
          const merged = { ...t, ...updates };
          if (isTaskPastDueAndIncomplete(merged)) {
            merged.sprintId = 'backlog';
            finalUpdates.sprintId = 'backlog';
          }
          return merged;
        }
        return t;
      });
      return updated;
    });
    setActiveTaskTarget((prev) => {
      if (prev && prev.id === taskId) {
        const merged = { ...prev, ...updates };
        if (isTaskPastDueAndIncomplete(merged)) {
          merged.sprintId = 'backlog';
        }
        return merged;
      }
      return prev;
    });
    await taskApi.update(taskId, finalUpdates);
  }, [canEditTask, requirePermission]);

 
  const handleOpenComments = useCallback((task) => {
    handleOpenModal('taskComments', task, null);
  }, [handleOpenModal]);

  const handleOpenOwnerPicker = useCallback((task, e) => {
    if (!requirePermission(canManageTasks, 'You do not have permission to reassign tasks.')) return;
    handleOpenModal('ownerPicker', task, e);
  }, [canManageTasks, handleOpenModal, requirePermission]);

  const handleOpenStatusPicker = useCallback((task, e) => {
    if (!requirePermission(canEditTask(task.id), 'You can only update tasks assigned to you.')) return;
    handleOpenModal('statusPicker', task, e);
  }, [canEditTask, handleOpenModal, requirePermission]);

  const handleOpenTypePicker = useCallback((task, e) => {
    if (!requirePermission(canEditTask(task.id), 'You can only update tasks assigned to you.')) return;
    handleOpenModal('typePicker', task, e);
  }, [canEditTask, handleOpenModal, requirePermission]);

  const handleOpenSPPicker = useCallback((task, e) => {
    if (!requirePermission(canEditTask(task.id), 'You can only update tasks assigned to you.')) return;
    handleOpenModal('spPicker', task, e);
  }, [canEditTask, handleOpenModal, requirePermission]);

  const handleOpenEpicPicker = useCallback((task, e) => {
    if (!requirePermission(canEditTask(task.id), 'You can only update tasks assigned to you.')) return;
    handleOpenModal('epicPicker', task, e);
  }, [canEditTask, handleOpenModal, requirePermission]);



  const handleBatchMoveToSprint1 = useCallback(async () => {
    if (!requirePermission(canManageTasks || canManageSprints, 'You do not have permission to move tasks between sprints.')) return;
    const targetSprintId = sprints[0]?.id;
    if (!targetSprintId) {
      showToast('No sprint available to move tasks to', 'warning');
      return;
    }
    const ids = Array.from(selectedTaskIds);
    setAllTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, sprintId: targetSprintId } : t))
    );
    const count = selectedTaskIds.size;
    setSelectedTaskIds(new Set());
    showToast(`Moved ${count} tasks to ${sprints[0]?.name || 'Sprint'} (API Dispatched)`, 'success');
    await taskApi.batchUpdate(ids, { sprintId: targetSprintId });
  }, [canManageSprints, canManageTasks, requirePermission, sprints, selectedTaskIds, showToast]);

  const handleBatchMoveToBacklog = useCallback(async () => {
    if (!requirePermission(canManageTasks || canManageSprints, 'You do not have permission to move tasks between sprints.')) return;
    const ids = Array.from(selectedTaskIds);
    setAllTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, sprintId: 'backlog' } : t))
    );
    const count = selectedTaskIds.size;
    setSelectedTaskIds(new Set());
    showToast(`Moved ${count} tasks to Backlog (API Dispatched)`, 'success');
    await taskApi.batchUpdate(ids, { sprintId: 'backlog' });
  }, [canManageSprints, canManageTasks, requirePermission, selectedTaskIds, showToast]);

  const handleBatchMarkDone = useCallback(async () => {
    if (!requirePermission(Array.from(selectedTaskIds).every(canEditTask), 'You can only update tasks assigned to you.')) return;
    const ids = Array.from(selectedTaskIds);
    setAllTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, status: 'Done' } : t))
    );
    showToast(`Marked ${selectedTaskIds.size} tasks as Done (API Dispatched)`, 'success');
    setSelectedTaskIds(new Set());
    await taskApi.batchUpdate(ids, { status: 'Done' });
  }, [canEditTask, requirePermission, selectedTaskIds, showToast]);

  const handleBatchDelete = useCallback(async () => {
    if (!requirePermission(canManageTasks, 'You do not have permission to delete tasks.')) return;
    const count = selectedTaskIds.size;
    const ids = Array.from(selectedTaskIds);
    setAllTasks((prev) => prev.filter((t) => !selectedTaskIds.has(t.id)));
    setSelectedTaskIds(new Set());
    showToast(`Deleted ${count} tasks (API Dispatched)`, 'info');
    await Promise.all(ids.map((id) => taskApi.delete(id)));
  }, [canManageTasks, requirePermission, selectedTaskIds, showToast]);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const handleSelectAllTasks = useCallback(() => {
    const all = new Set(allTasks.map((t) => t.id));
    setSelectedTaskIds(all);
    setActiveModal(null);
    showToast(`Selected all ${all.size} tasks`, 'info');
  }, [allTasks, showToast]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Board link copied to clipboard! 📋', 'success');
  }, [showToast]);

  return (
    <div className="backlog-root-theme">
      {/* 1. TOP MAIN HEADER */}
      <header className="backlog-top-header">
        <div className="backlog-header-left">
          <h1 className="backlog-main-title">Tasks</h1>
        </div>

        <div className="backlog-header-right">
          <button
            type="button"
            className="backlog-header-btn"
            onClick={(e) => handleOpenModal('sprintsOverview', null, e)}
            title="View Sprint velocity, progress and roadmap"
          >
            <RefreshIcon />
            <span>Sprints overview</span>
          </button>

          <div className="backlog-invite-group">
            {canManageTeam && (
              <button
                type="button"
                className="backlog-invite-btn"
                onClick={(e) => handleOpenModal('invite', null, e)}
                title="Invite teammates to workspace"
              >
                <span>Invite</span>
              </button>
            )}
            <button
              type="button"
              className="backlog-invite-link-btn"
              title="Copy board link"
              onClick={handleCopyLink}
            >
              <LinkIcon />
            </button>
          </div>

          <button
            type="button"
            className="backlog-header-icon-btn"
            title="Board settings & export options"
            onClick={(e) => handleOpenModal('headerMenu', null, e)}
          >
            <MoreIcon />
          </button>
        </div>
      </header>

      {/* 2. TABS NAVIGATION ROW */}
      <nav className="backlog-tabs-nav" aria-label="Views">
        <div className="backlog-tabs-list">
          {boardTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`backlog-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'Kanban') {
                    navigate('/work/tasks', { replace: true });
                    showToast('Viewing Kanban Board', 'info');
                  } else if (tab === 'Backlog') {
                    navigate('/work/backlog', { replace: true });
                    showToast('Showing Backlog & Sprints', 'info');
                  } else if (tab === 'Active Sprint') {
                    navigate('/work/active-sprint', { replace: true });
                    showToast('Viewing Active Sprint only', 'info');
                  } else if (tab === 'All Sprints') {
                    navigate('/work/all-sprints', { replace: true });
                    showToast('Showing all sprints across project', 'info');
                  } else {
                    showToast(`Viewing ${tab}`, 'info');
                  }
                }}
                title={`Switch to ${tab} view`}
              >
                <span>{tab}</span>
                {tab === 'Backlog' && <span className="backlog-tab-dots"></span>}
              </button>
            );
          })}

          <button
            type="button"
            className="backlog-tab-add-btn"
            title="Add a new custom view (Table, Gantt, Chart, Calendar, etc.)"
            onClick={(e) => handleOpenModal('addView', null, e)}
          >
            +
          </button>
        </div>
      </nav>

      {/* 3. TOOLBAR ACTIONS ROW */}
      <div className="backlog-toolbar-row">
        <div className="backlog-toolbar-left">
          {activeTab === 'Kanban' ? (
            <>
              {canManageTasks && (
                <button
                  type="button"
                  className="backlog-btn-new-task"
                  onClick={() => handleOpenModal('createTask', null, null)}
                  title="Create a new task (auto-incremented ID like Jira)"
                >
                  <span>New task</span>
                </button>
              )}

              {canManageBoard && (
                <button
                  type="button"
                  className="backlog-project-key-pill"
                  onClick={(e) => handleOpenModal('projectKeySettings', null, e)}
                  title={`Admin: Project Key is ${projectKey}. Click to configure or change once.`}
                >
                  <span className="key-pill-tag">Key</span>
                  <span className="key-pill-val">{projectKey}</span>
                  <span className="key-pill-seq">Next #{getNextJiraTaskId(allTasks, projectKey).number}</span>
                </button>
              )}

              {canManageSprints && (
                <button
                  type="button"
                  className="backlog-btn-create-sprint"
                  onClick={() => handleOpenModal('createSprint', null, null)}
                  title="Plan and create a new sprint"
                >
                  <span>Create Sprint</span>
                </button>
              )}

              {/* 1. Search Box */}
              <div className="backlog-search-box">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search"
                  className="backlog-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="backlog-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <CloseIcon size={12} />
                  </button>
                )}
              </div>

              {/* 2. Person Filter */}
              <button
                type="button"
                className={`backlog-tool-btn ${selectedPersonFilter !== 'all' ? 'active' : ''}`}
                onClick={handleOpenPersonFilter}
                title="Filter tasks by assignee / person"
              >
                <UserOutlineIcon size={14} />
                <span>
                  {selectedPersonFilter === 'all'
                    ? 'Person'
                    : activePersonFilterMembers.find((m) => String(m.id) === String(selectedPersonFilter))?.name || 'Person'}
                </span>
                {selectedPersonFilter !== 'all' && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="backlog-filter-clear-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPersonFilter('all');
                    }}
                    title="Clear person filter"
                  >
                    ✕
                  </span>
                )}
              </button>

              {/* 3. Filter */}
              <button
                type="button"
                className={`backlog-tool-btn ${statusFilter !== 'all' || typeFilter !== 'all' ? 'active' : ''}`}
                onClick={(e) => handleOpenModal('filterMenu', null, e)}
                title="Filter by status, type or epic"
              >
                <FilterFunnelIcon />
                <span>
                  {(() => {
                    const count = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
                    return count > 0 ? `Filter (${count})` : 'Filter';
                  })()}
                </span>
                <ChevronDownIcon size={12} />
              </button>

              {/* 4. Sort */}
              <button
                type="button"
                className={`backlog-tool-btn ${sortBy ? 'active' : ''}`}
                onClick={(e) => handleOpenModal('sortMenu', null, e)}
                title="Sort tasks"
              >
                <SortIcon size={14} />
                <span>Sort</span>
                {sortBy && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="backlog-filter-clear-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(null);
                    }}
                    title="Clear sort"
                  >
                    ✕
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Jira Project Key & Continuous Sequence Indicator */}
              {canManageBoard && (
                <button
                  type="button"
                  className="backlog-project-key-pill"
                  onClick={(e) => handleOpenModal('projectKeySettings', null, e)}
                  title={`Admin: Project Key is ${projectKey}. Click to configure or change once.`}
                >
                  <span className="key-pill-tag">Key</span>
                  <span className="key-pill-val">{projectKey}</span>
                  <span className="key-pill-seq">Next #{getNextJiraTaskId(allTasks, projectKey).number}</span>
                </button>
              )}

              {canManageSprints && (
                <button
                  type="button"
                  className="backlog-btn-create-sprint"
                  onClick={() => handleOpenModal('createSprint', null, null)}
                  title="Plan and create a new sprint"
                >
                  <span>Create Sprint</span>
                </button>
              )}

              {/* Search Box with instant typing and clear button */}
              <div className="backlog-search-box">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search"
                  className="backlog-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="backlog-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <CloseIcon size={12} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className={`backlog-tool-btn ${selectedPersonFilter !== 'all' ? 'active' : ''}`}
                onClick={(e) => handleOpenModal('personFilter', null, e)}
                title="Filter tasks by assignee / person"
              >
                <UserOutlineIcon size={14} />
                <span>
                  {selectedPersonFilter === 'all'
                    ? 'Person'
                    : TEAM_MEMBERS.find((m) => m.id === selectedPersonFilter)?.name || 'Person'}
                </span>
                {selectedPersonFilter !== 'all' && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="backlog-filter-clear-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPersonFilter('all');
                    }}
                    title="Clear person filter"
                  >
                    ✕
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`backlog-tool-btn ${statusFilter !== 'all' || typeFilter !== 'all' ? 'active' : ''}`}
                onClick={(e) => handleOpenModal('filterMenu', null, e)}
                title="Filter by status, type or epic"
              >
                <FilterFunnelIcon />
                <span>
                  {(() => {
                    const count = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
                    return count > 0 ? `Filter / ${count}` : 'Filter';
                  })()}
                </span>
                <ChevronDownIcon size={12} />
              </button>

              <button
                type="button"
                className="backlog-tool-icon-btn"
                title="Toolbar options & quick actions"
                onClick={(e) => handleOpenModal('toolbarMore', null, e)}
              >
                <MoreIcon />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. MAIN CONTENT CONTAINER */}
      <main className="backlog-main-container">
        {isLoading && activeTab === 'Backlog' ? (
          <div className="backlog-skeleton-wrapper">
            <div className="backlog-skeleton-card">
              <div className="backlog-skeleton-header" />
              <div className="backlog-skeleton-row" />
              <div className="backlog-skeleton-row" />
              <div className="backlog-skeleton-row" />
            </div>
            <div className="backlog-skeleton-card">
              <div className="backlog-skeleton-header" />
              <div className="backlog-skeleton-row" />
              <div className="backlog-skeleton-row" />
            </div>
          </div>
        ) : activeTab === 'Kanban' ? (
          <KanbanBoard
            allTasks={allTasks}
            statusConfig={statusConfig}
            typeConfig={typeConfig}
            onUpdateTaskStatus={handleStatusChange}
            onDeleteTask={canManageTasks ? handleDeleteTask : null}
            canEditTask={canEditTask}
            onOpenModal={handleOpenModal}
            onOpenComments={handleOpenComments}
            showToast={showToast}
            searchQuery={deferredSearchQuery}
            selectedPersonFilter={selectedPersonFilter}
            personFilterMembers={personFilterMembers}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            sortBy={sortBy}
          />
        ) : activeTab === 'Active Sprint' ? (
          <Suspense fallback={<div className="backlog-skeleton-wrapper"><div className="backlog-skeleton-card"><div className="backlog-skeleton-header" /><div className="backlog-skeleton-row" /></div></div>}>
            <ActiveSprint
              sprints={sprints}
              allTasks={allTasks}
              processedTasks={processedTasks}
              selectedTaskIds={selectedTaskIds}
              statusConfig={statusConfig}
              typeConfig={typeConfig}
              onToggleTask={handleToggleTask}
              onToggleAllSprint={handleToggleAllSprint}
              onToggleSprintExpand={handleToggleSprintExpand}
              onOpenModal={handleOpenModal}
              onOpenComments={handleOpenComments}
              onOpenOwnerPicker={handleOpenOwnerPicker}
              onOpenStatusPicker={handleOpenStatusPicker}
              onOpenTypePicker={handleOpenTypePicker}
              onOpenSPPicker={handleOpenSPPicker}
              onOpenEpicPicker={handleOpenEpicPicker}
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onRemoveEpic={handleRemoveEpic}
              onUpdateTaskStatus={handleStatusChange}
              onCreateTask={handleCreateTaskFromModal}
              currentUser={currentUser}
              rolePermissions={rolePermissions}
              showToast={showToast}
              onGoToBacklog={() => {
                setActiveTab('Backlog');
                navigate('/work/backlog', { replace: true });
              }}
            />
          </Suspense>
        ) : activeTab === 'All Sprints' ? (
          <Suspense fallback={<div className="backlog-skeleton-wrapper"><div className="backlog-skeleton-card"><div className="backlog-skeleton-header" /><div className="backlog-skeleton-row" /></div></div>}>
            <AllSprints
              sprints={sprints}
              allTasks={allTasks}
              processedTasks={processedTasks}
              selectedTaskIds={selectedTaskIds}
              statusConfig={statusConfig}
              typeConfig={typeConfig}
              onToggleTask={handleToggleTask}
              onToggleAllSprint={handleToggleAllSprint}
              onToggleSprintExpand={handleToggleSprintExpand}
              onOpenModal={handleOpenModal}
              onOpenComments={handleOpenComments}
              onOpenOwnerPicker={handleOpenOwnerPicker}
              onOpenStatusPicker={handleOpenStatusPicker}
              onOpenTypePicker={handleOpenTypePicker}
              onOpenSPPicker={handleOpenSPPicker}
              onOpenEpicPicker={handleOpenEpicPicker}
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onRemoveEpic={handleRemoveEpic}
              onCreateSprint={handleCreateSprint}
              showToast={showToast}
              onGoToBacklog={() => {
                setActiveTab('Backlog');
                navigate('/work/backlog', { replace: true });
              }}
            />
          </Suspense>
        ) : (
          <>
            {/* RENDER ALL ACTIVE / PLANNED SPRINTS */}
            {sprints.map((sprint) => {
              const sprintTasks = processedTasks.filter((t) => String(t.sprintId || '') === String(sprint.id || '') && !isTaskPastDueAndIncomplete(t));
              const spSum = sprintTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0);

              
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

              return (
                <section key={sprint.id} className="backlog-group-section">
                  <div className="backlog-group-header">
                    <div
                      className="backlog-group-header-left cursor-pointer"
                      onClick={() => handleToggleSprintExpand(sprint.id)}
                    >
                      <button
                        type="button"
                        className="backlog-accordion-toggle-btn sprint-1-toggle"
                        aria-expanded={sprint.isExpanded}
                      >
                        {sprint.isExpanded ? (
                          <ChevronDownIcon size={16} />
                        ) : (
                          <ChevronRightIcon size={16} />
                        )}
                      </button>
                      <h2 className="backlog-group-title sprint-1-title">{sprint.name}</h2>
                      {sprint.isStarted && (
                        <span className="backlog-sprint-active-badge">Active</span>
                      )}
                      <span className="backlog-task-count-pill">
                        {sprintTasks.length} {sprintTasks.length === 1 ? 'issue' : 'issues'}
                      </span>
                    </div>

                    <div className="backlog-group-header-right">
                      <button
                        type="button"
                        className="backlog-header-link-btn"
                        onClick={(e) => handleOpenModal('sprintDates', sprint, e)}
                        title="Click to edit sprint dates manually"
                      >
                        {sprint.dates || 'Add Sprint dates'}
                      </button>

                      <button
                        type="button"
                        className="backlog-header-link-btn"
                        onClick={(e) => handleOpenModal('capacity', sprint, e)}
                        title="View team story points capacity"
                      >
                        Capacity
                      </button>

                      <div className="backlog-standup-wrapper">
                        <button
                          type="button"
                          className="backlog-header-link-btn active-standup"
                          onClick={() => handleOpenModal('dailyStandup', sprint, null)}
                          title="Open daily standup logs & updates"
                        >
                          Daily standup
                        </button>
                        <div className="backlog-standup-indicator" />
                      </div>

                      {!sprint.isStarted ? (
                        <button
                          type="button"
                          className="backlog-btn-start-sprint"
                          onClick={() => handleOpenModal('startSprint', sprint, null)}
                          title={`Start ${sprint.name}`}
                        >
                          <PlayIcon />
                          <span>Start</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="backlog-btn-complete-sprint"
                          onClick={() => handleOpenModal('completeSprint', sprint, null)}
                          title={`Complete ${sprint.name}`}
                        >
                          <CheckIcon size={13} />
                          <span>Complete sprint</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="backlog-header-icon-btn"
                        title={`${sprint.name} settings & actions`}
                        onClick={(e) => handleOpenModal('sprintMore', sprint, e)}
                      >
                        <MoreIcon />
                      </button>
                    </div>
                  </div>

                  {sprint.isExpanded && (
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
                                onChange={() => handleToggleAllSprint(sprint.id)}
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
                                </span>
                              </div>
                            </th>
                            <th className="th-id">Task ID</th>
                            <th className="th-sp">
                              <div className="th-with-info">
                                <span>Estimated SP</span>
                              </div>
                            </th>
                            <th className="th-epic">
                              <div className="th-with-info">
                                <span>Epic</span>
                              </div>
                            </th>
                            <th className="th-actions">Actions</th>
                            <th className="th-add-col">
                              <button
                                type="button"
                                className="backlog-btn-add-col"
                                title="Add custom column"
                                onClick={(e) => handleOpenModal('addColumn', null, e)}
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
                              onToggleTask={handleToggleTask}
                              onOpenComments={handleOpenComments}
                              onOpenOwnerPicker={handleOpenOwnerPicker}
                              onOpenStatusPicker={handleOpenStatusPicker}
                              onOpenTypePicker={handleOpenTypePicker}
                              onOpenSPPicker={handleOpenSPPicker}
                              onOpenEpicPicker={handleOpenEpicPicker}
                              onOpenEditTaskId={(task, e) => handleOpenModal('editTaskId', task, e)}
                              onMoveTask={(taskId) => handleMoveTask(taskId, 'backlog')}
                              onDeleteTask={handleDeleteTask}
                              onRemoveEpic={handleRemoveEpic}
                              showToast={showToast}
                            />
                          ))}

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
            })}

            {canManageSprints && (
              <div className="backlog-add-sprint-divider-box">
                <button
                  type="button"
                  className="backlog-btn-add-sprint-inline"
                  onClick={() => handleOpenModal('createSprint', null, null)}
                  title="Create another sprint"
                >
                  <span>+ Create sprint</span>
                </button>
              </div>
            )}

            {/* GROUP 2: BACKLOG SECTION */}
            <section className="backlog-group-section backlog-subgroup">
              <div className="backlog-group-header">
                <div
                  className="backlog-group-header-left cursor-pointer"
                  onClick={() => setIsBacklogExpanded(!isBacklogExpanded)}
                >
                  <button
                    type="button"
                    className="backlog-accordion-toggle-btn backlog-toggle"
                    aria-expanded={isBacklogExpanded}
                  >
                    {isBacklogExpanded ? (
                      <ChevronDownIcon size={16} />
                    ) : (
                      <ChevronRightIcon size={16} />
                    )}
                  </button>
                  <h2 className="backlog-group-title backlog-default-title">Backlog</h2>
                </div>
              </div>

              {isBacklogExpanded && (
                <div className="backlog-table-wrapper">
                  <table className="backlog-table">
                    <colgroup>
                      <col className="col-accent backlog-accent" />
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
                        <th className="th-accent backlog-bar" />
                        <th className="th-checkbox">
                          <input
                            type="checkbox"
                            className="backlog-custom-checkbox"
                            checked={
                              backlogTasks.length > 0 &&
                              backlogTasks.every((t) => selectedTaskIds.has(t.id))
                            }
                            onChange={handleToggleAllBacklog}
                            aria-label="Select all Backlog tasks"
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
                            onClick={(e) => handleOpenModal('addColumn', null, e)}
                          >
                            +
                          </button>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {backlogTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          isChecked={selectedTaskIds.has(task.id)}
                          isSprint1={false}
                          statusConfig={statusConfig}
                          typeConfig={typeConfig}
                          onToggleTask={handleToggleTask}
                          onOpenComments={handleOpenComments}
                          onOpenOwnerPicker={handleOpenOwnerPicker}
                          onOpenStatusPicker={handleOpenStatusPicker}
                          onOpenTypePicker={handleOpenTypePicker}
                          onOpenSPPicker={handleOpenSPPicker}
                          onOpenEpicPicker={handleOpenEpicPicker}
                          onOpenEditTaskId={(task, e) => handleOpenModal('editTaskId', task, e)}
                          onMoveTask={handleMoveTask}
                          onDeleteTask={handleDeleteTask}
                          onRemoveEpic={handleRemoveEpic}
                          showToast={showToast}
                        />
                      ))}

                    </tbody>

                    <tfoot>
                      <tr className="backlog-table-summary-row">
                        <td className="td-accent backlog-bar-transparent" />
                        <td className="td-checkbox" />
                        <td className="td-task" />
                        <td className="td-owner" />
                        <td className="td-status">
                          <div className="backlog-segmented-bar">
                            {backlogStatusStats.map((seg) => (
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
                            {backlogTypeStats.map((seg) => (
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
                            <span className="backlog-sp-sum-val">{backlogSPSum} SP</span>
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
          </>
        )}
      </main>

      {/* 5. FLOATING BATCH ACTIONS BAR */}
      <BacklogBatchBar
        selectedCount={selectedTaskIds.size}
        onMoveToSprint1={handleBatchMoveToSprint1}
        onMoveToBacklog={handleBatchMoveToBacklog}
        onMarkDone={handleBatchMarkDone}
        onDeleteSelected={handleBatchDelete}
        onClearSelection={handleClearSelection}
      />

      {/* 6. MODALS, DRAWERS & POPOVERS */}
      {activeModal && (
        <Suspense fallback={null}>
          <BacklogModals
            activeModal={activeModal}
            onClose={handleCloseModal}
            anchorRect={anchorRect}
            activeTaskTarget={activeTaskTarget}
            canUploadTaskAssets={canManageTasks}
            sprints={sprints}
            allTasks={allTasks}
            sprint1Tasks={sprint1Tasks}
            backlogTasks={backlogTasks}
            sprint1SPSum={sprint1SPSum}
            backlogSPSum={backlogSPSum}
            sprint1StatusStats={sprint1StatusStats}
            isSprint1Started={isSprint1Started}
            sprint1Dates={sprint1Dates}
            onUpdateSprintDates={handleUpdateSprintDates}
            onDeleteSprint={handleDeleteSprint}
            automations={automations}
            setAutomations={setAutomations}
            statusConfig={statusConfig}
            typeConfig={typeConfig}
            onUpdateStatusColor={handleUpdateStatusColor}
            onUpdateTypeColor={handleUpdateTypeColor}
            onAddNewType={handleAddNewType}
            selectedPersonFilter={selectedPersonFilter}
            setSelectedPersonFilter={setSelectedPersonFilter}
            personFilterMembers={activePersonFilterMembers}
            personFilterTitle={personFilterTitle}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            onStatusChange={handleStatusChange}
            onTypeChange={handleTypeChange}
            onOwnerChange={handleOwnerChange}
            onSPChange={handleSPChange}
            onEpicChange={handleEpicChange}
            onGithubLink={handleGithubLink}
            onPostComment={handlePostComment}
            onToggleCommentLike={handleToggleCommentLike}
            onDeleteComment={handleDeleteComment}
            onUpdateTaskDetails={handleUpdateTaskDetails}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
            onCreateTask={handleCreateTaskFromModal}
            onUpdateTaskId={handleUpdateTaskId}
            projectKey={projectKey}
            canInviteElevatedRoles={true}
            onUpdateProjectKey={handleUpdateProjectKey}
            onCreateSprint={handleCreateSprint}
            onStartSprint={handleStartSprint}
            onCompleteSprint={handleCompleteSprint}
            onMoveAllToBacklog={handleMoveAllToBacklog}
            onSelectAllTasks={handleSelectAllTasks}
            onClearSelection={handleClearSelection}
            onSelectBoardView={handleSelectBoardView}
            showToast={showToast}
            navigate={navigate}
          />
        </Suspense>
      )}

      {/* 7. FLOATING TOAST NOTIFICATION */}
      {toast.show && (
        <div className={`backlog-toast ${toast.type}`}>
          <div className="toast-icon">
            <CheckIcon size={16} />
          </div>
          <span className="toast-text">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Backlog;
