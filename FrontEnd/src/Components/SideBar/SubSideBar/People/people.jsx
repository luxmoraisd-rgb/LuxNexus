import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  MapPin,
  Phone,
  Briefcase,
  Layers,
  Clock,
  CheckCircle,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  Edit,
  Send,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import peopleApi from "./peopleApi";
import "./people.css";

export const PeoplePage = ({
  theme = "dark",
  currentUser,
  activeTab = "members",
  onTabChange,
}) => {
  const navigate = useNavigate();

  // Internal tab state synced with prop or fallback
  const sanitizeTab = (tab) => (tab === "workspace" ? "members" : tab || "members");
  const [currentTab, setCurrentTab] = useState(sanitizeTab(activeTab));
  useEffect(() => {
    if (activeTab) setCurrentTab(sanitizeTab(activeTab));
  }, [activeTab]);

  const handleTabSwitch = (tab) => {
    setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Data states
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState({
    totalMembers: 4,
    activeNow: 4,
    totalTeams: 4,
    pendingInvitations: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & display mode
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

  // Modals & Drawers
  const [selectedMember, setSelectedMember] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Resolve logged-in user from prop or sessionStorage
  const resolvedCurrentUser = useMemo(() => {
    if (currentUser && typeof currentUser === "object") return currentUser;
    try {
      const stored = sessionStorage.getItem("user");
      if (stored) return JSON.parse(stored);
    } catch {
      // Storage access safety
    }
    return null;
  }, [currentUser]);

  // Admin privileges: full visibility across all teams and squads
  const isAdmin = useMemo(() => {
    const role = (resolvedCurrentUser?.role || "").toLowerCase();
    return (
      role === "admin" ||
      resolvedCurrentUser?.isAdmin === true ||
      resolvedCurrentUser?.is_staff === true ||
      resolvedCurrentUser?.is_superuser === true
    );
  }, [resolvedCurrentUser]);

  // Current user's assigned team / squad
  const currentUserTeam = useMemo(() => {
    if (resolvedCurrentUser?.team) return resolvedCurrentUser.team;
    if (
      Array.isArray(resolvedCurrentUser?.teams) &&
      resolvedCurrentUser.teams.length > 0
    ) {
      return resolvedCurrentUser.teams[0];
    }
    // Match against loaded members
    if (resolvedCurrentUser && members.length > 0) {
      const selfInList = members.find(
        (m) =>
          (resolvedCurrentUser.id && m.id === resolvedCurrentUser.id) ||
          (resolvedCurrentUser.email &&
            m.email?.toLowerCase() ===
              resolvedCurrentUser.email?.toLowerCase()) ||
          (resolvedCurrentUser.username &&
            m.username?.toLowerCase() ===
              resolvedCurrentUser.username?.toLowerCase())
      );
      if (selfInList?.team) return selfInList.team;
    }
    return "Core Platform Engineering";
  }, [resolvedCurrentUser, members]);

  // Invite Form
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "user",
    department: "Engineering",
    team: "Frontend & UI Experience",
  });
  const [isInviting, setIsInviting] = useState(false);

  // Team Form
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    department: "Engineering",
    lead: "Team Lead",
    tags: "Full-Stack, Sprints",
  });
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch data with viewer credentials for team-level access control
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const viewerRole = isAdmin ? "admin" : (resolvedCurrentUser?.role || "user");
      const viewerTeam = currentUserTeam || "";
      const [membersData, teamsData, invitesData, statsData] =
        await Promise.all([
          peopleApi.getMembers({ viewer_role: viewerRole, viewer_team: viewerTeam }),
          peopleApi.getTeams(),
          peopleApi.getInvitations(),
          peopleApi.getStats(),
        ]);
      setMembers(membersData);
      setTeams(teamsData);
      setInvitations(invitesData);
      setStats(statsData);
    } catch (err) {
      console.warn("[PeoplePage] Error fetching data:", err);
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  // Filtered members with strict team isolation:
  // - Admin sees ALL members across all teams
  // - Non-admin only sees colleagues in their same squad (+ self)
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!isAdmin && currentUserTeam) {
        const memberTeam = m.team || (Array.isArray(m.teams) ? m.teams[0] : "");
        const memberTeams = Array.isArray(m.teams) ? m.teams : [memberTeam].filter(Boolean);
        const isSameTeam =
          (memberTeam && memberTeam.trim().toLowerCase() === currentUserTeam.trim().toLowerCase()) ||
          memberTeams.some(
            (t) => t && t.trim().toLowerCase() === currentUserTeam.trim().toLowerCase()
          );

        const isSelf =
          (resolvedCurrentUser?.id && m.id === resolvedCurrentUser.id) ||
          (resolvedCurrentUser?.email &&
            m.email?.toLowerCase() === resolvedCurrentUser.email?.toLowerCase()) ||
          (resolvedCurrentUser?.username &&
            m.username?.toLowerCase() === resolvedCurrentUser.username?.toLowerCase());

        if (!isSameTeam && !isSelf) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const corpus = `${m.name} ${m.username} ${m.email} ${m.jobTitle} ${m.department} ${m.team || ""} ${m.location}`.toLowerCase();
        if (!corpus.includes(q)) return false;
      }
      if (roleFilter !== "all" && m.role?.toLowerCase() !== roleFilter) {
        return false;
      }
      if (
        deptFilter !== "all" &&
        !m.department?.toLowerCase().includes(deptFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [members, isAdmin, currentUserTeam, resolvedCurrentUser, searchQuery, roleFilter, deptFilter]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set);
  }, [members]);

  // Handle Invite Submit
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) return;
    setIsInviting(true);
    try {
      const res = await peopleApi.sendInvitation(inviteForm);
      showToast(res.message || `Invitation sent to ${inviteForm.email}`);
      setShowInviteModal(false);
      setInviteForm({
        email: "",
        role: "user",
        department: "Engineering",
        team: "Frontend & UI Experience",
      });
      loadData(true);
    } catch (err) {
      showToast("Failed to send invitation. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Create Team Submit
  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return;
    setIsCreatingTeam(true);
    try {
      const payload = {
        ...teamForm,
        tags: teamForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      await peopleApi.createTeam(payload);
      showToast(`Team "${teamForm.name}" created successfully`);
      setShowTeamModal(false);
      setTeamForm({
        name: "",
        description: "",
        department: "Engineering",
        lead: "Team Lead",
        tags: "Full-Stack, Sprints",
      });
      loadData(true);
    } catch (err) {
      showToast("Failed to create team.");
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (email) => {
    try {
      await peopleApi.revokeInvitation(email);
      showToast(`Invitation for ${email} revoked`);
      setInvitations((prev) => prev.filter((i) => i.email !== email));
    } catch {
      showToast("Failed to revoke invitation");
    }
  };

  // Update member role
  const handleRoleChange = async (userId, newRole) => {
    try {
      await peopleApi.updateMember(userId, { role: newRole });
      showToast("Member role updated");
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
      if (selectedMember && selectedMember.id === userId) {
        setSelectedMember((prev) => ({ ...prev, role: newRole }));
      }
    } catch {
      showToast("Failed to update role");
    }
  };

  // Update member team assignment (admin only)
  const handleTeamChange = async (userId, newTeam) => {
    try {
      await peopleApi.updateMember(userId, { team: newTeam });
      showToast(`Assigned squad updated to "${newTeam}"`);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === userId ? { ...m, team: newTeam, teams: [newTeam] } : m
        )
      );
      if (selectedMember && selectedMember.id === userId) {
        setSelectedMember((prev) => ({ ...prev, team: newTeam, teams: [newTeam] }));
      }
    } catch {
      showToast("Failed to update squad assignment");
    }
  };

  return (
    <div className="people-page-root" data-theme={theme}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="people-toast">
          <CheckCircle size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================
         1. HERO HEADER
      ========================================================= */}
      <header className="people-header">
        <div className="people-title-group">
          <h1>
            <Users size={26} color="#6366f1" />
            <span>People & Teams</span>
          </h1>
          <p className="people-subtitle">
            Manage your organization directory, collaborate across squads, and invite teammates to Nexus.
          </p>
        </div>

        <div className="people-header-actions">
          <button
            type="button"
            className="people-btn people-btn-secondary"
            onClick={handleRefresh}
            title="Refresh directory"
          >
            <RefreshCw size={14} className={isRefreshing ? "spinning" : ""} />
            <span>Sync</span>
          </button>

          {currentTab === "teams" ? (
            <button
              type="button"
              className="people-btn people-btn-primary"
              onClick={() => setShowTeamModal(true)}
            >
              <Plus size={16} />
              <span>Create Team</span>
            </button>
          ) : (
            <button
              type="button"
              className="people-btn people-btn-primary"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus size={16} />
              <span>Invite Person</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
         2. STATS RIBBON
      ========================================================= */}
      <section className="people-stats-ribbon">
        <div className="stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}
          >
            <Users size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalMembers || members.length}</span>
            <span className="stat-label">Total Colleagues</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}
          >
            <CheckCircle size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.activeNow || members.length}</span>
            <span className="stat-label">Active on Platform</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}
          >
            <Layers size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalTeams || teams.length}</span>
            <span className="stat-label">Functional Teams</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(236, 72, 153, 0.12)", color: "#ec4899" }}
          >
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.pendingInvitations || invitations.length}</span>
            <span className="stat-label">Pending Invitations</span>
          </div>
        </div>
      </section>

      {/* =========================================================
         3. TABS NAVIGATION
      ========================================================= */}
      <nav className="people-nav-strip">
        <div className="people-tabs">
          <button
            type="button"
            className={`people-tab-btn ${currentTab === "members" ? "active" : ""}`}
            onClick={() => handleTabSwitch("members")}
          >
            <Users size={15} />
            <span>Directory ({members.length})</span>
          </button>

          <button
            type="button"
            className={`people-tab-btn ${currentTab === "teams" ? "active" : ""}`}
            onClick={() => handleTabSwitch("teams")}
          >
            <Layers size={15} />
            <span>Teams & Squads ({teams.length})</span>
          </button>

          <button
            type="button"
            className={`people-tab-btn ${currentTab === "invitations" ? "active" : ""}`}
            onClick={() => handleTabSwitch("invitations")}
          >
            <Mail size={15} />
            <span>Pending Invites ({invitations.length})</span>
          </button>
        </div>
      </nav>

      {/* =========================================================
         TAB 1: DIRECTORY (MEMBERS)
      ========================================================= */}
      {currentTab === "members" && (
        <div className="tab-pane-content">
          {/* Filter Bar */}
          <div className="people-filter-toolbar">
            <div className="people-search-box">
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                className="people-search-input"
                placeholder="Search colleagues by name, role, email, skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="people-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="team_lead">Team Lead</option>
              <option value="user">Member</option>
            </select>

            <select
              className="people-filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <div className="view-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={`mode-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Table List View"
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Scope indicator: Admin sees everyone; Non-Admin sees only their squad */}
          <div className={`people-scope-banner ${isAdmin ? "scope-admin" : "scope-team"}`}>
            <div className="scope-banner-content">
              {isAdmin ? (
                <>
                  <ShieldCheck size={16} className="scope-icon admin-icon" />
                  <span className="scope-text">
                    <strong>Admin Privileges:</strong> Full organization visibility enabled — showing all <strong>{filteredMembers.length}</strong> colleagues across all squads.
                  </span>
                </>
              ) : (
                <>
                  <Layers size={16} className="scope-icon team-icon" />
                  <span className="scope-text">
                    <strong>Team Scope:</strong> Showing <strong>{currentUserTeam}</strong> squad members only (<strong>{filteredMembers.length}</strong> {filteredMembers.length === 1 ? "colleague" : "colleagues"}). Other team members are restricted.
                  </span>
                </>
              )}
            </div>
            {isAdmin ? (
              <span className="admin-status-pill">All Members Visible</span>
            ) : (
              <span className="team-status-pill">Squad Only</span>
            )}
          </div>

          {/* Members List Display */}
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <Loader2 size={32} className="spinning" color="#6366f1" style={{ margin: "0 auto 12px auto" }} />
              <p>Loading directory from database...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <Users size={36} color="#94a3b8" style={{ margin: "0 auto 10px auto" }} />
              <h3>No team members match your filter</h3>
              <p>Try clearing your search query or role filter.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="members-grid">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="member-card"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="card-top-row">
                    <div className="card-avatar-wrap">
                      <div
                        className="card-avatar"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {member.avatar.length <= 2 ? member.avatar : member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="status-dot" />
                    </div>

                    <span className={`role-badge ${member.role}`}>
                      {member.role === "admin" ? "Admin" : member.role === "team_lead" ? "Lead" : "Member"}
                    </span>
                  </div>

                  <div className="card-identity">
                    <h3 className="card-name">{member.name}</h3>
                    <p className="card-title">{member.jobTitle}</p>
                  </div>

                  <div className="card-team-badge" title={`Team: ${member.team || "Core Platform Engineering"}`}>
                    <Layers size={12} className="team-badge-icon" />
                    <span className="team-badge-text">{member.team || "Core Platform Engineering"}</span>
                  </div>

                  <div className="card-meta-list">
                    <div className="meta-row">
                      <Mail size={13} />
                      <span>{member.email}</span>
                    </div>
                    <div className="meta-row">
                      <MapPin size={13} />
                      <span>{member.location}</span>
                    </div>
                  </div>

                  <div className="card-footer-stats">
                    <span className="footer-dept-tag">{member.department}</span>
                    <span className="footer-tasks-count">{member.tasksCount} Tasks</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="members-table-wrap">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Colleague</th>
                    <th>Team / Squad</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Tasks</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="table-person-cell">
                          <div
                            className="table-avatar"
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            {member.avatar.length <= 2 ? member.avatar : member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="table-person-meta">
                            <span className="table-name">{member.name}</span>
                            <span className="table-email">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-team-badge">
                          <Layers size={12} />
                          <span>{member.team || "Core Platform Engineering"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${member.role}`}>
                          {member.role === "admin" ? "Admin" : member.role === "team_lead" ? "Lead" : "Member"}
                        </span>
                      </td>
                      <td>{member.department}</td>
                      <td>{member.location}</td>
                      <td>
                        <span style={{ color: "#6366f1", fontWeight: 600 }}>
                          {member.tasksCount} active
                        </span>
                      </td>
                      <td style={{ color: "#94a3b8" }}>{member.joinedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
         TAB 2: TEAMS & SQUADS
      ========================================================= */}
      {currentTab === "teams" && (
        <div className="tab-pane-content">
          <div className="teams-grid">
            {teams.map((team) => (
              <div key={team.id} className="team-card">
                <div className="team-card-header">
                  <h3 className="team-name">{team.name}</h3>
                  <span className="footer-dept-tag">{team.department}</span>
                </div>
                <p className="team-desc">{team.description}</p>
                <div className="team-details-row">
                  <div>
                    <strong>Lead:</strong> {team.lead}
                  </div>
                  <div>
                    <strong>{team.memberCount} Members</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
         TAB 3: INVITATIONS
      ========================================================= */}
      {currentTab === "invitations" && (
        <div className="tab-pane-content">
          <div className="invitations-card-wrap">
            <div className="invite-banner">
              <div>
                <h3 style={{ margin: "0 0 4px 0" }}>Pending Team Invitations</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                  Invited teammates receive a secure invitation link to join the Nexus workspace.
                </p>
              </div>
              <button
                type="button"
                className="people-btn people-btn-primary"
                onClick={() => setShowInviteModal(true)}
              >
                <Plus size={15} />
                <span>Invite Member</span>
              </button>
            </div>

            {invitations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                <Mail size={32} color="#94a3b8" style={{ margin: "0 auto 10px auto" }} />
                <p>No pending invitations. All invited members have joined!</p>
              </div>
            ) : (
              <div className="invite-list">
                {invitations.map((inv) => (
                  <div key={inv.id || inv.email} className="invite-row">
                    <div className="invite-left">
                      <Mail size={18} color="#6366f1" />
                      <div>
                        <div className="invite-email">{inv.email}</div>
                        <div className="invite-meta">
                          Invited as {inv.role} • {inv.department} • {inv.expiresIn}
                        </div>
                      </div>
                    </div>

                    <div className="invite-actions">
                      <button
                        type="button"
                        className="revoke-btn"
                        onClick={() => handleRevokeInvite(inv.email)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* =========================================================
         MEMBER DETAIL DRAWER / MODAL
      ========================================================= */}
      {selectedMember && (
        <div
          className="people-modal-backdrop"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="people-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div className="people-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  className="table-avatar"
                  style={{
                    backgroundColor: selectedMember.avatarColor,
                    width: 44,
                    height: 44,
                    fontSize: 16,
                  }}
                >
                  {selectedMember.avatar.length <= 2 ? selectedMember.avatar : selectedMember.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedMember.name}</h3>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {selectedMember.jobTitle}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="people-modal-close"
                onClick={() => setSelectedMember(null)}
              >
                ×
              </button>
            </div>

            <div className="people-modal-body">
              <div className="form-group">
                <label>About</label>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                  {selectedMember.bio}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label>Email</label>
                  <span style={{ fontSize: 13 }}>{selectedMember.email}</span>
                </div>
                <div className="form-group">
                  <label>Assigned Squad / Team</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#818cf8", fontWeight: 600, fontSize: 13 }}>
                    <Layers size={14} />
                    <span>{selectedMember.team || "Core Platform Engineering"}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <span style={{ fontSize: 13 }}>{selectedMember.department}</span>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <span style={{ fontSize: 13 }}>{selectedMember.location}</span>
                </div>
                <div className="form-group">
                  <label>Member Since</label>
                  <span style={{ fontSize: 13 }}>{selectedMember.joinedDate}</span>
                </div>
                <div className="form-group">
                  <label>Active Work</label>
                  <span style={{ fontSize: 13 }}>{selectedMember.tasksCount} Active Tasks</span>
                </div>
              </div>

              {isAdmin ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                  <div className="form-group">
                    <label>Workspace Role (Permissions)</label>
                    <select
                      className="form-control"
                      value={selectedMember.role}
                      onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                    >
                      <option value="admin">Admin (Full Workspace Permissions)</option>
                      <option value="team_lead">Team Lead (Sprint & Task Manager)</option>
                      <option value="user">Member (Standard Contributor)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Reassign Squad / Team</label>
                    <select
                      className="form-control"
                      value={selectedMember.team || "Frontend & UI Experience"}
                      onChange={(e) => handleTeamChange(selectedMember.id, e.target.value)}
                    >
                      <option value="Frontend & UI Experience">Frontend & UI Experience</option>
                      <option value="Core Platform Engineering">Core Platform Engineering</option>
                      <option value="DevOps & Cloud Reliability">DevOps & Cloud Reliability</option>
                      <option value="Product Strategy & Agile Operations">Product Strategy & Agile Operations</option>
                      {teams.map((t) => (
                        !["Frontend & UI Experience", "Core Platform Engineering", "DevOps & Cloud Reliability", "Product Strategy & Agile Operations"].includes(t.name) ? (
                          <option key={t.id || t.name} value={t.name}>{t.name}</option>
                        ) : null
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Assigned Role</label>
                  <span style={{ fontSize: 13, textTransform: "capitalize", fontWeight: 600 }}>{selectedMember.role}</span>
                </div>
              )}
            </div>

            <div className="people-modal-footer">
              <button
                type="button"
                className="people-btn people-btn-primary"
                onClick={() => {
                  setSelectedMember(null);
                  navigate("/work/inbox");
                }}
              >
                <Send size={14} />
                <span>Send Message</span>
              </button>
              <button
                type="button"
                className="people-btn people-btn-secondary"
                onClick={() => setSelectedMember(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
         INVITE PERSON MODAL
      ========================================================= */}
      {showInviteModal && (
        <div
          className="people-modal-backdrop"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="people-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="people-modal-header">
              <h3>Invite Colleague to Nexus</h3>
              <button
                type="button"
                className="people-modal-close"
                onClick={() => setShowInviteModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleInviteSubmit}>
              <div className="people-modal-body">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="colleague@nexusapp.io"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Workspace Role</label>
                  <select
                    className="form-control"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value })
                    }
                  >
                    <option value="user">Member (Standard Contributor)</option>
                    <option value="team_lead">Team Lead (Sprint Manager)</option>
                    <option value="admin">Admin (Organization Lead)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Assign to Team / Squad</label>
                  <select
                    className="form-control"
                    value={inviteForm.team}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, team: e.target.value })
                    }
                  >
                    <option value="Frontend & UI Experience">Frontend & UI Experience</option>
                    <option value="Core Platform Engineering">Core Platform Engineering</option>
                    <option value="DevOps & Cloud Reliability">DevOps & Cloud Reliability</option>
                    <option value="Product Strategy & Agile Operations">Product Strategy & Agile Operations</option>
                    {teams.map((t) => (
                      !["Frontend & UI Experience", "Core Platform Engineering", "DevOps & Cloud Reliability", "Product Strategy & Agile Operations"].includes(t.name) ? (
                        <option key={t.id || t.name} value={t.name}>{t.name}</option>
                      ) : null
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Department / Function</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Engineering, Design, DevOps..."
                    value={inviteForm.department}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        department: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="people-modal-footer">
                <button
                  type="button"
                  className="people-btn people-btn-secondary"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="people-btn people-btn-primary"
                >
                  {isInviting ? (
                    <Loader2 size={14} className="spinning" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  <span>Send Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         CREATE TEAM MODAL
      ========================================================= */}
      {showTeamModal && (
        <div
          className="people-modal-backdrop"
          onClick={() => setShowTeamModal(false)}
        >
          <div
            className="people-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="people-modal-header">
              <h3>Create New Team / Squad</h3>
              <button
                type="button"
                className="people-modal-close"
                onClick={() => setShowTeamModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTeamSubmit}>
              <div className="people-modal-body">
                <div className="form-group">
                  <label>Team Name</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Mobile Engineering, Growth Squad"
                    value={teamForm.name}
                    onChange={(e) =>
                      setTeamForm({ ...teamForm, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Mission / Description</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="What does this squad focus on?"
                    value={teamForm.description}
                    onChange={(e) =>
                      setTeamForm({ ...teamForm, description: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teamForm.department}
                      onChange={(e) =>
                        setTeamForm({ ...teamForm, department: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Team Lead</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teamForm.lead}
                      onChange={(e) =>
                        setTeamForm({ ...teamForm, lead: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tags (comma separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="React, Backend, Sprints"
                    value={teamForm.tags}
                    onChange={(e) =>
                      setTeamForm({ ...teamForm, tags: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="people-modal-footer">
                <button
                  type="button"
                  className="people-btn people-btn-secondary"
                  onClick={() => setShowTeamModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeam}
                  className="people-btn people-btn-primary"
                >
                  {isCreatingTeam ? (
                    <Loader2 size={14} className="spinning" />
                  ) : (
                    <Plus size={14} />
                  )}
                  <span>Create Team</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeoplePage;
