import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
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
  AlertCircle,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  Edit,
  Send,
  Reply,
  Forward,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import peopleApi from "./peopleApi";
import "./people.css";

const getInvitationExpiryLabel = (expiresAt, currentDate) => {
  const expirationDate = new Date(expiresAt);
  if (Number.isNaN(expirationDate.getTime())) return null;

  const expirationDay = Date.UTC(
    expirationDate.getFullYear(),
    expirationDate.getMonth(),
    expirationDate.getDate()
  );
  const today = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const daysLeft = Math.max(0, Math.round((expirationDay - today) / 86400000) - 1);
  return daysLeft > 0 ? `${daysLeft} days left` : "Expiring soon";
};

const getInvitationMailto = (invitation, action) => {
  const isReply = action === "reply";
  const subject = isReply
    ? "Re: Nexus workspace invitation"
    : "Fwd: Nexus workspace invitation";
  const body = isReply
    ? "Hi,\n\nI'm following up regarding your Nexus workspace invitation.\n\n"
    : [
        "Nexus workspace invitation details:",
        `Email: ${invitation.email || "Not available"}`,
        `Role: ${invitation.role || "Member"}`,
        `Department: ${invitation.department || "Not specified"}`,
        `Teams / Squads: ${getMemberTeams(invitation).join(", ") || "None"}`,
        `Status: ${invitation.status || "Pending"}`,
        `Sent on: ${invitation.createdAt || "Not available"}`,
        `Expires on: ${invitation.expiresAt || invitation.expiresIn || "Not available"}`,
      ].join("\n");
  const query = new URLSearchParams({ subject, body });
  const recipient = isReply ? invitation.email : "";
  return `mailto:${recipient}?${query.toString()}`;
};

const getMemberTeams = (member) =>
  Array.isArray(member?.teams) ? member.teams : member?.team ? [member.team] : [];

const INVITE_DEPARTMENT_OPTIONS = [
  "Engineering",
  "Software Developer",
  "Software Testing",
  "Data Analyst",
  "Senior Process Executive",
  "Front End Developer",
  "QA Automation",
  "Full Stack Developer",
  "Team Lead",
  "Business Analyst",
  "Python Developer",
];

const TEAM_DEPARTMENT_OPTIONS = [
  { value: "Frontend", label: "Frontend" },
  { value: "Backend", label: "Backend" },
  { value: "Data Analyst", label: "Data Analyst" },
  { value: "DevOps", label: "DevOps" },
  { value: "Engineering", label: "Engineering" },
];

const TEAM_ROLE_OPTIONS = [
  { value: "Team Lead", label: "Team Lead" },
  { value: "Developer", label: "Developer" },
  { value: "Admin", label: "Admin" },
];

const createEmptyInviteForm = () => ({
  email: "",
  role: "user",
  department: "",
  teams: [],
});

const isValidInviteEmail = (email) => {
  const normalizedEmail = email.trim();
  const [localPart] = normalizedEmail.split("@");
  return (
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(gmail\.com|gmaail\.com)$/i.test(
      normalizedEmail
    ) &&
    !localPart.startsWith(".") &&
    !localPart.endsWith(".") &&
    !localPart.includes("..")
  );
};

const TeamMultiSelect = ({ options, value, onChange, ariaLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedNames = value
    .map((name) => options.find((team) => team.name === name)?.name || name)
    .join(", ");

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleOptionKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, options.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      menuRef.current
        ?.querySelectorAll('[role="option"]')
        [nextIndex]?.focus();
    }
  };

  const toggleTeam = (teamName) => {
    onChange(
      value.includes(teamName)
        ? value.filter((name) => name !== teamName)
        : [...value, teamName]
    );
    closeMenu();
  };

  return (
    <div className="people-scroll-select" ref={containerRef}>
      <button
        type="button"
        className="form-control people-scroll-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
      >
        <span className="people-multiselect-trigger-label">
          {selectedNames || "Select teams or squads"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          className="people-scroll-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable="true"
          ref={menuRef}
        >
          {options.map((team, index) => {
            const isSelected = value.includes(team.name);
            return (
              <button
                type="button"
                className="people-scroll-select-option people-multiselect-option"
                role="option"
                aria-selected={isSelected}
                key={team.id || team.name}
                onClick={() => toggleTeam(team.name)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span
                  className="people-multiselect-check"
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span>{team.name}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div className="people-scroll-select-option">
              No teams or squads available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ScrollableSelect = ({
  ariaLabel,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  showCheckmark = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return undefined;

    menuRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.focus();

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleOptionKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, options.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      const optionElements = menuRef.current?.querySelectorAll('[role="option"]');
      optionElements?.[nextIndex]?.focus();
    }
  };

  return (
    <div className="people-scroll-select" ref={containerRef}>
      <button
        type="button"
        className="form-control people-scroll-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          className="people-scroll-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          ref={menuRef}
        >
          {options.map((option, index) => (
            <button
              type="button"
              className={`people-scroll-select-option ${showCheckmark ? "people-scroll-select-check-option" : ""}`}
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                closeMenu();
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              {showCheckmark && (
                <span
                  className="people-select-checkmark"
                  aria-hidden="true"
                >
                  {option.value === value ? "✓" : ""}
                </span>
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const PeoplePage = ({
  theme = "dark",
  currentUser,
  activeTab = "members",
  onTabChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const sanitizeTab = (tab) => (tab === "workspace" ? "members" : tab || "members");
  const [internalTab, setInternalTab] = useState(sanitizeTab(activeTab));
  const currentTab = onTabChange ? sanitizeTab(activeTab) : internalTab;

  const handleTabSwitch = (tab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
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
  const [countdownDate, setCountdownDate] = useState(() => new Date());

  // Filters & display mode
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [departmentMenuOpen, setDepartmentMenuOpen] = useState(false);
  const roleMenuRef = useRef(null);
  const departmentMenuRef = useRef(null);

  // Modals & Drawers
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("success");

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
  const [inviteForm, setInviteForm] = useState(createEmptyInviteForm);
  const [isInviting, setIsInviting] = useState(false);

  // Team Form
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    department: "Engineering",
    role: "Team Lead",
    tags: "Full-Stack, Sprints",
  });
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch data with viewer credentials for team-level access control
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const viewerRole = isAdmin ? "admin" : (resolvedCurrentUser?.role || "user");
      const viewerTeam = currentUserTeam || "";
      const results = await Promise.allSettled([
        peopleApi.getMembers({ viewer_role: viewerRole, viewer_team: viewerTeam }),
        peopleApi.getTeams(),
        peopleApi.getInvitations(),
        peopleApi.getStats(),
      ]);
      const failedRequests = [];
      const [membersResult, teamsResult, invitesResult, statsResult] = results;

      if (membersResult.status === "fulfilled") {
        setMembers(membersResult.value);
      } else {
        failedRequests.push("directory");
        console.warn("[PeoplePage] Error fetching members:", membersResult.reason);
      }

      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value);
      } else {
        failedRequests.push("teams");
        console.warn("[PeoplePage] Error fetching teams:", teamsResult.reason);
      }

      if (invitesResult.status === "fulfilled") {
        setInvitations(invitesResult.value);
      } else {
        failedRequests.push("invitations");
        console.warn("[PeoplePage] Error fetching invitations:", invitesResult.reason);
      }

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      } else {
        failedRequests.push("stats");
        console.warn("[PeoplePage] Error fetching stats:", statsResult.reason);
      }

      if (failedRequests.length > 0) {
        showToast(
          `Sync incomplete. Could not refresh: ${failedRequests.join(", ")}.`,
          "error"
        );
      } else if (silent) {
        showToast("People data synced successfully.");
      }
    } catch (err) {
      console.warn("[PeoplePage] Error fetching data:", err);
      showToast("Unable to sync people data. Please try again.", "error");
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const teamId = new URLSearchParams(location.search).get("team");
    if (!teamId) {
      setSelectedTeam(null);
      return;
    }

    const team = teams.find((item) => item.id === teamId);
    if (team) setSelectedTeam(team);
  }, [location.search, teams]);

  useEffect(() => {
    if (!roleMenuOpen) return undefined;

    const closeRoleMenu = (event) => {
      if (!roleMenuRef.current?.contains(event.target)) {
        setRoleMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeRoleMenu);
    return () => document.removeEventListener("mousedown", closeRoleMenu);
  }, [roleMenuOpen]);

  useEffect(() => {
    if (!departmentMenuOpen) return undefined;

    const closeDepartmentMenu = (event) => {
      if (!departmentMenuRef.current?.contains(event.target)) {
        setDepartmentMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeDepartmentMenu);
    return () => document.removeEventListener("mousedown", closeDepartmentMenu);
  }, [departmentMenuOpen]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(
      () => setCountdownDate(new Date()),
      nextMidnight.getTime() - now.getTime()
    );
    return () => clearTimeout(timer);
  }, [countdownDate]);

  const handleRefresh = () => {
    if (isRefreshing || isLoading) return;
    setIsRefreshing(true);
    loadData(true);
  };

  const openMemberSummary = (status = "all") => {
    setSearchQuery("");
    setRoleFilter("all");
    setDeptFilter("all");
    setMemberStatusFilter(status);
    handleTabSwitch("members");
  };

  const openTeamsSummary = () => {
    setSelectedTeam(null);
    handleTabSwitch("teams");
    if (location.pathname === "/people/teams" && location.search) {
      navigate("/people/teams", { replace: true });
    }
  };

  const openTeamDetails = (team) => {
    setSelectedTeam(team);
    navigate(`/people/teams?team=${encodeURIComponent(team.id)}`, {
      state: { fromTeamList: true },
    });
  };

  const returnToTeamList = () => {
    if (location.state?.fromTeamList) {
      navigate(-1);
      return;
    }
    navigate("/people/teams", { replace: true });
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
        const corpus = `${m.name} ${m.username} ${m.email} ${m.jobTitle} ${m.department} ${getMemberTeams(m).join(" ")} ${m.location}`.toLowerCase();
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
      if (
        memberStatusFilter !== "all" &&
        m.status?.toLowerCase() !== memberStatusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    members,
    isAdmin,
    currentUserTeam,
    resolvedCurrentUser,
    searchQuery,
    roleFilter,
    deptFilter,
    memberStatusFilter,
  ]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set();
    INVITE_DEPARTMENT_OPTIONS.forEach((department) => set.add(department));
    members.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set);
  }, [members]);

  const resetInviteForm = () => setInviteForm(createEmptyInviteForm());
  const openInviteModal = () => {
    resetInviteForm();
    setShowInviteModal(true);
  };
  const closeInviteModal = () => {
    setShowInviteModal(false);
    resetInviteForm();
  };

  // Handle Invite Submit
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) return;
    if (!isValidInviteEmail(inviteForm.email)) {
      showToast("Invalid Email");
      return;
    }
    if (inviteForm.teams.length === 0) {
      showToast("Select at least one team or squad before sending the invitation.");
      return;
    }
    if (!inviteForm.department) {
      showToast("Select a department before sending the invitation.");
      return;
    }
    setIsInviting(true);
    try {
      const res = await peopleApi.sendInvitation(inviteForm);
      showToast(res.message || `Invitation sent to ${inviteForm.email}`);
      const sentInvitation = {
        ...res,
        email: res.email || inviteForm.email.trim().toLowerCase(),
        createdAt:
          res.createdAt ||
          new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
      };
      const alreadyListed = invitations.some(
        (invitation) => invitation.email?.toLowerCase() === sentInvitation.email.toLowerCase()
      );
      setInvitations((current) => [
        sentInvitation,
        ...current.filter(
          (invitation) => invitation.email?.toLowerCase() !== sentInvitation.email.toLowerCase()
        ),
      ]);
      if (!alreadyListed) {
        setStats((current) => ({
          ...current,
          pendingInvitations: (current.pendingInvitations ?? invitations.length) + 1,
        }));
      }
      closeInviteModal();
      handleTabSwitch("invitations");
    } catch (err) {
      showToast(
        err.response?.data?.error ||
          err.response?.data?.teams?.[0] ||
          "Failed to send invitation. Please try again."
      );
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Create Team Submit
  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return;
    if (teamForm.name.includes("@")) {
      showToast("Email addresses are not allowed in team names.");
      return;
    }
    setIsCreatingTeam(true);
    try {
      const payload = {
        ...teamForm,
        tags: teamForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const savedTeam = editingTeam
        ? await peopleApi.updateTeam(editingTeam.id, payload)
        : await peopleApi.createTeam(payload);
      if (editingTeam) {
        setSelectedTeam((currentTeam) =>
          currentTeam?.id === editingTeam.id
            ? { ...currentTeam, ...savedTeam }
            : currentTeam
        );
        setTeams((currentTeams) =>
          currentTeams.map((team) =>
            team.id === editingTeam.id ? { ...team, ...savedTeam } : team
          )
        );
      }
      showToast(
        editingTeam
          ? `Team "${savedTeam.name}" updated successfully`
          : `Team "${teamForm.name}" created successfully`
      );
      setShowTeamModal(false);
      setEditingTeam(null);
      setTeamForm({
        name: "",
        description: "",
        department: "Engineering",
        role: "Team Lead",
        tags: "Full-Stack, Sprints",
      });
      loadData(true);
    } catch (err) {
      showToast(
        err.response?.data?.error ||
          (editingTeam ? "Failed to update team." : "Failed to create team.")
      );
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const openTeamModal = (team = null) => {
    setEditingTeam(team);
    setTeamForm({
      name: team?.name || "",
      description: team?.description || "",
      department: team?.department || "Engineering",
      role: team?.role || "Team Lead",
      tags: Array.isArray(team?.tags)
        ? team.tags.join(", ")
        : "Full-Stack, Sprints",
    });
    setShowTeamModal(true);
  };

  const closeTeamModal = () => {
    setShowTeamModal(false);
    setEditingTeam(null);
  };

  const handleTeamModalKeyDown = (event) => {
    if (event.key !== "Tab") return;

    const focusableElements = event.currentTarget.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (email) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }

    try {
      const response = await peopleApi.revokeInvitation(email);
      showToast(`Invitation for ${email} revoked`);
      setInvitations((prev) => prev.filter((i) => i.email !== email));
      if (Number.isFinite(response?.pendingInvitations)) {
        setStats((prev) => ({
          ...prev,
          pendingInvitations: response.pendingInvitations,
        }));
      }
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

  const openMemberDetails = (member) => {
    setSelectedMember(member);
    setSelectedTeams(getMemberTeams(member));
  };

  // Update member team assignment (admin only)
  const handleTeamChange = async (userId) => {
    setIsSavingTeams(true);
    try {
      const updatedMember = await peopleApi.updateMember(userId, {
        teams: selectedTeams,
      });
      setMembers((prev) =>
        prev.map((member) =>
          member.id === userId ? { ...member, ...updatedMember } : member
        )
      );
      setSelectedMember((prev) =>
        prev?.id === userId ? { ...prev, ...updatedMember } : prev
      );
      showToast("Team and squad assignments updated");
    } catch (error) {
      showToast(
        error.response?.data?.teams?.[0] || "Failed to update assignments"
      );
    } finally {
      setIsSavingTeams(false);
    }
  };

  return (
    <div className="people-page-root" data-theme={theme}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`people-toast ${toastType === "error" ? "error" : ""}`}>
          {toastType === "error" ? (
            <AlertCircle size={16} color="#ef4444" />
          ) : (
            <CheckCircle size={16} color="#10b981" />
          )}
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
            disabled={isLoading || isRefreshing}
            aria-busy={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? "spinning" : ""} />
            <span>Sync</span>
          </button>

          {currentTab === "teams" ? (
            <button
              type="button"
              className="people-btn people-btn-primary"
              onClick={() => openTeamModal()}
            >
              <Plus size={16} />
              <span>Create Team</span>
            </button>
          ) : (
            <button
              type="button"
              className="people-btn people-btn-primary"
              onClick={openInviteModal}
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
        <button
          type="button"
          className="stat-card people-stat-card-button"
          onClick={() => openMemberSummary()}
          aria-label="Open directory showing all colleagues"
        >
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
        </button>

        <button
          type="button"
          className="stat-card people-stat-card-button"
          onClick={() => openMemberSummary("active")}
          aria-label="Open directory showing active colleagues"
        >
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
        </button>

        <button
          type="button"
          className="stat-card people-stat-card-button"
          onClick={openTeamsSummary}
          aria-label="Open teams and squads"
        >
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
        </button>

        <button
          type="button"
          className="stat-card people-stat-card-button"
          onClick={() => handleTabSwitch("invitations")}
          aria-label="Open pending invitations"
        >
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(236, 72, 153, 0.12)", color: "#ec4899" }}
          >
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.pendingInvitations ?? invitations.length}</span>
            <span className="stat-label">Pending Invitations</span>
          </div>
        </button>
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

            <div className="role-filter" ref={roleMenuRef}>
              <button
                type="button"
                className="people-filter-select role-filter-trigger"
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((open) => !open)}
              >
                <span>
                  {roleFilter === "all"
                    ? "All Roles"
                    : roleFilter === "admin"
                      ? "Admin"
                      : roleFilter === "team_lead"
                        ? "Team Lead"
                        : "Member"}
                </span>
                <ChevronDown
                  size={15}
                  className={roleMenuOpen ? "role-chevron-open" : ""}
                />
              </button>

              {roleMenuOpen && (
                <div className="role-filter-menu" role="listbox">
                  {[
                    { value: "all", label: "All Roles" },
                    { value: "admin", label: "Admin" },
                    { value: "team_lead", label: "Team Lead" },
                    { value: "user", label: "Member" },
                  ].map((role) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={roleFilter === role.value}
                      className={`role-filter-option ${
                        roleFilter === role.value
                          ? "role-filter-option-active"
                          : ""
                      }`}
                      key={role.value}
                      onClick={() => {
                        setRoleFilter(role.value);
                        setRoleMenuOpen(false);
                      }}
                    >
                      <span>{role.label}</span>
                      {roleFilter === role.value && <CheckCircle size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="department-filter" ref={departmentMenuRef}>
              <button
                type="button"
                className="people-filter-select department-filter-trigger"
                aria-haspopup="listbox"
                aria-expanded={departmentMenuOpen}
                onClick={() => setDepartmentMenuOpen((open) => !open)}
              >
                <span>
                  {deptFilter === "all" ? "All Departments" : deptFilter}
                </span>
                <ChevronDown
                  size={15}
                  className={departmentMenuOpen ? "department-chevron-open" : ""}
                />
              </button>

              {departmentMenuOpen && (
                <div className="department-filter-menu" role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={deptFilter === "all"}
                    className={`department-filter-option ${
                      deptFilter === "all" ? "department-filter-option-active" : ""
                    }`}
                    onClick={() => {
                      setDeptFilter("all");
                      setDepartmentMenuOpen(false);
                    }}
                  >
                    <span>All Departments</span>
                    {deptFilter === "all" && <CheckCircle size={15} />}
                  </button>

                  {departments.map((department) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={deptFilter === department}
                      className={`department-filter-option ${
                        deptFilter === department
                          ? "department-filter-option-active"
                          : ""
                      }`}
                      key={department}
                      onClick={() => {
                        setDeptFilter(department);
                        setDepartmentMenuOpen(false);
                      }}
                    >
                      <span>{department}</span>
                      {deptFilter === department && <CheckCircle size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  role="button"
                  tabIndex={0}
                  onClick={() => openMemberDetails(member)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openMemberDetails(member);
                    }
                  }}
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

                  <div className="card-team-badge" title={`Teams / Squads: ${getMemberTeams(member).join(", ") || "None"}`}>
                    <Layers size={12} className="team-badge-icon" />
                    <span className="team-badge-text">{getMemberTeams(member).join(", ") || "No team assigned"}</span>
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
                      onClick={() => openMemberDetails(member)}
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
                          <span>{getMemberTeams(member).join(", ") || "No team assigned"}</span>
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
          {selectedTeam ? (
            <div className="team-detail-layout">
              <div className="team-detail-main">
                <button
                  type="button"
                  className="team-back-btn"
                  onClick={returnToTeamList}
                >
                  <ArrowLeft size={18} />
                  <span>Back to Teams & Squads</span>
                </button>

                <div className="team-detail-hero">
                  <div className="team-detail-icon">
                    <Users size={30} />
                  </div>
                  <div className="team-detail-heading">
                    <div className="team-detail-title-row">
                      <h2>{selectedTeam.name}</h2>
                      <span className="footer-dept-tag">{selectedTeam.department}</span>
                    </div>
                    <span className="team-active-status">
                      <span className="team-active-dot" />
                      Active
                    </span>
                    <p>{selectedTeam.description}</p>
                  </div>
                  <button
                    type="button"
                    className="team-edit-btn"
                    onClick={() => openTeamModal(selectedTeam)}
                  >
                    <Edit size={15} />
                    <span>Edit Team</span>
                  </button>
                </div>

                <div className="team-detail-stats">
                  <div className="team-detail-stat">
                    <Users size={22} />
                    <div>
                      <span>Role</span>
                      <strong>{selectedTeam.role || "Team Lead"}</strong>
                    </div>
                  </div>
                  <div className="team-detail-stat">
                    <Layers size={22} />
                    <div>
                      <span>Total Members</span>
                      <strong>
                        {members.filter((member) =>
                          getMemberTeams(member).some(
                            (name) => name.toLowerCase() === selectedTeam.name.toLowerCase()
                          )
                        ).length} Members
                      </strong>
                    </div>
                  </div>
                  <div className="team-detail-stat">
                    <CalendarDays size={22} />
                    <div>
                      <span>Created Date</span>
                      <strong>{selectedTeam.createdDate || "Not available"}</strong>
                    </div>
                  </div>
                </div>

                <section className="assigned-members-section">
                  <h3>
                    <Users size={21} />
                    <span>
                      Assigned Members (
                      {members.filter((member) =>
                        getMemberTeams(member).some(
                          (name) => name.toLowerCase() === selectedTeam.name.toLowerCase()
                        )
                      ).length}
                      )
                    </span>
                  </h3>

                  <div className="assigned-members-list">
                    {members
                      .filter((member) =>
                        getMemberTeams(member).some(
                          (name) => name.toLowerCase() === selectedTeam.name.toLowerCase()
                        )
                      )
                      .map((member) => (
                        <button
                          type="button"
                          className="assigned-member-row"
                          key={member.id}
                          onClick={() => openMemberDetails(member)}
                        >
                          <div
                            className="assigned-member-avatar"
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            {member.avatar || member.name.slice(0, 1).toUpperCase()}
                          </div>
                          <strong>{member.name}</strong>
                          <span className="assigned-member-role">
                            {member.role === "team_lead"
                              ? "Team Lead"
                              : member.role === "admin"
                                ? "Admin"
                                : "Developer"}
                          </span>
                        </button>
                      ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="team-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openTeamDetails(team)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openTeamDetails(team);
                    }
                  }}
                >
                  <div className="team-card-header">
                    <h3 className="team-name">{team.name}</h3>
                    <span className="footer-dept-tag">{team.department}</span>
                  </div>
                  <p className="team-desc">{team.description}</p>
                  <div className="team-details-row">
                    <div>
                      <strong>Role:</strong> {team.role || "Team Lead"}
                    </div>
                    <div>
                      <strong>
                        {members.filter((member) =>
                          getMemberTeams(member).some(
                            (name) => name.toLowerCase() === team.name.toLowerCase()
                          )
                        ).length} Members
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            </div>

            {invitations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                <Mail size={32} color="#94a3b8" style={{ margin: "0 auto 10px auto" }} />
                <p>No pending invitations. All invited members have joined!</p>
              </div>
            ) : (
              <div className="invite-list">
                {invitations.map((inv) => {
                  const expiresIn = getInvitationExpiryLabel(inv.expiresAt, countdownDate);
                  return (
                    <div key={inv.id || inv.email} className="invite-row">
                      <button
                        type="button"
                        className="invite-details-button"
                        aria-label={`View invitation details for ${inv.email}`}
                        onClick={() => setSelectedInvitation(inv)}
                      >
                        <Mail size={18} color="#6366f1" />
                        <div className="invite-details-summary">
                          <div className="invite-email">{inv.email}</div>
                          <div className="invite-meta">
                            Invited as {inv.role} • {inv.department} • {expiresIn || inv.expiresIn}
                          </div>
                        </div>
                      </button>

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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedInvitation && (
        <div
          className="people-modal-backdrop"
          onClick={() => setSelectedInvitation(null)}
        >
          <div
            className="people-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invitation-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="people-modal-header">
              <h3 id="invitation-details-title">Invitation Details</h3>
              <button
                type="button"
                className="people-modal-close"
                aria-label="Close invitation details"
                onClick={() => setSelectedInvitation(null)}
              >
                ×
              </button>
            </div>

            <div className="people-modal-body">
              <div className="invitation-details-grid">
                <div className="form-group">
                  <label>Email</label>
                  <span>{selectedInvitation.email || "Not available"}</span>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <span className="invitation-status">
                    {(selectedInvitation.status || "pending").replace(
                      /^./,
                      (letter) => letter.toUpperCase()
                    )}
                  </span>
                </div>
                <div className="form-group">
                  <label>Workspace Role</label>
                  <span>
                    {selectedInvitation.role === "team_lead"
                      ? "Team Lead"
                      : selectedInvitation.role === "admin"
                        ? "Admin"
                        : selectedInvitation.role === "user"
                          ? "Member"
                          : selectedInvitation.role || "Member"}
                  </span>
                </div>
                <div className="form-group">
                  <label>Department / Function</label>
                  <span>{selectedInvitation.department || "Not specified"}</span>
                </div>
                <div className="form-group">
                  <label>Assigned Teams / Squads</label>
                  <span>
                    {getMemberTeams(selectedInvitation).join(", ") || "None"}
                  </span>
                </div>
                <div className="form-group">
                  <label>Sent On</label>
                  <span>{selectedInvitation.createdAt || "Just now"}</span>
                </div>
                <div className="form-group">
                  <label>Expires On</label>
                  <span>
                    {selectedInvitation.expiresAt
                      ? new Date(selectedInvitation.expiresAt).toLocaleString()
                      : selectedInvitation.expiresIn || "Not available"}
                  </span>
                </div>
                <div className="form-group">
                  <label>Time Remaining</label>
                  <span>
                    {getInvitationExpiryLabel(
                      selectedInvitation.expiresAt,
                      countdownDate
                    ) || selectedInvitation.expiresIn || "Not available"}
                  </span>
                </div>
              </div>
            </div>

            <div className="people-modal-footer">
              <a
                className="people-btn people-btn-secondary"
                href={getInvitationMailto(selectedInvitation, "reply")}
              >
                <Reply size={14} />
                Reply
              </a>
              <a
                className="people-btn people-btn-secondary"
                href={getInvitationMailto(selectedInvitation, "forward")}
              >
                <Forward size={14} />
                Forward
              </a>
              <button
                type="button"
                className="people-btn people-btn-secondary"
                onClick={() => setSelectedInvitation(null)}
              >
                Close
              </button>
            </div>
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
                  <label>Assigned Teams / Squads</label>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "#818cf8", fontWeight: 600, fontSize: 13 }}>
                    <Layers size={14} />
                    <span>{getMemberTeams(selectedMember).join(", ") || "No team assigned"}</span>
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
                    <label>Reassign Teams / Squads</label>
                    <TeamMultiSelect
                      ariaLabel="Reassign teams and squads"
                      options={teams}
                      value={selectedTeams}
                      onChange={setSelectedTeams}
                    />
                    <button
                      type="button"
                      className="people-btn people-btn-primary"
                      style={{ marginTop: 10, alignSelf: "flex-start" }}
                      disabled={isSavingTeams || teams.length === 0}
                      onClick={() => handleTeamChange(selectedMember.id)}
                    >
                      {isSavingTeams ? "Saving..." : "Save Assignments"}
                    </button>
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
          onClick={closeInviteModal}
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
                onClick={closeInviteModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleInviteSubmit}>
              <div className="people-modal-body">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    required
                    className="form-control"
                    placeholder="colleague@gmail.com"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Workspace Role</label>
                  <ScrollableSelect
                    ariaLabel="Workspace Role"
                    value={inviteForm.role}
                    onChange={(role) =>
                      setInviteForm({ ...inviteForm, role })
                    }
                    options={[
                      { value: "user", label: "Member (Standard Contributor)" },
                      { value: "team_lead", label: "Team Lead (Sprint Manager)" },
                      { value: "admin", label: "Admin (Organization Lead)" },
                    ]}
                  />
                </div>

                <div className="form-group">
                  <label>Assign Teams / Squads</label>
                  <TeamMultiSelect
                    ariaLabel="Assign teams and squads"
                    options={teams}
                    value={inviteForm.teams}
                    onChange={(selected) =>
                      setInviteForm({ ...inviteForm, teams: selected })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Department / Function</label>
                  <ScrollableSelect
                    ariaLabel="Department / Function"
                    placeholder="Select a department"
                    value={inviteForm.department}
                    onChange={(department) =>
                      setInviteForm({
                        ...inviteForm,
                        department,
                      })
                    }
                    options={INVITE_DEPARTMENT_OPTIONS.map((department) => ({
                      value: department,
                      label: department,
                    }))}
                  />
                </div>
              </div>

              <div className="people-modal-footer">
                <button
                  type="button"
                  className="people-btn people-btn-secondary"
                  onClick={closeInviteModal}
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
          onClick={closeTeamModal}
        >
          <div
            className="people-modal-card people-create-team-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleTeamModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-team-title"
          >
            <div className="people-modal-header">
              <h3 id="create-team-title">
                {editingTeam ? "Edit Team / Squad" : "Create New Team / Squad"}
              </h3>
              <button
                type="button"
                className="people-modal-close"
                onClick={closeTeamModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTeamSubmit}>
              <div className="people-modal-body">
                <div className="form-group">
                  <label htmlFor="create-team-name">Team Name</label>
                  <input
                    id="create-team-name"
                    name="team-name"
                    type="text"
                    required
                    className="form-control"
                    autoComplete={editingTeam ? "off" : "new-password"}
                    pattern="[^@]+"
                    title="Enter a team name, not an email address."
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
                    name="team-description"
                    rows={3}
                    className="form-control"
                    autoComplete="off"
                    placeholder="What does this squad focus on?"
                    value={teamForm.description}
                    onChange={(e) =>
                      setTeamForm({ ...teamForm, description: e.target.value })
                    }
                  />
                </div>

                <div className="team-form-fields-row">
                  <div className="form-group">
                    <label>Department</label>
                    <ScrollableSelect
                      ariaLabel="Department"
                      value={teamForm.department}
                      onChange={(department) =>
                        setTeamForm({ ...teamForm, department })
                      }
                      showCheckmark
                      options={[
                        ...TEAM_DEPARTMENT_OPTIONS,
                        ...(teamForm.department &&
                        !TEAM_DEPARTMENT_OPTIONS.some(
                          (option) => option.value === teamForm.department
                        )
                          ? [
                              {
                                value: teamForm.department,
                                label: teamForm.department,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <ScrollableSelect
                      ariaLabel="Role"
                      value={teamForm.role}
                      onChange={(role) =>
                        setTeamForm({ ...teamForm, role })
                      }
                      showCheckmark
                      options={TEAM_ROLE_OPTIONS}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="create-team-tags">Tags (comma separated)</label>
                  <input
                    id="create-team-tags"
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
                  onClick={closeTeamModal}
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
                  <span>{editingTeam ? "Save Changes" : "Create Team"}</span>
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
