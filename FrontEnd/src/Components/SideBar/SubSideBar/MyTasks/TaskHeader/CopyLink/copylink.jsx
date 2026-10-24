import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

const userLinks = [
  { id: 1, name: "Kishore", url: "https://nexusapp.local/users/kishore" },
  { id: 2, name: "Durga", url: "https://nexusapp.local/users/durga" },
  { id: 3, name: "Sugi", url: "https://nexusapp.local/users/sugi" },
  { id: 4, name: "Franklin", url: "https://nexusapp.local/users/franklin" },
  { id: 5, name: "Dhilip", url: "https://nexusapp.local/users/dhilip" },
];

const COPY_LINK_OPTIONS = [
  { key: "active-sprint", label: "Active sprint link" },
  { key: "all-sprints", label: "All sprint link" },
  { key: "current-task", label: "Current task link" },
  { key: "all-tasks", label: "All task link" },
  { key: "user-link", label: "User link" },
];

const buildUrl = (key) => {
  const pathname = window.location.pathname || "/";
  const base = `${window.location.origin}${pathname}`;

  switch (key) {
    case "active-sprint":
      return `${base}#active-sprint`;
    case "all-sprints":
      return `${base}#all-sprints`;
    case "current-task":
      return `${base}#current-task`;
    case "all-tasks":
      return `${base}#all-tasks`;
    default:
      return base;
  }
};

export default function CopyLinkButton() {
  const [open, setOpen] = useState(false);
  const [copiedText, setCopiedText] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedText(label);
      setTimeout(() => setCopiedText(""), 1800);
    } catch {
      setCopiedText("Copy failed");
      setTimeout(() => setCopiedText(""), 1800);
    }
  };

  const onSelect = async (optionKey) => {
    if (optionKey === "user-link") {
      setOpen(true);
      return;
    }

    await copyText(buildUrl(optionKey), "Link copied");
    setOpen(false);
  };

  return (
    <div className="copy-link-wrapper" ref={rootRef}>
      <button type="button" className="task-header-action" onClick={() => setOpen((current) => !current)} aria-label="Copy link options">
        <Link2 size={15} />
        <span>Copy link</span>
      </button>

      {open && (
        <div className="task-header-popover copy-link-popover" role="menu" aria-label="Copy link menu">
          {COPY_LINK_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="task-menu-item"
              onClick={() => onSelect(option.key)}
            >
              {option.label}
            </button>
          ))}

          {COPY_LINK_OPTIONS.some((option) => option.key === "user-link") && (
            <div className="user-link-section">
              <div className="user-link-label">User link</div>
              {userLinks.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="task-menu-item user-link-item"
                  onClick={async () => {
                    await copyText(user.url, `Copied ${user.name}`);
                    setOpen(false);
                  }}
                >
                  {user.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {copiedText && <div className="task-header-toast">{copiedText}</div>}
    </div>
  );
}
