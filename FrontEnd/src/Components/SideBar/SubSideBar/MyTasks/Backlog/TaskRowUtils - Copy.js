export const STATUS_CONFIG = {
  'In Progress': { bg: '#ffab40', text: '#202124' },
  'Ready to start': { bg: '#0073ea', text: '#ffffff' },
  'In Review': { bg: '#a25ddc', text: '#ffffff' },
  'Done': { bg: '#00c875', text: '#ffffff' },
};

export const TYPE_CONFIG = {
  'Frontend': { bg: '#579bfc', text: '#ffffff' },
  'Backend': { bg: '#784bd1', text: '#ffffff' },
  'Feature': { bg: '#20d997', text: '#202124' },
  'Bug': { bg: '#e2445c', text: '#ffffff' },
  'Quality': { bg: '#f783ac', text: '#202124' },
};

export const TEAM_MEMBERS = [
  { id: 'sivakumar', name: 'Sivakumar', username: 'sivakumar', email: 'sivakumarluxmorchn@gmail.com', avatarBg: '#137333', initial: 'S', role: 'Frontend Lead' },
  { id: 'luxmor', name: 'Luxmor', username: 'luxmor', email: 'luxmorchn@gmail.com', avatarBg: '#7c3aed', initial: 'L', role: 'Project Admin' },
  { id: 'franklin', name: 'Franklin', username: 'franklin', email: 'franklin@gmail.com', avatarBg: '#059669', initial: 'F', role: 'Backend Engineer' },
  { id: 'jeeva', name: 'Jeeva', username: 'jeeva', email: 'jeeva@gmail.com', avatarBg: '#d97706', initial: 'J', role: 'QA Engineer' },
  { id: 'nexus_admin', name: 'Nexus Admin', username: 'nexus_admin', email: 'nexususer2026@test.com', avatarBg: '#dc2626', initial: 'N', role: 'System Admin' },
  { id: 'testuser', name: 'Test User', username: 'testuser', email: 'testuser@example.com', avatarBg: '#4b5563', initial: 'T', role: 'Tester' },
];


export const parseTaskId = (taskId) => {
  if (!taskId || typeof taskId !== 'string') return null;
  const match = taskId.trim().match(/^([A-Za-z0-9_-]+?)-(\d+)$/);
  if (match) {
    const rawDigits = match[2];
    return {
      prefix: match[1].toUpperCase(),
      num: parseInt(rawDigits, 10),
      rawDigits,
      isPadded: rawDigits.length > 1 && rawDigits.startsWith('0'),
      paddingLength: rawDigits.length,
    };
  }
  return null;
};

export const getNextJiraTaskId = (tasks = [], customPrefix = null, padDigits = true) => {
  let activePrefix = (customPrefix || '').trim().toUpperCase();
  if (!activePrefix) {
    for (let i = tasks.length - 1; i >= 0; i--) {
      const parsed = parseTaskId(tasks[i]?.taskId);
      if (parsed?.prefix) {
        activePrefix = parsed.prefix;
        break;
      }
    }
  }
  if (!activePrefix) activePrefix = 'LUX';

  const existingIds = new Set(
    tasks.map((task) => task?.taskId?.trim().toUpperCase()).filter(Boolean)
  );

  let maxNum = 0;
  let detectedPadding = padDigits;
  let padLen = 3;

  const regex = new RegExp(`^${activePrefix}-(\\d+)$`, 'i');
  tasks.forEach((task) => {
    if (task?.taskId) {
      const match = task.taskId.trim().match(regex);
      if (match) {
        const value = parseInt(match[1], 10);
        if (value > maxNum) {
          maxNum = value;
          if (match[1].length > 1 && match[1].startsWith('0')) {
            detectedPadding = true;
            padLen = match[1].length;
          }
        }
      }
    }
  });

  let nextNum = Math.max(maxNum + 1, 1);
  let candidate = detectedPadding
    ? `${activePrefix}-${String(nextNum).padStart(padLen, '0')}`
    : `${activePrefix}-${nextNum}`;

  while (existingIds.has(candidate)) {
    nextNum += 1;
    candidate = detectedPadding
      ? `${activePrefix}-${String(nextNum).padStart(padLen, '0')}`
      : `${activePrefix}-${nextNum}`;
  }

  return {
    taskId: candidate,
    prefix: activePrefix,
    number: nextNum,
    maxNum,
  };
};

export const generateUniqueTaskId = (tasks = [], prefix = 'LUX') => {
  return getNextJiraTaskId(tasks, prefix).taskId;
};

export const checkIsTaskIdUnique = (candidateId, tasks = [], currentTaskId = null) => {
  if (!candidateId || !candidateId.trim()) return false;
  const cleanCandidate = candidateId.trim().toUpperCase();
  return !tasks.some(
    (task) =>
      task.id !== currentTaskId &&
      task?.taskId?.trim().toUpperCase() === cleanCandidate
  );
};

export const createTaskId = () => Date.now();

/**
 * Check if a date string is in the past (before today at midnight)
 */
export const isPastDate = (dateVal) => {
  if (!dateVal) return false;
  let dateStr = typeof dateVal === 'string' ? dateVal.trim() : '';
  if (!dateStr && dateVal instanceof Date) {
    dateStr = dateVal.toISOString().slice(0, 10);
  }
  if (!dateStr) return false;

  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, day] = dateStr.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
};

/**
 * Check if a task status is considered incomplete (anything except 'Done')
 */
export const isTaskIncomplete = (status) => {
  if (!status) return true;
  return String(status).trim().toLowerCase() !== 'done';
};

/**
 * Jira & Monday.com style rule:
 * If a task's date is in the past and the task is still incomplete,
 * it automatically belongs to the Backlog.
 */
export const isTaskPastDueAndIncomplete = (task) => {
  if (!task) return false;
  if (!isTaskIncomplete(task.status)) return false;
  const dateVal = task.dueDate || task.due_date || task.endDate || task.end_date;
  return isPastDate(dateVal);
};
