import axios from 'axios';
import {
  API_BASE_URL,
  DEFAULT_PROJECT_KEY,
  getStoredTasks,
  getStoredSprints,
  saveStoredTasks,
  saveStoredSprints,
} from '../Backlog/backlogApi';
import { isTaskPastDueAndIncomplete } from '../Backlog/TaskRowUtils';

/**
 * Axios instance configured specifically for Active Sprint operations
 */
export const activeSprintClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

// Automatically inject Authorization Bearer token from sessionStorage
activeSprintClient.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore sessionStorage access errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Normalizes sprint object between Backend Django model and Frontend React state
 */
export const normalizeSprint = (rawSprint) => {
  if (!rawSprint) return null;
  const id = rawSprint.id || rawSprint._id || String(rawSprint.pk || '');
  const isStarted = rawSprint.status === 'active' || Boolean(rawSprint.isStarted);
  const isCompleted = rawSprint.status === 'completed' || Boolean(rawSprint.isCompleted);
  
  let dates = rawSprint.duration_text || rawSprint.dates;
  if (!dates && rawSprint.start_date && rawSprint.end_date) {
    dates = `${rawSprint.start_date} - ${rawSprint.end_date}`;
  }
  if (!dates) {
    dates = 'Add Sprint dates';
  }

  return {
    id: String(id),
    name: rawSprint.name || 'Sprint',
    status: rawSprint.status || (isStarted ? 'active' : isCompleted ? 'completed' : 'future'),
    isStarted,
    isCompleted,
    isExpanded: rawSprint.isExpanded !== false,
    dates,
    durationText: dates,
    startDate: rawSprint.start_date || '',
    endDate: rawSprint.end_date || '',
    goals: rawSprint.goals || rawSprint.goal || '',
    capacityLimit: Number(rawSprint.capacity_limit ?? rawSprint.capacityLimit ?? 20),
    totalSp: Number(rawSprint.total_sp ?? rawSprint.totalSp ?? 0),
    issuesCount: Number(rawSprint.issues_count ?? rawSprint.issuesCount ?? 0),
    order: Number(rawSprint.order || 0),
    tasks: Array.isArray(rawSprint.tasks) ? rawSprint.tasks.map(normalizeTask) : [],
  };
};

/**
 * Normalizes task object between Backend Django model and Frontend React state
 */
export const normalizeTask = (rawTask) => {
  if (!rawTask) return null;
  const id = rawTask.id || rawTask._id || String(rawTask.pk || '');
  const taskId = rawTask.task_key || rawTask.taskId || rawTask.key || `TASK-${id}`;
  let sprintId = rawTask.sprint?.id || rawTask.sprint_id || rawTask.sprintId || 'backlog';
  const owner = rawTask.owner?.id || rawTask.owner_id || rawTask.owner || 'siva';
  const type = rawTask.task_type || rawTask.type || 'Frontend';
  const sp = rawTask.estimated_sp ?? rawTask.sp ?? null;
  const status = rawTask.status || 'Ready to start';
  const dueDate = rawTask.dueDate || rawTask.due_date || '';

  if (isTaskPastDueAndIncomplete({ dueDate, status })) {
    sprintId = 'backlog';
  }

  return {
    id: String(id),
    taskId: String(taskId),
    title: rawTask.title || 'Untitled task',
    description: rawTask.description || '',
    status,
    type: String(type),
    sp: sp !== null && sp !== undefined ? Number(sp) : null,
    owner: typeof owner === 'object' ? (owner.name || owner.username || 'siva') : String(owner),
    ownerDetails: typeof rawTask.owner === 'object' ? rawTask.owner : null,
    epic: rawTask.epic || '',
    sprintId: String(sprintId),
    commentsCount: Number(rawTask.comments_count ?? (Array.isArray(rawTask.comments) ? rawTask.comments.length : 0)),
    comments: Array.isArray(rawTask.comments) ? rawTask.comments : [],
    checklist: Array.isArray(rawTask.checklist) ? rawTask.checklist : [],
    dueDate,
    updatedAt: rawTask.updated_at || rawTask.updatedAt || new Date().toISOString(),
  };
};

/**
 * Active Sprint API Client
 */
export const activeSprintApi = {
  /**
   * Fetch all sprints from backend database
   * GET /api/sprints/ or /api/backlog/sprints/
   */
  getAllSprints: async () => {
    try {
      const response = await activeSprintClient.get('/sprints/');
      const data = response.data?.sprints || response.data?.data || response.data;
      if (Array.isArray(data)) {
        const normalized = data.map(normalizeSprint);
        return normalized;
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn('[ActiveSprintApi] GET /sprints/ error:', error.message);
      }
    }

    // Fallback to in-memory store
    const inMem = getStoredSprints();
    return Array.isArray(inMem) ? inMem.map(normalizeSprint) : [];
  },

  /**
   * Fetch currently active sprint(s)
   */
  getActiveSprints: async () => {
    const all = await activeSprintApi.getAllSprints();
    return all.filter((s) => s.isStarted && !s.isCompleted);
  },

  /**
   * Fetch tasks for a specific sprint
   * GET /api/tasks/?sprint_id={sprintId}
   */
  getSprintTasks: async (sprintId) => {
    try {
      const response = await activeSprintClient.get('/tasks/', {
        params: sprintId ? { sprint_id: sprintId } : undefined,
      });
      const data = response.data?.tasks || response.data?.data || response.data;
      if (Array.isArray(data)) {
        return data.map(normalizeTask);
      }
    } catch (error) {
      console.warn(`[ActiveSprintApi] GET /tasks/?sprint_id=${sprintId} error:`, error.message);
    }

    // In-memory fallback
    const inMem = getStoredTasks();
    const tasks = Array.isArray(inMem) ? inMem.map(normalizeTask) : [];
    return sprintId ? tasks.filter((t) => String(t.sprintId) === String(sprintId)) : tasks;
  },

  /**
   * Fetch capacity metadata for a sprint
   * GET /api/sprints/{sprintId}/capacity/
   */
  getCapacity: async (sprintId) => {
    try {
      const response = await activeSprintClient.get(`/sprints/${sprintId}/capacity/`);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] GET /sprints/${sprintId}/capacity/ error:`, error.message);
      return null;
    }
  },

  /**
   * Update capacity limit for a sprint
   * PUT /api/sprints/{sprintId}/capacity/
   */
  updateCapacity: async (sprintId, capacityLimit) => {
    const sprints = getStoredSprints();
    const updated = sprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, capacityLimit: Number(capacityLimit) } : s
    );
    saveStoredSprints(updated);
    try {
      const response = await activeSprintClient.put(`/sprints/${sprintId}/capacity/`, {
        capacity_limit: Number(capacityLimit),
      });
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] PUT /sprints/${sprintId}/capacity/ error:`, error.message);
      return { capacity_limit: Number(capacityLimit) };
    }
  },

  /**
   * Update sprint dates
   * PUT /api/sprints/{sprintId}/dates/
   */
  updateDates: async (sprintId, { startDate, endDate, durationText }) => {
    const sprints = getStoredSprints();
    const updated = sprints.map((s) =>
      String(s.id) === String(sprintId)
        ? {
            ...s,
            startDate: startDate || s.startDate,
            endDate: endDate || s.endDate,
            dates: durationText || s.dates,
            durationText: durationText || s.durationText,
          }
        : s
    );
    saveStoredSprints(updated);
    const payload = {
      start_date: startDate || null,
      end_date: endDate || null,
      duration_text: durationText || '',
    };
    try {
      const response = await activeSprintClient.put(`/sprints/${sprintId}/dates/`, payload);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] PUT /sprints/${sprintId}/dates/ error:`, error.message);
      return payload;
    }
  },

  /**
   * Update sprint goals
   * PUT /api/sprints/{sprintId}/goals/
   */
  updateGoals: async (sprintId, goals) => {
    const sprints = getStoredSprints();
    const updated = sprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, goals: goals || '' } : s
    );
    saveStoredSprints(updated);
    try {
      const response = await activeSprintClient.put(`/sprints/${sprintId}/goals/`, {
        goals: goals || '',
      });
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] PUT /sprints/${sprintId}/goals/ error:`, error.message);
      return { goals };
    }
  },

  /**
   * Start a sprint (transition to active status)
   * POST /api/sprints/{sprintId}/start/
   */
  startSprint: async (sprintId) => {
    const sprints = getStoredSprints();
    const updated = sprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: true, isCompleted: false, status: 'active' } : s
    );
    saveStoredSprints(updated);
    try {
      const response = await activeSprintClient.post(`/sprints/${sprintId}/start/`);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] POST /sprints/${sprintId}/start/ error:`, error.message);
      return { message: 'Sprint started (in-memory mode)', sprint_id: sprintId };
    }
  },

  /**
   * Complete a sprint (transition to completed status)
   * POST /api/sprints/{sprintId}/complete/
   */
  completeSprint: async (sprintId) => {
    const sprints = getStoredSprints();
    const updated = sprints.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, isStarted: false, isCompleted: true, status: 'completed' } : s
    );
    saveStoredSprints(updated);
    try {
      const response = await activeSprintClient.post(`/sprints/${sprintId}/complete/`);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] POST /sprints/${sprintId}/complete/ error:`, error.message);
      return { message: 'Sprint completed (in-memory mode)', sprint_id: sprintId };
    }
  },

  /**
   * Create task in active sprint
   * POST /api/tasks/
   */
  createTask: async (taskData) => {
    const normalized = normalizeTask({
      ...taskData,
      id: String(taskData.id || `task-${Date.now()}`),
      sprintId: String(taskData.sprintId || 'backlog'),
    });
    const currentTasks = getStoredTasks();
    const updatedTasks = [...currentTasks, normalized];
    saveStoredTasks(updatedTasks);

    const payload = {
      title: taskData.title,
      task_key: taskData.taskId,
      sprint_id: taskData.sprintId,
      status: taskData.status || 'Ready to start',
      task_type: taskData.type || 'Frontend',
      estimated_sp: taskData.sp !== null ? Number(taskData.sp) : 3,
      epic: taskData.epic || '',
      description: taskData.description || '',
    };
    try {
      const response = await activeSprintClient.post('/tasks/', payload);
      const serverTask = response.data?.task || response.data?.data || response.data;
      if (serverTask && (serverTask.id || serverTask.pk)) {
        const serverId = String(serverTask.id || serverTask.pk);
        const synced = updatedTasks.map((t) =>
          t.id === normalized.id ? { ...t, ...serverTask, id: serverId } : t
        );
        saveStoredTasks(synced);
        return normalizeTask({ ...normalized, ...serverTask, id: serverId });
      }
      return normalized;
    } catch (error) {
      console.warn('[ActiveSprintApi] POST /tasks/ error:', error.message);
      return normalized;
    }
  },

  /**
   * Update task details or status
   * PUT /api/tasks/{taskId}/
   */
  updateTask: async (taskId, updates) => {
    const currentTasks = getStoredTasks();
    const updatedTasks = currentTasks.map((t) =>
      String(t.id) === String(taskId) ? { ...t, ...updates } : t
    );
    saveStoredTasks(updatedTasks);

    const payload = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.type !== undefined) payload.task_type = updates.type;
    if (updates.sp !== undefined) payload.estimated_sp = updates.sp;
    if (updates.epic !== undefined) payload.epic = updates.epic;
    if (updates.owner !== undefined) payload.owner = updates.owner;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.sprintId !== undefined) payload.sprint_id = updates.sprintId;

    try {
      const response = await activeSprintClient.put(`/tasks/${taskId}/`, payload);
      const serverTask = response.data?.task || response.data?.data || response.data;
      return normalizeTask({ ...updates, ...serverTask, id: String(taskId) });
    } catch (error) {
      console.warn(`[ActiveSprintApi] PUT /tasks/${taskId}/ error:`, error.message);
      return { id: String(taskId), ...updates };
    }
  },

  /**
   * Move task between sprint and backlog
   * POST /api/tasks/{taskId}/move/
   */
  moveTask: async (taskId, { sprintId, position = null }) => {
    const currentTasks = getStoredTasks();
    const updatedTasks = currentTasks.map((t) =>
      String(t.id) === String(taskId) ? { ...t, sprintId: String(sprintId) } : t
    );
    saveStoredTasks(updatedTasks);

    const payload = { sprintId, position };
    try {
      const response = await activeSprintClient.post(`/tasks/${taskId}/move/`, payload);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] POST /tasks/${taskId}/move/ error:`, error.message);
      return payload;
    }
  },

  /**
   * Delete task
   * DELETE /api/tasks/{taskId}/
   */
  deleteTask: async (taskId) => {
    const currentTasks = getStoredTasks();
    const updatedTasks = currentTasks.filter((t) => String(t.id) !== String(taskId));
    saveStoredTasks(updatedTasks);

    try {
      await activeSprintClient.delete(`/tasks/${taskId}/`);
      return true;
    } catch (error) {
      console.warn(`[ActiveSprintApi] DELETE /tasks/${taskId}/ error:`, error.message);
      return true;
    }
  },

  /**
   * Add comment to task
   * POST /api/tasks/{taskId}/comments/
   */
  addComment: async (taskId, commentData) => {
    try {
      const response = await activeSprintClient.post(`/tasks/${taskId}/comments/`, commentData);
      return response.data;
    } catch (error) {
      console.warn(`[ActiveSprintApi] POST /tasks/${taskId}/comments/ error:`, error.message);
      return commentData;
    }
  },

  /**
   * Check backend database health
   * GET /api/health/ or /api/mongodb/check/
   */
  checkHealth: async () => {
    try {
      const response = await activeSprintClient.get('/health/', { timeout: 3000 });
      return {
        isConnected: true,
        message: response.data?.message || 'Database connected',
        status: response.status,
      };
    } catch (err) {
      return {
        isConnected: false,
        message: 'Backend server offline or preparing',
        status: err.response?.status || 0,
      };
    }
  },
};

export default activeSprintApi;
