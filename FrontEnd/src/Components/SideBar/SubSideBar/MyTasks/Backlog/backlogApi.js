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

let _inMemoryTasks = [];
let _inMemorySprints = [];
let _inMemoryProjectKey = (() => {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_KEY;
  return localStorage.getItem(STORAGE_KEYS.PROJECT_KEY) || DEFAULT_PROJECT_KEY;
})();

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
    const response = await backlogClient.get('/backlog/tasks/', { params });
    const data = response.data?.tasks || response.data?.data || response.data;
    if (!Array.isArray(data)) {
      throw new Error('The task response did not contain a list.');
    }
    const normalized = data.map((raw) => {
      const rawStartDate = raw.startDate || raw.start_date || '';
      const rawDueDate = raw.dueDate || raw.due_date || '';
      const taskStatus = raw.status || '';
      let sprintId = String(raw.sprint?.id || raw.sprint_id || raw.sprintId || 'backlog');
      if (isTaskPastDueAndIncomplete({ dueDate: rawDueDate, status: taskStatus })) {
        sprintId = 'backlog';
      }
      return {
        ...raw,
        id: String(raw.id || raw._id || raw.pk),
        taskId: String(raw.task_key || raw.taskId || raw.key || ''),
        sprintId,
        status: taskStatus,
        type: raw.task_type || raw.type || '',
        sp: raw.estimated_sp ?? raw.sp ?? null,
        title: raw.title || '',
        startDate: rawStartDate,
        dueDate: rawDueDate,
      };
    });
    notifyTasksChanged(normalized);
    return normalized;
  },

  /**
   * Fetch single task by ID
   * GET /backlog/tasks/:id/
   */
  getById: async (taskId) => {
    const response = await backlogClient.get(`/backlog/tasks/${taskId}/`);
    return response.data?.task || response.data;
  },

  /**
   * Create task in database
   * POST /backlog/tasks/
   */
  create: async (taskData) => {
    const rawStartDate = taskData.startDate || taskData.start_date || '';
    const rawDueDate = taskData.dueDate || taskData.due_date || '';
    const status = taskData.status || 'Ready to start';
    const isPastIncomplete = isTaskPastDueAndIncomplete({ dueDate: rawDueDate, status });
    const targetSprintId = isPastIncomplete ? 'backlog' : String(taskData.sprintId || taskData.sprint || 'backlog');

    const normalized = {
      ...taskData,
      id: String(taskData.id || `task-${Date.now()}`),
      sprintId: targetSprintId,
      startDate: rawStartDate,
      dueDate: rawDueDate,
    };
    const response = await backlogClient.post('/backlog/tasks/', {
        ...taskData,
        sprint_id: targetSprintId === 'backlog' ? null : targetSprintId,
        sprintId: targetSprintId === 'backlog' ? null : targetSprintId,
        start_date: rawStartDate,
        startDate: rawStartDate,
        due_date: rawDueDate,
        dueDate: rawDueDate,
      });
    const serverTask = response.data?.task || response.data?.data || response.data;
    if (!serverTask || !(serverTask.id || serverTask.pk)) {
      throw new Error('The task was created without a server identifier.');
    }
    const serverId = String(serverTask.id || serverTask.pk);
    const serverSprint = isPastIncomplete ? 'backlog' : String(serverTask.sprintId || serverTask.sprint || normalized.sprintId);
    const created = { ...normalized, ...serverTask, id: serverId, sprintId: serverSprint };
    notifyTasksChanged([..._inMemoryTasks, created]);
    return created;
  },

  /**
   * Update task in database
   * PUT /backlog/tasks/:id/
   */
  update: async (taskId, updates) => {
    await backlogClient.put(`/backlog/tasks/${taskId}/`, updates);
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
    return updated;
  },

  /**
   * Delete task from database
   * DELETE /backlog/tasks/:id/
   */
  delete: async (taskId) => {
    await backlogClient.delete(`/backlog/tasks/${taskId}/`);
    const updated = _inMemoryTasks.filter((t) => String(t.id) !== String(taskId));
    notifyTasksChanged(updated);
    return updated;
  },

  /**
   * Move task to a different sprint or backlog
   * POST /backlog/tasks/:id/move/
   */
  move: async (taskId, { sprintId, position = null }) => {
    const payload = { sprintId, position };
    await backlogClient.post(`/backlog/tasks/${taskId}/move/`, payload);
    const updated = _inMemoryTasks.map((t) => (String(t.id) === String(taskId) ? { ...t, sprintId: String(sprintId) } : t));
    notifyTasksChanged(updated);
    return updated;
  },

  /**
   * Batch update tasks
   * POST /backlog/tasks/batch/
   */
  batchUpdate: async (taskIds, updates) => {
    const idSet = new Set((taskIds || []).map(String));
    await backlogClient.post('/backlog/tasks/batch/', { taskIds, updates });
    const updated = _inMemoryTasks.map((t) => (idSet.has(String(t.id)) ? { ...t, ...updates } : t));
    notifyTasksChanged(updated);
    return updated;
  },

  /**
   * Add comment to task
   * POST /backlog/tasks/:id/comments/
   */
  addComment: async (taskId, commentData) => {
    const response = await backlogClient.post(`/backlog/tasks/${taskId}/comments/`, commentData);
    return response.data;
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
    const response = await backlogClient.get('/backlog/sprints/');
    const data = response.data?.sprints || response.data?.data || response.data;
    if (!Array.isArray(data)) {
      throw new Error('The sprint response did not contain a list.');
    }
    const normalized = data.map((raw) => {
      const isStarted = raw.status === 'active' || Boolean(raw.isStarted);
      const isCompleted = raw.status === 'completed' || Boolean(raw.isCompleted);
      return {
        ...raw,
        id: String(raw.id || raw._id || raw.pk),
        name: raw.name || '',
        status: raw.status || (isStarted ? 'active' : isCompleted ? 'completed' : ''),
        isStarted,
        isCompleted,
        dates: raw.duration_text || raw.dates || '',
        goals: raw.goals || raw.goal || '',
        capacityLimit: Number(raw.capacity_limit ?? raw.capacity ?? 20),
        isExpanded: raw.isExpanded !== false,
      };
    });
    notifySprintsChanged(normalized);
    return normalized;
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
    const response = await backlogClient.post('/backlog/sprints/', sprintData);
    const serverSprint = response.data?.sprint || response.data?.data || response.data;
    if (!serverSprint || !(serverSprint.id || serverSprint.pk)) {
      throw new Error('The sprint was created without a server identifier.');
    }
    const created = { ...normalized, ...serverSprint, id: String(serverSprint.id || serverSprint.pk) };
    notifySprintsChanged([..._inMemorySprints, created]);
    return created;
  },

  /**
   * Update sprint in database
   * PATCH /backlog/sprints/:id/
   */
  update: async (sprintId, sprintData) => {
    await backlogClient.patch(`/backlog/sprints/${sprintId}/`, sprintData);
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, ...sprintData } : s
    );
    notifySprintsChanged(updated);
    return updated;
  },

  /**
   * Start sprint
   * POST /backlog/sprints/:id/start/
   */
  start: async (sprintId) => {
    await backlogClient.post(`/backlog/sprints/${sprintId}/start/`);
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: true, isCompleted: false, status: 'active' } : s
    );
    notifySprintsChanged(updated);

    return updated;
  },

  /**
   * Complete sprint
   * POST /backlog/sprints/:id/complete/
   */
  complete: async (sprintId) => {
    await backlogClient.post(`/backlog/sprints/${sprintId}/complete/`);
    const updated = _inMemorySprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: false, isCompleted: true, status: 'completed' } : s
    );
    notifySprintsChanged(updated);

    return updated;
  },

  /**
   * Delete sprint from database
   * DELETE /backlog/sprints/:id/
   */
  delete: async (sprintId) => {
    await backlogClient.delete(`/backlog/sprints/${sprintId}/`);
    const updated = _inMemorySprints.filter((s) => String(s.id) !== String(sprintId));
    notifySprintsChanged(updated);
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
