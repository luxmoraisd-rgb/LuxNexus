import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { authClient } from "../../Auth/authApi";
import "./permission.css";

const Permission = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [permissionDefinitions, setPermissionDefinitions] = useState([]);
  const [roles, setRoles] = useState({});
  const [currentRole, setCurrentRole] = useState(currentUser?.role || "user");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const loadPermissions = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await authClient.get("/permissions/");
      const data = response.data;
      setPolicy(data.policies);
      setPermissionDefinitions(data.permissions);
      setRoles(data.roles);
      setCurrentRole(data.current_role || currentUser?.role || "user");
    } catch (loadError) {
      setError(loadError.response?.data?.detail || "Unable to load role permissions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openPermissions = () => {
    setIsOpen(true);
    void loadPermissions();
  };

  return (
    <>
      <button
        type="button"
        className="nav-icon-btn permission-nav-btn"
        aria-label="Permissions"
        title="Permissions"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={openPermissions}
      >
        <ShieldCheck size={20} />
      </button>

      {isOpen && (
        <div
          className="permission-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            className="permission-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-dialog-title"
          >
            <header className="permission-dialog-header">
              <div className="permission-dialog-title">
                <span className="permission-title-icon"><ShieldCheck size={19} /></span>
                <div>
                  <h2 id="permission-dialog-title">Role permissions</h2>
                  <p>Access is fixed by the workspace role policy.</p>
                </div>
              </div>
              <button
                type="button"
                className="permission-close-btn"
                aria-label="Close permissions"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="permission-current-role">
              <LockKeyhole size={15} />
              <span>Your role: <strong>{roles[currentRole] || currentRole}</strong></span>
              <span className="permission-readonly-label">Read only</span>
            </div>

            {error && <p className="permission-error" role="alert">{error}</p>}

            {isLoading ? (
              <div className="permission-loading" role="status">Loading permissions…</div>
            ) : policy ? (
              <div className="permission-table-wrap">
                <table className="permission-table">
                  <thead>
                    <tr>
                      <th scope="col">Permission</th>
                      {Object.entries(roles).map(([role, label]) => (
                        <th scope="col" key={role}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionDefinitions.map(({ key, label, description }) => (
                      <tr key={key}>
                        <th scope="row">
                          <span>{label}</span>
                          <small>{description}</small>
                        </th>
                        {Object.keys(roles).map((role) => {
                          const enabled = Boolean(policy[role]?.[key]);
                          return (
                            <td key={role}>
                              <span
                                className={`permission-toggle ${enabled ? "is-enabled" : ""}`}
                                role="img"
                                aria-label={`${label} for ${roles[role]}: ${enabled ? "enabled" : "disabled"}`}
                              >
                                <span />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !error ? (
              <div className="permission-loading" role="status">No permission data is available.</div>
            ) : null}

            <footer className="permission-dialog-footer">
              <button
                type="button"
                className="permission-secondary-btn"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
};

export default Permission;
