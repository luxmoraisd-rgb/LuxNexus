import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

const shareOptions = [
  { key: "copy-link", label: "Copy link" },
  { key: "active-sprint", label: "Share active sprint" },
  { key: "current-task", label: "Share current task" },
  { key: "all-tasks", label: "Share all tasks" },
  { key: "user", label: "Share with user" },
];

const ShareButton = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
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

  const handleSelect = async (option) => {
    const url = `${window.location.origin}${window.location.pathname || "/"}`;
    if (option.key === "copy-link") {
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied");
      } catch {
        setMessage("Copy failed");
      }
    } else {
      setMessage(`${option.label} ready to share`);
    }

    setTimeout(() => setMessage(""), 1800);
    setOpen(false);
  };

  return (
    <div className="copy-link-wrapper" ref={ref}>
      <button type="button" className="task-header-action" onClick={() => setOpen((current) => !current)} aria-label="Share options">
        <Share2 size={15} />
        <span>Share</span>
      </button>

      {open && (
        <div className="task-header-popover share-popover" role="menu" aria-label="Share menu">
          {shareOptions.map((option) => (
            <button key={option.key} type="button" className="task-menu-item" onClick={() => handleSelect(option)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      {message && <div className="task-header-toast">{message}</div>}
    </div>
  );
};

export default ShareButton;
