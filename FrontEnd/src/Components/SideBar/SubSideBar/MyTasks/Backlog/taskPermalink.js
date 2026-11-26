export const getTaskPermalink = (taskKey) => {
  const normalizedTaskKey = String(taskKey || '').trim();
  if (!normalizedTaskKey) {
    throw new Error('A task ID is required to create a task link.');
  }

  return new URL(
    `/work/tasks/${encodeURIComponent(normalizedTaskKey)}`,
    window.location.origin
  ).toString();
};

export const copyTaskPermalink = async (taskKey) => {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable in this browser.');
  }

  const permalink = getTaskPermalink(taskKey);
  await navigator.clipboard.writeText(permalink);
  return permalink;
};
