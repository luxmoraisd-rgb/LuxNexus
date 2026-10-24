import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  CalendarDays,
  GitBranch,
  Mail,
  MessagesSquare,
  PlugZap,
  X,
} from "lucide-react";
import "./integrate.css";

const integrationItems = [
  { id: "github", name: "GitHub", Icon: GitBranch },
  { id: "gmail", name: "Gmail", Icon: Mail },
  { id: "google-calendar", name: "Google Calendar", Icon: CalendarDays },
  { id: "outlook", name: "Outlook", Icon: Briefcase },
  { id: "microsoft-teams", name: "Microsoft Teams", Icon: MessagesSquare },
];

const STORAGE_KEY = "nexus-integrations";

const readPersistedConnections = () => {
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
};

export default function IntegrateButton({ theme = "dark" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState(() => readPersistedConnections());
  const containerRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connectedIntegrations));
  }, [connectedIntegrations]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSelected(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleIntegrationSelect = (integration) => {
    setSelected(integration);
    setIsOpen(false);
  };

  const toggleConnection = () => {
    if (!selected) return;

    const connected = !!connectedIntegrations[selected.id];

    setConnectedIntegrations((previous) => ({
      ...previous,
      [selected.id]: !connected,
    }));
  };

  return (
    <>
      <div className="integrate-wrapper" data-theme={theme} ref={containerRef}>
        <button
          type="button"
          className="integrate-trigger"
          data-theme={theme}
          aria-label="Open integrations"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <PlugZap size={16} />
          <span>Integrate</span>
        </button>

        {isOpen && (
          <div className="integrate-dropdown" data-theme={theme} role="menu" aria-label="Integrations menu">
            {integrationItems.map(({ id, name, Icon }) => {
              const connected = !connectedIntegrations[id];
              return (
                <button
                  key={id}
                  type="button"
                  className="integrate-item"
                  data-theme={theme}
                  role="menuitem"
                  onClick={() => handleIntegrationSelect({ id, name, Icon, connected })}
                >
                  <span className="integrate-item-icon"><Icon size={16} /></span>
                  <span className="integrate-item-label">{name}</span>
                  <span className={`integrate-state ${connected ? "connected" : "not-connected"}`}>
                    {connected ? "Connected" : "Not Connected"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="integration-modal-overlay" data-theme={theme} onClick={() => setSelected(null)}>
            <div className="integration-modal" data-theme={theme} onClick={(event) => event.stopPropagation()}>
              <div className="integration-modal-header" data-theme={theme}>
                <div className="integration-modal-title-wrap">
                  <selected.Icon size={18} />
                  <h3>{selected.name}</h3>
                </div>
                <button type="button" className="integration-modal-close" onClick={() => setSelected(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="integration-modal-body" data-theme={theme}>
                <div className="integration-status-row">
                  <span className="integration-status-label">Status</span>
                  <span className={`integration-status-chip ${connectedIntegrations[selected.id] ? "connected" : "not-connected"}`}>
                    {connectedIntegrations[selected.id] ? "Connected" : "Not Connected"}
                  </span>
                </div>

                <p className="integration-copy">
                  {connectedIntegrations[selected.id]
                    ? `${selected.name} is connected and ready to sync.`
                    : `Connect ${selected.name} to start syncing updates and board activity.`}
                </p>
              </div>

              <div className="integration-modal-actions" data-theme={theme}>
                <button type="button" className="integration-cancel" onClick={() => setSelected(null)}>Close</button>
                <button
                  type="button"
                  className="integration-connect"
                  onClick={() => {
                    toggleConnection();
                    setSelected(null);
                  }}
                >
                  {connectedIntegrations[selected.id] ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
