import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nexus-task-custom-columns';
const CHANGE_EVENT = 'nexus:task-custom-columns-changed';

export const getCustomColumns = () => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((column) => typeof column === 'string') : [];
  } catch {
    return [];
  }
};

export const addCustomColumn = (columnName) => {
  const name = String(columnName || '').trim();
  const currentColumns = getCustomColumns();
  if (!name || currentColumns.some((column) => column.toLowerCase() === name.toLowerCase())) {
    return false;
  }

  const updatedColumns = [...currentColumns, name];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedColumns));
  } catch {
    // Keep the current view functional if storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: updatedColumns }));
  return true;
};

export const useCustomColumns = () => {
  const [customColumns, setCustomColumns] = useState(getCustomColumns);

  useEffect(() => {
    const handleColumnsChanged = (event) => {
      setCustomColumns(Array.isArray(event.detail) ? event.detail : getCustomColumns());
    };
    window.addEventListener(CHANGE_EVENT, handleColumnsChanged);
    return () => window.removeEventListener(CHANGE_EVENT, handleColumnsChanged);
  }, []);

  return customColumns;
};