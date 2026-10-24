import {
  Briefcase,
  Target,
  BookOpen,
  Users,
} from "lucide-react";

import "./mainsidebar.css";


const MainSidebar = ({
  activeItem,
  setActiveItem,
}) => {

  const menuItems = [
    {
      id: "work",
      label: "Work",
      icon: <Briefcase size={21} />,
    },

    {
      id: "strategy",
      label: "Tracker",
      icon: <Target size={21} />,
    },

    {
      id: "knowledge",
      label: "Knowledge",
      icon: <BookOpen size={21} />,
    },

    {
      id: "people",
      label: "People",
      icon: <Users size={21} />,
    },
  ];


  return (
    <aside className="main-sidebar">

      <div className="sidebar-items">

        {menuItems.map((item) => (

          <button
            key={item.id}
            className={`sidebar-item ${activeItem === item.id
              ? "active"
              : ""
              }`}
            onClick={() =>
              setActiveItem(item.id)
            }
          >

            <div className="sidebar-icon">
              {item.icon}
            </div>

            <span>
              {item.label}
            </span>

          </button>

        ))}

      </div>

      {/* Empty Space Mini 3D Nexus Hologram */}
      <div className="main-sidebar-ambient" aria-hidden="true" title="Nexus Hologram">
        <div className="main-aurora-orb main-orb-1" />
        <div className="main-aurora-orb main-orb-2" />
        <div className="main-aurora-orb main-orb-3" />

        {/* Slender 3D Isometric Hologram */}
        <svg className="main-holo-svg" viewBox="0 0 66 260" fill="none">
          <defs>
            <linearGradient id="mainBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="30%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="mLayerTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="mLayerMid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="mLayerBot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>

          {/* Ground ripple */}
          <ellipse cx="33" cy="226" rx="22" ry="8" className="m-ground-ring" />

          {/* Central laser beam */}
          <line x1="33" y1="35" x2="33" y2="225" stroke="url(#mainBeamGrad)" strokeWidth="1.5" className="m-holo-beam" />

          {/* Traveling energy pulse */}
          <g className="m-pulse-node">
            <circle cx="33" cy="125" r="3.5" fill="#38bdf8" className="m-beam-pulse" />
            <circle cx="33" cy="125" r="1.5" fill="#ffffff" />
          </g>

          {/* Layer 3 - Purple/Pink */}
          <g className="m-holo-layer m-layer-3">
            <path d="M 15 168 L 33 178 L 51 168 L 33 158 Z" fill="rgba(168, 85, 247, 0.22)" stroke="url(#mLayerBot)" strokeWidth="1.4" />
            <circle cx="33" cy="168" r="2" fill="#ec4899" />
          </g>

          {/* Layer 2 - Indigo */}
          <g className="m-holo-layer m-layer-2">
            <path d="M 15 120 L 33 130 L 51 120 L 33 110 Z" fill="rgba(99, 102, 241, 0.22)" stroke="url(#mLayerMid)" strokeWidth="1.4" />
            <circle cx="33" cy="120" r="2" fill="#6366f1" />
          </g>

          {/* Layer 1 - Cyan */}
          <g className="m-holo-layer m-layer-1">
            <path d="M 15 72 L 33 82 L 51 72 L 33 62 Z" fill="rgba(6, 182, 212, 0.25)" stroke="url(#mLayerTop)" strokeWidth="1.5" />
            <circle cx="33" cy="72" r="2" fill="#06b6d4" />
          </g>
        </svg>

        <div className="main-ambient-particles">
          <span className="main-star-dot m-dot-1" />
          <span className="main-star-dot m-dot-2" />
          <span className="main-star-dot m-dot-3" />
        </div>
      </div>

      <div className="sidebar-bottom" />
    </aside>
  );
};

export default MainSidebar;