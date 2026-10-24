import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Search, UserPlus, X } from "lucide-react";
import "./invite.css";

const STORAGE_KEY = "nexus-board-members";
const INVITATIONS_KEY = "nexus-invitations";

const defaultMembers = [
  { id: 1, name: "Franklin", email: "franklin@company.com", avatar: "F", role: "Product Lead", team: "Product", invitationStatus: "Accepted" },
  { id: 2, name: "Dhilip", email: "dhilip@company.com", avatar: "D", role: "Developer", team: "Engineering", invitationStatus: "Accepted" },
  { id: 3, name: "Sugi", email: "sugi@company.com", avatar: "S", role: "Designer", team: "Design", invitationStatus: "Accepted" },
  { id: 4, name: "Kishore", email: "kishore@company.com", avatar: "K", role: "QA Engineer", team: "Quality", invitationStatus: "Pending" },
  { id: 5, name: "Durga", email: "durga@company.com", avatar: "D", role: "Developer", team: "Engineering", invitationStatus: "Pending" },
  { id: 6, name: "Sakana", email: "sakana@company.com", avatar: "S", role: "Marketing", team: "Marketing", invitationStatus: "Pending" },
  { id: 7, name: "Haritha", email: "haritha@company.com", avatar: "H", role: "Project Manager", team: "Operations", invitationStatus: "Pending" },
  { id: 8, name: "Stuart", email: "stuart@company.com", avatar: "S", role: "Manager", team: "Product", invitationStatus: "Pending" },
  { id: 9, name: "Jones", email: "jones@company.com", avatar: "J", role: "Support Lead", team: "Support", invitationStatus: "Pending" },
];

const readPersisted = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export default function InviteButton({ theme = "dark" }) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusToast, setMemberStatusToast] = useState("");
  const [boardMembers, setBoardMembers] = useState(() => readPersisted(STORAGE_KEY, defaultMembers));
  const [invitedMembers, setInvitedMembers] = useState(() => readPersisted(INVITATIONS_KEY, []));
  const modalRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boardMembers));
  }, [boardMembers]);

  useEffect(() => {
    window.localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitedMembers));
  }, [invitedMembers]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsInviteModalOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!memberStatusToast) return undefined;
    const timeout = window.setTimeout(() => setMemberStatusToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [memberStatusToast]);

  const filteredMembers = useMemo(() => {
    const lower = memberSearch.trim().toLowerCase();
    if (!lower) {
      return defaultMembers;
    }

    return defaultMembers.filter((member) => {
      const haystack = `${member.name} ${member.email} ${member.team} ${member.role}`.toLowerCase();
      return haystack.includes(lower);
    });
  }, [memberSearch]);

  const toggleInvitation = (member) => {
    const existingInvitation = invitedMembers.find((person) => person.id === member.id);
    if (existingInvitation) return;

    const nextInvitation = { ...member, invitationStatus: "Pending" };
    setInvitedMembers((current) => [...current, nextInvitation]);
    setMemberStatusToast(`Invitation sent successfully to ${member.email}`);
  };

  const acceptInvitation = (memberId) => {
    const acceptedMember = invitedMembers.find((member) => member.id === memberId);
    if (!acceptedMember) return;

    setInvitedMembers((current) => current.filter((member) => member.id !== memberId));
    setBoardMembers((current) => {
      const equalsMember = current.some((member) => member.id === memberId);
      if (equalsMember) return current;
      return [...current, { ...acceptedMember, invitationStatus: "Accepted" }];
    });
    setMemberStatusToast(`Member added to board`);
  };

  const removeMember = (memberId) => {
    setBoardMembers((current) => current.filter((member) => member.id !== memberId));
  };

  return (
    <>
      <button
        type="button"
        className="invite-button"
        data-theme={theme}
        onClick={() => setIsInviteModalOpen(true)}
      >
        <UserPlus size={16} />
        <span>Invite</span>
      </button>

      {isInviteModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="invite-modal-overlay" data-theme={theme} onClick={() => setIsInviteModalOpen(false)}>
            <div
              ref={modalRef}
              className="invite-modal"
              data-theme={theme}
              role="dialog"
              aria-modal="true"
              aria-label="Invite to this board"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="invite-modal-header" data-theme={theme}>
                <h3>Invite to this board</h3>
                <button type="button" className="invite-close" onClick={() => setIsInviteModalOpen(false)} aria-label="Close invite modal">
                  <X size={18} />
                </button>
              </div>

              <div className="invite-modal-body" data-theme={theme}>
                <label className="invite-search-wrap">
                  <Search size={15} />
                  <input
                    type="text"
                    value={memberSearch}
                    placeholder="Search by name, team, or email address"
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />
                </label>

                <div className="invite-team-note">Anyone at <strong>Franklin's Team</strong> can access this board</div>

                <div className="invite-section-title">People invited to this board</div>

                <div className="invite-search-results">
                  {filteredMembers.length === 0 ? (
                    <div className="invite-empty-state">No members found</div>
                  ) : (
                    filteredMembers.map((member) => {
                      const invited = invitedMembers.some((person) => person.id === member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          className="invite-member-row"
                          onClick={() => (!invited ? toggleInvitation(member) : undefined)}
                        >
                          <div className="invite-member-avatar">{member.avatar}</div>
                          <div className="invite-member-meta">
                            <div className="invite-member-name-row">
                              <span className="invite-member-name">{member.name}</span>
                              {member.name === "Franklin" && <Crown size={14} className="invite-crown" />}
                            </div>
                            <div className="invite-member-email">{member.email}</div>
                            <div className="invite-member-role">{member.role}</div>
                          </div>
                          <div className="invite-member-action-box">
                            {invited ? "Pending" : "Invite"}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="invite-board-list">
                  <div className="invite-board-list-header">Board members</div>
                  {boardMembers.map((member) => (
                    <div key={member.id} className="invite-board-member-row">
                      <div className="invite-member-avatar">{member.avatar}</div>
                      <div className="invite-member-meta">
                        <div className="invite-member-name-row">
                          <span className="invite-member-name">{member.name}</span>
                          {member.name === "Franklin" && <Crown size={14} className="invite-crown" />}
                        </div>
                        <div className="invite-member-email">{member.email}</div>
                        <div className="invite-member-role">{member.role}</div>
                      </div>
                      <div className="invite-status-pill">{member.invitationStatus}</div>
                      <button type="button" className="invite-remove" aria-label={`Remove ${member.name}`} onClick={() => removeMember(member.id)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="invite-pending-title">Pending invitations</div>
                <div className="invite-pending-list">
                  {invitedMembers.length === 0 ? (
                    <div className="invite-empty-state small">No pending invitations</div>
                  ) : (
                    invitedMembers.map((member) => (
                      <div key={member.id} className="invite-pending-item">
                        <div className="invite-member-avatar">{member.avatar}</div>
                        <div className="invite-member-meta">
                          <div className="invite-member-name-row">
                            <span className="invite-member-name">{member.name}</span>
                          </div>
                          <div className="invite-member-email">{member.email}</div>
                        </div>
                        <button type="button" className="invite-accept-btn" onClick={() => acceptInvitation(member.id)}>
                          Accept
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="invite-modal-footer" data-theme={theme}>
                <button
                  type="button"
                  className="invite-footer-close-btn"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {memberStatusToast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="invite-toast" data-theme={theme}>{memberStatusToast}</div>,
          document.body
        )}
    </>
  );
}
