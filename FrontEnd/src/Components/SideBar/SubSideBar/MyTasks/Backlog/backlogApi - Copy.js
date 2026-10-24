import axios from 'axios';
import { isTaskPastDueAndIncomplete } from './TaskRowUtils';


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Axios instance configured for Backlog service
 */
export const backlogClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

// Automatically inject Authorization Bearer token from sessionStorage
backlogClient.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access error
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fallback project key
export const DEFAULT_PROJECT_KEY = 'LUX';

// Storage keys preserved for persistence across entire application
export const STORAGE_KEYS = {
  SPRINTS: 'jira_backlog_sprints',
  TASKS: 'jira_backlog_tasks',
  PROJECT_KEY: 'jira_project_key',
};

export const loadFromStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed;
  } catch (err) {
    console.warn(`[BacklogApi] Error reading ${key} from storage:`, err);
    return fallback;
  }
};

export const saveToStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (err) {
    console.warn(`[BacklogApi] Error writing ${key} to storage:`, err);
  }
};

/**
 * Initial stored sprints seed if storage is empty
 */
const DEFAULT_INITIAL_SPRINTS = [
  {
    id: '6ad0a29cb7b36f6c2e191d29',
    name: 'Sprint 0',
    status: 'active',
    isStarted: true,
    isCompleted: false,
    dates: '1 Oct - 8 Oct (1 week)',
    duration_text: '1 Oct - 8 Oct (1 week)',
    goals: 'Deliver core schema and authentication',
    capacityLimit: 20,
    isExpanded: true,
  },
  {
    id: '6ad31b29d690a64d6eb3e642',
    name: 'Sprint 4',
    status: 'active',
    isStarted: true,
    isCompleted: false,
    dates: '10 Oct - 24 Oct (2 weeks)',
    duration_text: '10 Oct - 24 Oct (2 weeks)',
    goals: 'Complete API integrations and sprint stability',
    capacityLimit: 25,
    isExpanded: true,
  },
  {
    id: '6ad098d7fb72ccd5b28d78fe',
    name: 'Sprint 1',
    status: 'completed',
    isStarted: false,
    isCompleted: true,
    dates: '15 Sep - 22 Sep (1 week)',
    duration_text: '15 Sep - 22 Sep (1 week)',
    goals: 'Initial foundation setup',
    capacityLimit: 20,
    isExpanded: false,
  },
  {
    id: '6ad0a29cb7b36f6c2e191d25',
    name: 'Sprint 2',
    status: 'completed',
    isStarted: false,
    isCompleted: true,
    dates: '23 Sep - 30 Sep (1 week)',
    duration_text: '23 Sep - 30 Sep (1 week)',
    goals: 'Sprint reporting and analytics',
    capacityLimit: 20,
    isExpanded: false,
  },
];

const DEFAULT_INITIAL_TASKS = [
  {
    id: 'task-7',
    taskId: 'LUX-007',
    title: 'Initial MongoDB schema setup on mongodb://localhost:27017/',
    status: 'Done',
    type: 'Frontend',
    sp: 5,
    owner: 'siva',
    epic: 'Infrastructure',
    sprintId: '6ad0a29cb7b36f6c2e191d29',
  },
  {
    id: 'task-8',
    taskId: 'LUX-008',
    title: 'JWT token authentication and user management',
    status: 'In Progress',
    type: 'Feature',
    sp: 5,
    owner: 'siva',
    epic: 'Security',
    sprintId: '6ad0a29cb7b36f6c2e191d29',
  },
  {
    id: 'task-9',
    taskId: 'LUX-009',
    title: 'Base React layout with dark mode design system',
    status: 'Done',
    type: 'Feature',
    sp: 3,
    owner: 'siva',
    epic: 'Frontend UI',
    sprintId: '6ad0a29cb7b36f6c2e191d29',
  },
  {
    id: 'task-10',
    taskId: 'LUX-010',
    title: 'API contract validation and schema synchronization',
    status: 'Ready to start',
    type: 'Frontend',
    sp: 3,
    owner: 'siva',
    epic: 'Backend',
    sprintId: '6ad31b29d690a64d6eb3e642',
  },
  {
    id: 'task-11',
    taskId: 'LUX-011',
    title: 'Cross-browser regression test suites',
    status: 'In Progress',
    type: 'Bug',
    sp: 5,
    owner: 'siva',
    epic: 'QA',
    sprintId: '6ad31b29d690a64d6eb3e642',
  },
  {
    id: 'task-1',
    taskId: 'LUX-001',
    title: 'Navigation and responsive layout',
    status: 'In Review',
    type: 'Feature',
    sp: 3,
    owner: 'siva',
    epic: 'UI',
    sprintId: '6ad098d7fb72ccd5b28d78fe',
  },
  {
    id: 'task-2',
    taskId: 'LUX-002',
    title: 'User session persistence and token caching',
    status: 'Ready to start',
    type: 'Feature',
    sp: 4,
    owner: 'siva',
    epic: 'Auth',
    sprintId: '6ad098d7fb72ccd5b28d78fe',
  },
  {
    id: 'task-3',
    taskId: 'LUX-003',
    title: 'Dynamic theme switcher and aesthetic tokens',
    status: 'In Review',
    type: 'Feature',
    sp: 2,
    owner: 'siva',
    epic: 'Design',
    sprintId: '6ad098d7fb72ccd5b28d78fe',
  },
  {
    id: 'task-4',
    taskId: 'LUX-004',
    title: 'Responsive layout & KPI summary for All Sprints',
    status: 'Ready to start',
    type: 'Frontend',
    sp: 3,
    owner: 'siva',
    epic: 'Sprints',
    sprintId: '6ad0a29cb7b36f6c2e191d25',
  },
  {
    id: 'task-5',
    taskId: 'LUX-005',
    title: 'MongoDB aggregation pipeline for velocity & commitment tracking',
    status: 'Ready to start',
    type: 'Frontend',
    sp: 5,
    owner: 'siva',
    epic: 'Database',
    sprintId: '6ad0a29cb7b36f6c2e191d25',
  },
  {
    id: 'task-6',
    taskId: 'LUX-006',
    title: 'Unit & integration test suites for all sprint endpoints',
    status: 'In Progress',
    type: 'Bug',
    sp: 4,
    owner: 'siva',
    epic: 'Testing',
    sprintId: '6ad0a29cb7b36f6c2e191d25',
  },
];

/**
 * Active runtime in-memory stores backed by localStorage
 */
let _inMemoryTasks = (() => {
  const stored = loadFromStorage(STORAGE_KEYS.TASKS, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  saveToStorage(STORAGE_KEYS.TASKS, DEFAULT_INITIAL_TASKS);
  return DEFAULT_INITIAL_TASKS;
})();

let _inMemorySprints = (() => {
  const stored = loadFromStorage(STORAGE_KEYS.SPRINTS, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  saveToStorage(STORAGE_KEYS.SPRINTS, DEFAULT_INITIAL_SPRINTS);
  return DEFAULT_INITIAL_SPRINTS;
})();

let _inMemoryProjectKey = (() => {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_KEY;
  return localStorage.getItem(STORAGE_KEYS.PROJECT_KEY) || DEFAULT_PROJECT_KEY;
})();

// Dispatch in-memory and storage events so all components across full app stay in sync
const notifyTasksChanged = (tasks) => {
  _inMemoryTasks = Array.isArray(tasks) ? tasks : [];
  saveToStorage(STORAGE_KEYS.TASKS, _inMemoryTasks);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus:backlog-tasks-changed', { detail: _inMemoryTasks }));
  }
};

const notifySprintsChanged = (sprints) => {
  _inMemorySprints = Array.isArray(sprints) ? sprints : [];
  saveToStorage(STORAGE_KEYS.SPRINTS, _inMemorySprints);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus:backlog-sprints-changed', { detail: _inMemorySprints }));
  }
};

const notifyProjectKeyChanged = (key) => {
  _inMemoryProjectKey = key || DEFAULT_PROJECT_KEY;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PROJECT_KEY, _inMemoryProjectKey);
    window.dispatchEvent(new CustomEvent('nexus:project-key-changed', { detail: _inMemoryProjectKey }));
  }
};

// Storage readers and writers for components that import them
export const getStoredTasks = () => _inMemoryTasks;
export const getStoredSprints = () => _inMemorySprints;
export const getStoredProjectKey = () => _inMemoryProjectKey;
export const saveStoredTasks = (tasks) => notifyTasksChanged(tasks);
export const saveStoredSprints = (sprints) => notifySprintsChanged(sprints);
export const saveStoredProjectKey = (key) => notifyProjectKeyChanged(key);

/**
 * 1. TASKS / ISSUES API
 */
export const taskApi = {
  /**
   * Fetch all backlog tasks from database
   * GET /backlog/tasks/ or /tasks/
   */
  getAll: async (params = {}) => {
    try {
      const response = await backlogClient.get('/backlog/tasks/', { params });
      const data = response.data?.tasks || response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map((raw) => {
          const rawDueDate = raw.dueDate || raw.due_date || '';
          const status = raw.status || 'Ready to start';
          let sprintId = String(raw.sprint?.id || raw.sprint_id || raw.sprintId || 'backlog');
          if (isTaskPastDueAndIncomplete({ dueDate: rawDueDate, status })) {
            sprintId = 'backlog';
          }
          return {
            ...raw,
            id: String(raw.id || raw._id || raw.pk),
            taskId: String(raw.task_key || raw.taskId || raw.key || `LUX-${raw.id}`),
            sprintId,
            status,
            type: raw.task_type || raw.type || 'Frontend',
            sp: raw.estimated_sp ?? raw.sp ?? null,
            title: raw.title || 'Untitled task',
            dueDate: rawDueDate,
          };
        });
        notifyTasksChanged(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn('[BacklogApi] Backend tasks fetch notice (using stored tasks):', error.message);
    }
    return _inMemoryTasks;
  },

  /**
   * Fetch single task by ID
   * GET /backlog/tasks/:id/
   */
  getById: async (taskId) => {
    try {
      const response = await backlogClient.get(`/backlog/tasks/${taskId}/`);
      return response.data?.task || response.data;
    } catch (err) {
      return _inMemoryTasks.find((t) => String(t.id) === String(taskId)) || null;
    }
  },

  /**
   * Create task in database
   * POST /backlog/tasks/
   */
  create: async (taskData) => {
    const rawDueDate = taskData.dueDate || taskData.due_date || '';
    const status = taskData.status || 'Ready to start';
    const isPastIncomplete = isTaskPastDueAndIncomplete({ dueDate: rawDueDate, status });
    const targetSprintId = isPastIncomplete ? 'backlog' : String(taskData.sprintId || taskData.sprint || 'backlog');

    const normalized = {
      ...taskData,
      id: String(taskData.id || `task-${Date.now()}`),
      sprintId: targetSprintId,
      dueDate: rawDueDate,
    };
    const updated = [..._inMemoryTasks, normalized];
    notifyTasksChanged(updated);

    try {
      const response = await backlogClient.post('/backlog/tasks/', {
        ...taskData,
        sprint_id: targetSprintId === 'backlog' ? null : targetSprintId,
        sprintId: targetSprintId === 'backlog' ? null : targetSprintId,
        due_date: rawDueDate,
        dueDate: rawDueDate,
      });
      const serverTask = response.data?.task || response.data?.data || response.data;
      if (serverTask && (serverTask.id || serverTask.pk)) {
        const serverId = String(serverTask.id || serverTask.pk);
        const serverSprint = isPastIncomplete ? 'backlog' : String(serverTask.sprintId || serverTask.sprint || normalized.sprintId);
        const synced = updated.map((t) =>
          t.id === normalized.id ? { ...t, ...serverTask, id: serverId, sprintId: serverSprint, dueDate: rawDueDate } : t
        );
        notifyTasksChanged(synced);
        return { ...normalized, ...serverTask, id: serverId, sprintId: serverSprint };
      }
    } catch (error) {
      console.warn('[BacklogApi] Server task creation notice (saved locally in storage):', error?.message);
    }
    return normalized;
  },

  /**
   * Update task in database
   * PUT /backlog/tasks/:id/
   */
  update: async (taskId, updates) => {
    const updated = _inMemoryTasks.map((t) => {
      if (String(t.id) === String(taskId)) {
        const merged = { ...t, ...updates };
        if (isTaskPastDueAndIncomplete(merged)) {
          merged.sprintId = 'backlog';
        }
        return merged;
      }
      return t;
    });
    notifyTasksChanged(updated);

    try {
      await backlogClient.put(`/backlog/tasks/${taskId}/`, updates);
    } catch (error) {
      console.warn('[BacklogApi] PUT task notice (saved locally in storage):', error?.message);
    }
    return updated;
  },

  /**
   * Delete task from database
   * DELETE /backlog/tasks/:id/
   */
  delete: async (taskId) => {
    const updated = _inMemoryTasks.filter((t) => String(t.id) !== String(taskId));
    notifyTasksChanged(updated);

    try {
      await backlogClient.delete(`/backlog/tasks/${taskId}/`);
    } catch (error) {
      console.warn('[BacklogApi] DELETE task notice (deleted locally in storage):', error?.message);
    }
    return updated;
  },

  /**
   * Move task to a different sprint or backlog
   * POST /backlog/tasks/:id/move/
   */
  move: async (taskId, { sprintId, position = null }) => {
    const payload = { sprintId, position };
    const updated = _inMemoryTasks.map((t) => (String(t.id) === String(taskId) ? { ...t, sprintId: String(sprintId) } : t));
    notifyTasksChanged(updated);

    try {
      await backlogClient.post(`/backlog/tasks/${taskId}/move/`, payload);
    } catch (error) {
      console.warn('[BacklogApi] POST move task notice (moved locally in storage):', error?.message);
    }
    return updated;
  },

  /**
   * Batch update tasks
   * POST /backlog/tasks/batch/
   */
  batchUpdate: async (taskIds, updates) => {
    const idSet = new Set((taskIds || []).map(String));
    const updated = _inMemoryTasks.map((t) => (idSet.has(String(t.id)) ? { ...t, ...updates } : t));
    notifyTasksChanged(updated);

    try {
      await backlogClient.post('/backlog/tasks/batch/', { taskIds, updates });
    } catch (error) {
      console.warn('[BacklogApi] POST batchUpdate task notice (updated locally in storage):', error?.message);
    }
    return updated;
  },

  /**
   * Add comment to task
   * POST /backlog/tasks/:id/comments/
   */
  addComment: async (taskId, commentData) => {
    try {
      const response = await backlogClient.post(`/backlog/tasks/${taskId}/comments/`, commentData);
      return response.data;
    } catch (error) {
      if (error.response) throw error;
      return commentData;
    }
  },

  /**
   * Delete comment from task
   * DELETE /backlog/tasks/:id/comments/:commentId/
   */
  deleteComment: async (taskId, commentId) => {
    await backlogClient.delete(`/backlog/tasks/${taskId}/comments/${commentId}/`);
  },

  /**
   * Sync tasks state into runtime memory (NO localStorage)
   */
  saveAll: (tasks) => {
    notifyTasksChanged(tasks);
  },
};

export const boardAssetApi = {
  getAll: async (taskId) => {
    const response = await backlogClient.get('/backlog/board-assets/', {
      params: taskId ? { task_id: taskId } : undefined,
    });
    return response.data?.assets || [];
  },

  uploadFiles: async (files, taskId) => {
    const formData = new FormData();
    formData.append('kind', 'archive');
    formData.append('task_id', taskId);
    files.forEach((file) => formData.append('files', file));
    const response = await backlogClient.post('/backlog/board-assets/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  createLink: async ({ title, url, taskId }) => {
    const response = await backlogClient.post('/backlog/board-assets/', {
      kind: 'link',
      task_id: taskId,
      title,
      url,
    });
    return response.data;
  },

  download: async (assetId) => {
    const response = await backlogClient.get(
      `/backlog/board-assets/${assetId}/download/`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  delete: async (assetId) => {
    await backlogClient.delete(`/backlog/board-assets/${assetId}/`);
  },
};

/**
 * 2. SPRINTS API
 */
export const sprintApi = {
  /**
   * Fetch all sprints from database
   * GET /backlog/sprints/
   */
  getAll: async () => {
    try {
      const response = await backlogClient.get('/backlog/sprints/');
      const data = response.data?.sprints || response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map((raw) => {
          const isStarted = raw.status === 'active' || Boolean(raw.isStarted);
          const isCompleted = raw.status === 'completed' || Boolean(raw.isCompleted);
          return {
            ...raw,
            id: String(raw.id || raw._id || raw.pk),
            name: raw.name || 'Sprint',
            status: raw.status || (isStarted ? 'active' : isCompleted ? 'completed' : 'future'),
            isStarted,
            isCompleted,
            dates: raw.duration_text || raw.dates || 'Add Sprint dates',
            goals: raw.goals || raw.goal || '',
            capacityLimit: Number(raw.capacity_limit ?? raw.capacity ?? 20),
            isExpanded: raw.isExpanded !== false,
          };
        });
        notifySprintsChanged(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn('[BacklogApi] Backend sprints fetch notice (using stored sprints):', error.message);
    }
    return _inMemorySprints;
  },

  /**
   * Create sprint in database
   * POST /backlog/sprints/
   */
  create: async (sprintData) => {
    const normalized = {
      ...sprintData,
      id: String(sprintData.id || `sprint-${Date.now()}`),
      isStarted: Boolean(sprintData.isStarted),
      isCompleted: Boolean(sprintData.isCompleted),
      status: sprintData.status || (sprintData.isStarted ? 'active' : 'future'),
    };
    const updated = [..._inMemorySprints, normalized];
    notifySprintsChanged(updated);

    try {
      const response = await backlogClient.post('/backlog/sprints/', sprintData);
      const serverSprint = response.data?.sprint || response.data?.data || response.data;
      if (serverSprint && (serverSprint.id || serverSprint.pk)) {
        const serverId = String(serverSprint.id || serverSprint.pk);
        const synced = updated.map((s) => (s.id === normalized.id ? { ...s, ...serverSprint, id: serverId } : s));
        notifySprintsChanged(synced);
        return { ...normalized, ...serverSprint, id: serverId };
      }
    } catch (error) {
      console.warn('[BacklogApi] Server sprint creation notice (saved locally in storage):', error?.message);
    }
    return normalized;
  },

  /**
   * Update sprint in database
   * PATCH /backlog/sprints/:id/
   */
  update: async (sprintId, sprintData) => {
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, ...sprintData } : s
    );
    notifySprintsChanged(updated);

    try {
      await backlogClient.patch(`/backlog/sprints/${sprintId}/`, sprintData);
    } catch (error) {
      console.warn('[BacklogApi] PATCH sprint warning (saved locally):', error?.message);
    }
    return updated;
  },

  /**
   * Start sprint
   * POST /backlog/sprints/:id/start/
   */
  start: async (sprintId) => {
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: true, isCompleted: false, status: 'active' } : s
    );
    notifySprintsChanged(updated);

    try {
      await backlogClient.post(`/backlog/sprints/${sprintId}/start/`);
    } catch (error) {
      console.warn('[BacklogApi] POST /start/ warning (saved locally):', error?.message);
    }
    return updated;
  },

  /**
   * Complete sprint
   * POST /backlog/sprints/:id/complete/
   */
  complete: async (sprintId) => {
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: false, isCompleted: true, status: 'completed' } : s
    );
    notifySprintsChanged(updated);

    try {
      await backlogClient.post(`/backlog/sprints/${sprintId}/complete/`);
    } catch (error) {
      console.warn('[BacklogApi] POST /complete/ warning (saved locally):', error?.message);
    }
    return updated;
  },

  /**
   * Delete sprint from database
   * DELETE /backlog/sprints/:id/
   */
  delete: async (sprintId) => {
    const updated = _inMemorySprints.filter((s) => String(s.id) !== String(sprintId));
    notifySprintsChanged(updated);

    try {
      await backlogClient.delete(`/backlog/sprints/${sprintId}/`);
    } catch (error) {
      console.warn('[BacklogApi] DELETE sprint warning (saved locally):', error?.message);
    }
    return updated;
  },

  /**
   * Sync sprints list into runtime memory (NO localStorage)
   */
  saveAll: (sprints) => {
    notifySprintsChanged(sprints);
  },
};

/**
 * 3. PROJECT KEY API (e.g. LUX, PROJ)
 */
export const projectKeyApi = {
  get: async () => {
    try {
      const response = await backlogClient.get('/backlog/project-key/');
      const key = response.data?.projectKey || response.data?.key;
      if (key) {
        notifyProjectKeyChanged(key);
        return key;
      }
    } catch (error) {
      if (error.response) throw error;
    }
    return _inMemoryProjectKey || DEFAULT_PROJECT_KEY;
  },

  set: async (key) => {
    const cleanKey = (key || '').trim().toUpperCase() || DEFAULT_PROJECT_KEY;
    notifyProjectKeyChanged(cleanKey);

    await backlogClient.put('/backlog/project-key/', { projectKey: cleanKey });
    return cleanKey;
  },
};

/**
 * 4. BACKLOG INTEGRATION STATUS & HEALTH API
 */
export const backlogStatusApi = {
  /**
   * Check if backend database endpoints are reachable
   */
  checkHealth: async () => {
    try {
      const response = await backlogClient.get('/backlog/health/', { timeout: 3500 });
      return {
        isConnected: true,
        isPreparing: false,
        status: response.status,
        message: response.data?.message || 'Database connected',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) throw err;
      return {
        isConnected: false,
        isPreparing: true,
        status: status || 0,
        message: 'Backend server offline or unreachable',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

export default {
  API_BASE_URL,
  backlogClient,
  taskApi,
  boardAssetApi,
  sprintApi,
  projectKeyApi,
  backlogStatusApi,
  getStoredTasks,
  getStoredSprints,
  getStoredProjectKey,
  STORAGE_KEYS,
  DEFAULT_PROJECT_KEY,
};
