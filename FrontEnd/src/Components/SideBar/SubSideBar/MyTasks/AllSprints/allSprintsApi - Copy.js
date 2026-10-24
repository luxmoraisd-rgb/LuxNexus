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
 * Axios instance configured specifically for All Sprints operations
 */
export const allSprintsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Automatically inject Authorization Bearer token from sessionStorage or localStorage
allSprintsClient.interceptors.request.use(
  (config) => {
    try {
      const token =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('token') || localStorage.getItem('token')
          : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Normalizes sprint object between Backend Django/MongoDB and Frontend React state
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
    status: rawSprint.status || (isCompleted ? 'completed' : isStarted ? 'active' : 'future'),
    isStarted,
    isCompleted,
    dates,
    start_date: rawSprint.start_date || null,
    end_date: rawSprint.end_date || null,
    duration_text: dates,
    goals: rawSprint.goals || rawSprint.goal || '',
    goal: rawSprint.goals || rawSprint.goal || '',
    capacity_limit: Number(rawSprint.capacity_limit || rawSprint.capacity || 20),
    capacity: Number(rawSprint.capacity_limit || rawSprint.capacity || 20),
    order: Number(rawSprint.order ?? 0),
    total_sp: Number(rawSprint.total_sp ?? 0),
    issues_count: Number(rawSprint.issues_count ?? 0),
    isExpanded: rawSprint.isExpanded !== false,
    board_id: rawSprint.board?.id || rawSprint.board_id || null,
    tasks: Array.isArray(rawSprint.tasks) ? rawSprint.tasks.map(normalizeTask) : [],
  };
};

/**
 * Normalizes task object between Backend Django/MongoDB and Frontend React state
 */
export const normalizeTask = (rawTask) => {
  if (!rawTask) return null;
  const id = rawTask.id || rawTask._id || String(rawTask.pk || '');
  const taskId = rawTask.task_key || rawTask.taskId || rawTask.task_id || `LUX-${id}`;
  let sprintId = rawTask.sprint?.id || rawTask.sprint_id || rawTask.sprintId || 'backlog';
  const owner = rawTask.owner?.name || rawTask.owner?.username || rawTask.owner || 'Alex Rivera';
  const type = rawTask.task_type || rawTask.type || 'Feature';
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
    owner: typeof owner === 'object' ? (owner.name || owner.username || 'Alex Rivera') : String(owner),
    ownerDetails: typeof rawTask.owner === 'object' ? rawTask.owner : null,
    epic: rawTask.epic || '',
    sprintId: String(sprintId),
    commentsCount: Number(
      rawTask.comments_count ?? (Array.isArray(rawTask.comments) ? rawTask.comments.length : 0)
    ),
    comments: Array.isArray(rawTask.comments) ? rawTask.comments : [],
    checklist: Array.isArray(rawTask.checklist) ? rawTask.checklist : [],
    dueDate,
    updatedAt: rawTask.updated_at || rawTask.updatedAt || new Date().toISOString(),
  };
};

/**
 * Event broadcaster to synchronize changes across Backlog, Active Sprint, and All Sprints
 */
export const broadcastBacklogSync = (tasks, sprints) => {
  if (typeof window === 'undefined') return;
  if (Array.isArray(tasks)) {
    saveStoredTasks(tasks);
    window.dispatchEvent(new CustomEvent('nexus:backlog-tasks-changed', { detail: tasks }));
  }
  if (Array.isArray(sprints)) {
    saveStoredSprints(sprints);
    window.dispatchEvent(new CustomEvent('nexus:backlog-sprints-changed', { detail: sprints }));
  }
};

/**
 * All Sprints API Client
 */
export const allSprintsApi = {
  /**
   * Fetch All Sprints Overview with Aggregated Metrics & Sprints List
   * GET /api/all-sprints/
   * @param {Object} params - Query filters (e.g. { status, search })
   */
  getOverview: async (params = {}) => {
    try {
      const response = await allSprintsClient.get('/all-sprints/', { params });
      const data = response.data;
      if (data && typeof data === 'object') {
        const normalizedSprints = Array.isArray(data.sprints) ? data.sprints.map(normalizeSprint) : [];
        const normalizedTasks = Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : [];
        return {
          metrics: data.metrics || {
            total_sprints: normalizedSprints.length,
            active_sprints: normalizedSprints.filter((s) => s.isStarted).length,
            planned_sprints: normalizedSprints.filter((s) => !s.isStarted && !s.isCompleted).length,
            completed_sprints: normalizedSprints.filter((s) => s.isCompleted).length,
            total_sp: normalizedTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0),
          },
          sprints: normalizedSprints,
          tasks: normalizedTasks,
        };
      }
    } catch (error) {
      console.warn('[AllSprintsApi] GET /all-sprints/ error:', error.message);
    }

    // Fallback: load via standard sprints endpoint
    const fallbackSprints = await allSprintsApi.getAllSprints(params);
    const fallbackTasks = await allSprintsApi.getSprintTasks();
    return {
      metrics: {
        total_sprints: fallbackSprints.length,
        active_sprints: fallbackSprints.filter((s) => s.isStarted).length,
        planned_sprints: fallbackSprints.filter((s) => !s.isStarted && !s.isCompleted).length,
        completed_sprints: fallbackSprints.filter((s) => s.isCompleted).length,
        total_sp: fallbackTasks.reduce((sum, t) => sum + (Number(t.sp) || 0), 0),
      },
      sprints: fallbackSprints,
      tasks: fallbackTasks,
    };
  },

  /**
   * Fetch all sprints from backend database
   * GET /api/all-sprints/sprints/ or /api/sprints/
   */
  getAllSprints: async (params = {}) => {
    try {
      const response = await allSprintsClient.get('/sprints/', { params });
      const data = response.data?.sprints || response.data?.data || response.data;
      if (Array.isArray(data)) {
        return data.map(normalizeSprint);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn('[AllSprintsApi] GET /sprints/ error:', error.message);
      }
    }

    const inMem = getStoredSprints();
    return Array.isArray(inMem) ? inMem.map(normalizeSprint) : [];
  },

  /**
   * Fetch all tasks or tasks for a specific sprint
   * GET /api/tasks/?sprint=<sprintId>
   */
  getSprintTasks: async (sprintId = null) => {
    try {
      const params = sprintId ? { sprint: sprintId } : {};
      const response = await allSprintsClient.get('/tasks/', { params });
      const data = response.data?.tasks || response.data?.data || response.data;
      if (Array.isArray(data)) {
        return data.map(normalizeTask);
      }
    } catch (error) {
      console.warn('[AllSprintsApi] GET /tasks/ error:', error.message);
    }

    const inMem = getStoredTasks();
    if (!sprintId) return inMem.map(normalizeTask);
    return inMem.filter((t) => String(t.sprintId) === String(sprintId)).map(normalizeTask);
  },

  /**
   * Create a new sprint in the database
   * POST /api/sprints/
   */
  createSprint: async (sprintData) => {
    try {
      const payload = {
        name: sprintData.name || 'New Sprint',
        duration_text: sprintData.dates || sprintData.duration_text || 'Add Sprint dates',
        goals: sprintData.goals || sprintData.goal || '',
        capacity_limit: Number(sprintData.capacity_limit || sprintData.capacity || 20),
        status: sprintData.status || 'future',
      };
      const response = await allSprintsClient.post('/sprints/', payload);
      const created = normalizeSprint(response.data);

      const existing = getStoredSprints();
      const updated = [...existing, created];
      broadcastBacklogSync(null, updated);
      return created;
    } catch (error) {
      console.warn('[AllSprintsApi] POST /sprints/ error:', error.message);
      throw error;
    }
  },

  /**
   * Start a planned sprint
   * POST /api/sprints/:id/start/
   */
  startSprint: async (sprintId, sprintConfig = {}) => {
    const existing = getStoredSprints();
    const nextSprints = existing.map((s) =>
      String(s.id) === String(sprintId)
        ? { ...s, isStarted: true, isCompleted: false, status: 'active', ...sprintConfig }
        : s
    );
    broadcastBacklogSync(null, nextSprints);

    try {
      const response = await allSprintsClient.post(`/sprints/${sprintId}/start/`, sprintConfig);
      const updated = normalizeSprint(response.data);
      if (updated) {
        const synced = nextSprints.map((s) => (String(s.id) === String(sprintId) ? updated : s));
        broadcastBacklogSync(null, synced);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] POST /start/ warning (saved locally):', error.message);
    }
    return nextSprints.find((s) => String(s.id) === String(sprintId));
  },

  /**
   * Complete an active sprint
   * POST /api/sprints/:id/complete/
   */
  completeSprint: async (sprintId, completeConfig = {}) => {
    const existing = getStoredSprints();
    const nextSprints = existing.map((s) =>
      String(s.id) === String(sprintId)
        ? { ...s, isStarted: false, isCompleted: true, status: 'completed', ...completeConfig }
        : s
    );
    broadcastBacklogSync(null, nextSprints);

    try {
      const response = await allSprintsClient.post(`/sprints/${sprintId}/complete/`, completeConfig);
      const updated = normalizeSprint(response.data);
      if (updated) {
        const synced = nextSprints.map((s) => (String(s.id) === String(sprintId) ? updated : s));
        broadcastBacklogSync(null, synced);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] POST /complete/ warning (saved locally):', error.message);
    }
    return nextSprints.find((s) => String(s.id) === String(sprintId));
  },

  /**
   * Update Sprint Dates
   * PATCH /api/sprints/:id/dates/
   */
  updateSprintDates: async (sprintId, datesText) => {
    const existing = getStoredSprints();
    const nextSprints = existing.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, dates: datesText, durationText: datesText } : s
    );
    broadcastBacklogSync(null, nextSprints);

    try {
      const response = await allSprintsClient.patch(`/sprints/${sprintId}/dates/`, {
        dates: datesText,
        duration_text: datesText,
      });
      const updated = normalizeSprint(response.data);
      if (updated) {
        const synced = nextSprints.map((s) => (String(s.id) === String(sprintId) ? updated : s));
        broadcastBacklogSync(null, synced);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] PATCH /dates/ warning (saved locally):', error.message);
    }
    return nextSprints.find((s) => String(s.id) === String(sprintId));
  },

  /**
   * Update Sprint Goals
   * PATCH /api/sprints/:id/goals/
   */
  updateSprintGoals: async (sprintId, goalsText) => {
    const existing = getStoredSprints();
    const nextSprints = existing.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, goals: goalsText, goal: goalsText } : s
    );
    broadcastBacklogSync(null, nextSprints);

    try {
      const response = await allSprintsClient.patch(`/sprints/${sprintId}/goals/`, {
        goals: goalsText,
        goal: goalsText,
      });
      const updated = normalizeSprint(response.data);
      if (updated) {
        const synced = nextSprints.map((s) => (String(s.id) === String(sprintId) ? updated : s));
        broadcastBacklogSync(null, synced);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] PATCH /goals/ warning (saved locally):', error.message);
    }
    return nextSprints.find((s) => String(s.id) === String(sprintId));
  },

  /**
   * Update Sprint Capacity Limit
   * PATCH /api/sprints/:id/capacity/
   */
  updateSprintCapacity: async (sprintId, capacityLimit) => {
    const existing = getStoredSprints();
    const nextSprints = existing.map((s) =>
      String(s.id) === String(sprintId) ? { ...s, capacityLimit: Number(capacityLimit) } : s
    );
    broadcastBacklogSync(null, nextSprints);

    try {
      const response = await allSprintsClient.patch(`/sprints/${sprintId}/capacity/`, {
        capacity_limit: Number(capacityLimit),
      });
      const updated = normalizeSprint(response.data);
      if (updated) {
        const synced = nextSprints.map((s) => (String(s.id) === String(sprintId) ? updated : s));
        broadcastBacklogSync(null, synced);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] PATCH /capacity/ warning (saved locally):', error.message);
    }
    return nextSprints.find((s) => String(s.id) === String(sprintId));
  },

  /**
   * Create a new task in MongoDB
   * POST /api/tasks/
   */
  createTask: async (taskData) => {
    const normalized = normalizeTask({
      ...taskData,
      id: String(taskData.id || `task-${Date.now()}`),
      sprintId: String(taskData.sprintId || 'backlog'),
    });
    const existing = getStoredTasks();
    const nextTasks = [normalized, ...existing];
    broadcastBacklogSync(nextTasks, null);

    try {
      const payload = {
        title: taskData.title,
        status: taskData.status || 'Ready to start',
        task_type: taskData.type || taskData.task_type || 'Feature',
        estimated_sp: Number(taskData.sp || taskData.estimated_sp || 3),
        sprint_id: taskData.sprintId && taskData.sprintId !== 'backlog' ? taskData.sprintId : null,
        owner: taskData.owner || null,
        epic: taskData.epic || '',
        description: taskData.description || '',
      };
      const response = await allSprintsClient.post('/tasks/', payload);
      const created = normalizeTask(response.data);
      if (created) {
        const synced = nextTasks.map((t) => (t.id === normalized.id ? created : t));
        broadcastBacklogSync(synced, null);
        return created;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] POST /tasks/ warning (saved locally):', error.message);
    }
    return normalized;
  },

  /**
   * Update an existing task in MongoDB
   * PATCH /api/tasks/:id/
   */
  updateTask: async (taskId, updates) => {
    const existing = getStoredTasks();
    const nextTasks = existing.map((t) =>
      String(t.id) === String(taskId) ? { ...t, ...updates } : t
    );
    broadcastBacklogSync(nextTasks, null);

    try {
      const payload = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.type !== undefined) payload.task_type = updates.type;
      if (updates.task_type !== undefined) payload.task_type = updates.task_type;
      if (updates.sp !== undefined) payload.estimated_sp = Number(updates.sp);
      if (updates.estimated_sp !== undefined) payload.estimated_sp = Number(updates.estimated_sp);
      if (updates.owner !== undefined) payload.owner = updates.owner;
      if (updates.epic !== undefined) payload.epic = updates.epic;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.sprintId !== undefined) payload.sprint_id = updates.sprintId;

      const response = await allSprintsClient.patch(`/tasks/${taskId}/`, payload);
      const updated = normalizeTask(response.data);
      if (updated) {
        const synced = nextTasks.map((t) => (String(t.id) === String(taskId) ? updated : t));
        broadcastBacklogSync(synced, null);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] PATCH /tasks/ warning (saved locally):', error.message);
    }
    return nextTasks.find((t) => String(t.id) === String(taskId));
  },

  /**
   * Delete a task from MongoDB
   * DELETE /api/tasks/:id/
   */
  deleteTask: async (taskId) => {
    const existing = getStoredTasks();
    const nextTasks = existing.filter((t) => String(t.id) !== String(taskId));
    broadcastBacklogSync(nextTasks, null);

    try {
      await allSprintsClient.delete(`/tasks/${taskId}/`);
    } catch (error) {
      console.warn('[AllSprintsApi] DELETE /tasks/ warning (deleted locally):', error.message);
    }
    return true;
  },

  /**
   * Move task between sprints or to backlog
   * POST /api/tasks/:id/move/
   */
  moveTask: async (taskId, targetSprintId) => {
    const existing = getStoredTasks();
    const nextTasks = existing.map((t) =>
      String(t.id) === String(taskId) ? { ...t, sprintId: String(targetSprintId) } : t
    );
    broadcastBacklogSync(nextTasks, null);

    try {
      const response = await allSprintsClient.post(`/tasks/${taskId}/move/`, {
        sprint_id: targetSprintId && targetSprintId !== 'backlog' ? targetSprintId : null,
      });
      const updated = normalizeTask(response.data);
      if (updated) {
        const synced = nextTasks.map((t) => (String(t.id) === String(taskId) ? updated : t));
        broadcastBacklogSync(synced, null);
        return updated;
      }
    } catch (error) {
      console.warn('[AllSprintsApi] POST /move/ warning (moved locally):', error.message);
    }
    return nextTasks.find((t) => String(t.id) === String(taskId));
  },

  /**
   * Bulk action on multiple tasks
   * POST /api/tasks/batch/
   */
  batchUpdateTasks: async (taskIds, updates) => {
    try {
      const response = await allSprintsClient.post('/tasks/batch/', {
        task_ids: Array.from(taskIds),
        updates,
      });
      return response.data;
    } catch (error) {
      console.warn('[AllSprintsApi] POST /batch/ error:', error.message);
      throw error;
    }
  },
};

export default allSprintsApi;
