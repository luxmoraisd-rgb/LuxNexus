import { useState, useEffect } from "react";
import Backlog from "./Backlog/Backlog";
import { STORAGE_KEYS } from "./Backlog/backlogApi";

const isValidSprint = (sprint) =>
  sprint &&
  typeof sprint === "object" &&
  !Array.isArray(sprint) &&
  (typeof sprint.id === "string" || typeof sprint.id === "number" || typeof sprint._id === "string") &&
  typeof sprint.name === "string" &&
  sprint.name.trim().length > 0;

const isValidTask = (task) =>
  task && typeof task === "object" && !Array.isArray(task);

function MyTasksScreen({ rolePermissions, currentUser }) {
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const savedSprints = localStorage.getItem(STORAGE_KEYS.SPRINTS);
      const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);

      if (savedSprints !== null) {
        let parsedSprints;
        try {
          parsedSprints = JSON.parse(savedSprints);
        } catch (error) {
          console.warn("[MyTasks] Saved sprint data is invalid and will be reset.", error);
        }

        const validSprints = Array.isArray(parsedSprints)
          ? parsedSprints.filter(isValidSprint)
          : [];
        if (!Array.isArray(parsedSprints) || validSprints.length !== parsedSprints.length) {
          console.warn("[MyTasks] Removing malformed saved sprint entries.");
          localStorage.setItem(STORAGE_KEYS.SPRINTS, JSON.stringify(validSprints));
        }
      }

      if (savedTasks !== null) {
        let parsedTasks;
        try {
          parsedTasks = JSON.parse(savedTasks);
        } catch (error) {
          console.warn("[MyTasks] Saved task data is invalid and will be reset.", error);
        }

        const validTasks = Array.isArray(parsedTasks)
          ? parsedTasks.filter(isValidTask)
          : [];
        if (!Array.isArray(parsedTasks) || validTasks.length !== parsedTasks.length) {
          console.warn("[MyTasks] Removing malformed saved task entries.");
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(validTasks));
        }
      }
    } catch (error) {
      console.error("[MyTasks] Unable to prepare saved board data.", error);
      setStorageError("My Tasks could not access saved board data. Check browser storage and try again.");
    }
  }, []);

  if (storageError) {
    return (
      <main role="alert">
        <p>{storageError}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <Backlog
      defaultTab="Kanban"
      rolePermissions={rolePermissions}
      currentUser={currentUser}
    />
  );
}

export default MyTasksScreen;
