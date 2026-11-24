import axios from 'axios';
import { API_BASE_URL } from '../Backlog/backlogApi';
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
  return {
    id: String(id),
    name: rawSprint.name || '',
    status: rawSprint.status || (isStarted ? 'active' : isCompleted ? 'completed' : ''),
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
  const taskId = rawTask.task_key || rawTask.taskId || rawTask.key || '';
  let sprintId = rawTask.sprint?.id || rawTask.sprint_id || rawTask.sprintId || 'backlog';
  const owner = rawTask.owner?.id || rawTask.owner_id || rawTask.owner || '';
  const type = rawTask.task_type || rawTask.type || '';
  const sp = rawTask.estimated_sp ?? rawTask.sp ?? null;
  const status = rawTask.status || '';
  const dueDate = rawTask.dueDate || rawTask.due_date || '';

  if (isTaskPastDueAndIncomplete({ dueDate, status })) {
    sprintId = 'backlog';
  }

  return {
    id: String(id),
    taskId: String(taskId),
    title: rawTask.title || '',
    description: rawTask.description || '',
    status,
    type: String(type),
    sp: sp !== null && sp !== undefined ? Number(sp) : null,
    owner: typeof owner === 'object' ? (owner.name || owner.username || '') : String(owner),
    ownerDetails: typeof rawTask.owner === 'object' ? rawTask.owner : null,
    epic: rawTask.epic || '',
    sprintId: String(sprintId),
    commentsCount: Number(rawTask.comments_count ?? (Array.isArray(rawTask.comments) ? rawTask.comments.length : 0)),
    comments: Array.isArray(rawTask.comments) ? rawTask.comments : [],
    checklist: Array.isArray(rawTask.checklist) ? rawTask.checklist : [],
    dueDate,
    updatedAt: rawTask.updated_at || rawTask.updatedAt || '',
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
      if (error.response?.status !== 404) throw error;
    }

    return [];
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
      if (error.response?.status !== 404) throw error;
    }

    return [];
  },

  /**
   * Fetch capacity metadata for a sprint
   * GET /api/sprints/{sprintId}/capacity/
   */
  getCapacity: async (sprintId) => {
    const response = await activeSprintClient.get(`/sprints/${sprintId}/capacity/`);
    return response.data;
  },

  /**
   * Update capacity limit for a sprint
   * PUT /api/sprints/{sprintId}/capacity/
   */
  updateCapacity: async (sprintId, capacityLimit) => {
    const response = await activeSprintClient.put(`/sprints/${sprintId}/capacity/`, {
      capacity_limit: Number(capacityLimit),
    });
    return response.data;
  },

  /**
   * Update sprint dates
   * PUT /api/sprints/{sprintId}/dates/
   */
  updateDates: async (sprintId, { startDate, endDate, durationText }) => {
    const payload = {
      start_date: startDate || null,
      end_date: endDate || null,
      duration_text: durationText || '',
    };
    const response = await activeSprintClient.put(`/sprints/${sprintId}/dates/`, payload);
    return response.data;
  },

  /**
   * Update sprint goals
   * PUT /api/sprints/{sprintId}/goals/
   */
  updateGoals: async (sprintId, goals) => {
    const response = await activeSprintClient.put(`/sprints/${sprintId}/goals/`, {
      goals: goals || '',
    });
    return response.data;
  },

  /**
   * Start a sprint (transition to active status)
   * POST /api/sprints/{sprintId}/start/
   */
  startSprint: async (sprintId) => {
    const response = await activeSprintClient.post(`/sprints/${sprintId}/start/`);
    return response.data;
  },

  /**
   * Complete a sprint (transition to completed status)
   * POST /api/sprints/{sprintId}/complete/
   */
  completeSprint: async (sprintId) => {
    const response = await activeSprintClient.post(`/sprints/${sprintId}/complete/`);
    return response.data;
  },

  /**
   * Create task in active sprint
   * POST /api/tasks/
   */
  createTask: async (taskData) => {
    const payload = {
      title: taskData.title,
      task_key: taskData.taskId,
      sprint_id: taskData.sprintId,
      status: taskData.status || '',
      task_type: taskData.type || '',
      estimated_sp: taskData.sp !== null ? Number(taskData.sp) : null,
      epic: taskData.epic || '',
      description: taskData.description || '',
    };
    const response = await activeSprintClient.post('/tasks/', payload);
    const serverTask = response.data?.task || response.data?.data || response.data;
    if (!serverTask || !(serverTask.id || serverTask.pk)) {
      throw new Error('The task was created without a server identifier.');
    }
    return normalizeTask(serverTask);
  },

  /**
   * Update task details or status
   * PUT /api/tasks/{taskId}/
   */
  updateTask: async (taskId, updates) => {
    const payload = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.type !== undefined) payload.task_type = updates.type;
    if (updates.sp !== undefined) payload.estimated_sp = updates.sp;
    if (updates.epic !== undefined) payload.epic = updates.epic;
    if (updates.owner !== undefined) payload.owner = updates.owner;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.sprintId !== undefined) payload.sprint_id = updates.sprintId;

    const response = await activeSprintClient.put(`/tasks/${taskId}/`, payload);
    const serverTask = response.data?.task || response.data?.data || response.data;
    return normalizeTask({ ...updates, ...serverTask, id: String(taskId) });
  },

  /**
   * Delete task
   * DELETE /api/tasks/{taskId}/
   */
  deleteTask: async (taskId) => {
    await activeSprintClient.delete(`/tasks/${taskId}/`);
    return true;
  },

  /**
   * Add comment to task
   * POST /api/tasks/{taskId}/comments/
   */
  addComment: async (taskId, commentData) => {
    const response = await activeSprintClient.post(`/tasks/${taskId}/comments/`, commentData);
    return response.data;
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
