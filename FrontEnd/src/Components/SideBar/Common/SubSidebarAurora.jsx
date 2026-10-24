import React, { useState, useRef } from "react";
import "./SubSidebarAurora.css";

const SubSidebarAurora = () => {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Subtle 3D tilt angles
    const rx = -(y / rect.height) * 14;
    const ry = (x / rect.width) * 16;
    setTilt({ rx, ry });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0 });
  };

  return (
    <div
      ref={containerRef}
      className={`sub-hologram-container ${isHovered ? "hovered" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-hidden="true"
      title="Nexus Holographic Core"
    >
      {/* Background Soft Aurora Glow Clouds */}
      <div className="holo-aurora-glow holo-glow-indigo" />
      <div className="holo-aurora-glow holo-glow-cyan" />
      <div className="holo-aurora-glow holo-glow-purple" />
      <div className="holo-aurora-glow holo-glow-pink" />

      {/* Floating 3D Hologram Stage with Interactive Parallax */}
      <div
        className="holo-3d-stage"
        style={{
          transform: `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <svg
          className="holo-svg"
          viewBox="0 0 216 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Beam Gradient */}
            <linearGradient id="centralBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="25%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.9" />
              <stop offset="75%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </linearGradient>

            {/* Layer 1 - Cyan Gradient */}
            <linearGradient id="layerTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="layerTopStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>

            {/* Layer 2 - Indigo Gradient */}
            <linearGradient id="layerMidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="layerMidStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Layer 3 - Purple / Pink Gradient */}
            <linearGradient id="layerBotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="layerBotStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="holoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Hologram Ground Ripple Circles */}
          <g className="holo-ground-ripple">
            <ellipse cx="108" cy="226" rx="58" ry="22" className="ground-ring ring-1" />
            <ellipse cx="108" cy="226" rx="42" ry="16" className="ground-ring ring-2" />
            <ellipse cx="108" cy="226" rx="24" ry="9" className="ground-ring ring-3" />
          </g>

          {/* Central Holographic Laser Beam */}
          <line
            x1="108"
            y1="24"
            x2="108"
            y2="230"
            stroke="url(#centralBeamGrad)"
            strokeWidth="1.8"
            className="holo-center-beam"
          />

          {/* Traveling Energy Pulse Node along the beam */}
          <g className="traveling-pulse-group">
            <circle cx="108" cy="125" r="5" fill="#38bdf8" className="beam-pulse-glow" />
            <circle cx="108" cy="125" r="2.2" fill="#ffffff" className="beam-pulse-core" />
          </g>

          {/* ========================================================
              LAYER 3: BOTTOM ISOMETRIC DIAMOND (PURPLE / PINK)
             ======================================================== */}
          <g className="holo-layer layer-3">
            {/* 3D Side Slab Bevels */}
            <path
              d="M 56 172 L 108 193 L 108 199 L 56 178 Z"
              fill="#581c87"
              fillOpacity="0.4"
            />
            <path
              d="M 108 193 L 160 172 L 160 178 L 108 199 Z"
              fill="#701a75"
              fillOpacity="0.45"
            />
            {/* Top Diamond Face */}
            <path
              d="M 108 151 L 160 172 L 108 193 L 56 172 Z"
              fill="url(#layerBotGrad)"
              stroke="url(#layerBotStroke)"
              strokeWidth="1.6"
              className="layer-face"
            />
            {/* Inner Cyber Circuit Accent */}
            <path
              d="M 108 159 L 144 172 L 108 185 L 72 172 Z"
              fill="none"
              stroke="#ec4899"
              strokeWidth="0.8"
              strokeDasharray="4 3"
              opacity="0.65"
            />
            {/* Center Nexus Connector Node */}
            <circle cx="108" cy="172" r="3" fill="#a855f7" className="layer-node-core" />
            <circle cx="108" cy="172" r="1.2" fill="#ffffff" />
          </g>

          {/* ========================================================
              LAYER 2: MIDDLE ISOMETRIC DIAMOND (INDIGO / VIOLET)
             ======================================================== */}
          <g className="holo-layer layer-2">
            {/* 3D Side Slab Bevels */}
            <path
              d="M 56 118 L 108 139 L 108 145 L 56 124 Z"
              fill="#312e81"
              fillOpacity="0.4"
            />
            <path
              d="M 108 139 L 160 118 L 160 124 L 108 145 Z"
              fill="#3730a3"
              fillOpacity="0.45"
            />
            {/* Top Diamond Face */}
            <path
              d="M 108 97 L 160 118 L 108 139 L 56 118 Z"
              fill="url(#layerMidGrad)"
              stroke="url(#layerMidStroke)"
              strokeWidth="1.6"
              className="layer-face"
            />
            {/* Inner Cyber Circuit Accent */}
            <path
              d="M 108 105 L 144 118 L 108 131 L 72 118 Z"
              fill="none"
              stroke="#818cf8"
              strokeWidth="0.8"
              strokeDasharray="4 3"
              opacity="0.65"
            />
            {/* Center Nexus Connector Node */}
            <circle cx="108" cy="118" r="3" fill="#6366f1" className="layer-node-core" />
            <circle cx="108" cy="118" r="1.2" fill="#ffffff" />
          </g>

          {/* ========================================================
              LAYER 1: TOP ISOMETRIC DIAMOND (CYAN / ELECTRIC BLUE)
             ======================================================== */}
          <g className="holo-layer layer-1">
            {/* 3D Side Slab Bevels */}
            <path
              d="M 56 64 L 108 85 L 108 91 L 56 70 Z"
              fill="#164e63"
              fillOpacity="0.45"
            />
            <path
              d="M 108 85 L 160 64 L 160 70 L 108 91 Z"
              fill="#0e7490"
              fillOpacity="0.5"
            />
            {/* Top Diamond Face */}
            <path
              d="M 108 43 L 160 64 L 108 85 L 56 64 Z"
              fill="url(#layerTopGrad)"
              stroke="url(#layerTopStroke)"
              strokeWidth="1.8"
              className="layer-face"
            />
            {/* Inner Cyber Circuit Accent */}
            <path
              d="M 108 51 L 144 64 L 108 77 L 72 64 Z"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="0.9"
              strokeDasharray="4 3"
              opacity="0.75"
            />
            {/* Center Nexus Sparkle Core */}
            <circle cx="108" cy="64" r="3.2" fill="#06b6d4" className="layer-node-core" />
            <circle cx="108" cy="64" r="1.3" fill="#ffffff" />
          </g>

          {/* Hologram Corner Light Nodes */}
          <g className="holo-beacons">
            <circle cx="108" cy="43" r="2" fill="#38bdf8" className="corner-dot cd-top" />
            <circle cx="160" cy="118" r="2" fill="#818cf8" className="corner-dot cd-right" />
            <circle cx="56" cy="172" r="2" fill="#c084fc" className="corner-dot cd-left" />
            <circle cx="108" cy="193" r="2" fill="#ec4899" className="corner-dot cd-bot" />
          </g>
        </svg>
      </div>

      {/* Floating Ambient Stardust Particles */}
      <div className="holo-stardust">
        <span className="h-dot hd-1" />
        <span className="h-dot hd-2" />
        <span className="h-dot hd-3" />
        <span className="h-dot hd-4" />
        <span className="h-dot hd-5" />
      </div>

      {/* Vignette Blend */}
      <div className="holo-vignette" />
    </div>
  );
};

export default SubSidebarAurora;
