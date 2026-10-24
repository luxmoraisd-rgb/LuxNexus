import React from 'react';

export const PlusIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);

export const ChevronDownIcon = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const ChevronRightIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const FilterIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2.5 3.5h11M4.5 8h7M6.5 12.5h3" />
  </svg>
);

export const CloseIcon = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const SortIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12.5V3.5M5 3.5L2.5 6M5 3.5L7.5 6M11 3.5v9M11 12.5l2.5-2.5M11 12.5L8.5 10" />
  </svg>
);

export const GroupIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M2.5 7h11M7 7v6" />
  </svg>
);

export const OptionsIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2.5 4h5M10.5 4h3M2.5 12h5M10.5 12h3M2.5 8h2M7.5 8h6" />
    <circle cx="9" cy="4" r="1.3" />
    <circle cx="6" cy="8" r="1.3" />
    <circle cx="9" cy="12" r="1.3" />
  </svg>
);

export const UserSilhouetteIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="5.5" r="2.8" />
    <path d="M3.5 13.5c0-2.4 2-4.1 4.5-4.1s4.5 1.7 4.5 4.1" />
  </svg>
);

export const TeamSilhouetteIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="5.2" r="2.1" />
    <path d="M4.5 12.8c0-1.8 1.6-3 3.5-3s3.5 1.2 3.5 3" />
    <path d="M2.8 12c0-1.2 1-2.1 2.2-2.3" />
    <circle cx="3.8" cy="5.8" r="1.4" />
    <path d="M13.2 12c0-1.2-1-2.1-2.2-2.3" />
    <circle cx="12.2" cy="5.8" r="1.4" />
  </svg>
);

export const GoalIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3l8 14a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 17L12 3z" />
    <path d="M12 9v5" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </svg>
);

export const ShareIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="6" width="10" height="8" rx="1.5" />
    <path d="M5.5 6V4a2.5 2.5 0 0 1 5 0v2" />
  </svg>
);

export const ThumbsUpIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 7v7H2.5A1.5 1.5 0 0 1 1 12.5V8.5A1.5 1.5 0 0 1 2.5 7H5zm0 0l3-5a1.5 1.5 0 0 1 2.5 1.5L9.5 7H14a1.5 1.5 0 0 1 1.5 1.5l-1 5A1.5 1.5 0 0 1 13 14H5" />
  </svg>
);

export const LinkIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" />
    <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" />
  </svg>
);

export const DotsIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <circle cx="3" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="13" cy="8" r="1.3" />
  </svg>
);

export const ClosePanelIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 2.5v11M3 8h7.5M7.5 5l3 3-3 3" />
  </svg>
);

export const SmileyIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="8" r="6" />
    <path d="M6 6.5h.01M10 6.5h.01M5.5 10c.8 1.2 2.2 1.8 3.5 1.8s2.7-.6 3.5-1.8" />
  </svg>
);

export const AtIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="8" r="3" />
    <path d="M11 6v3a1.5 1.5 0 0 0 3 0A6 6 0 1 0 8 14c2.2 0 4-1.2 4.8-3" />
  </svg>
);

export const StarIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="8 2 10 6.5 15 7 11 10.5 12.5 15.5 8 13 3.5 15.5 5 10.5 1 7 6 6.5 8 2" />
  </svg>
);

export const ArrowUpIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 12.5V3.5M4 7.5L8 3.5l4 4" />
  </svg>
);

export const CheckIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 8.5l3 3 6.5-6.5" />
  </svg>
);

export const TrashIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 4.5h10M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5M6 7.5v4.5M10 7.5v4.5M4 4.5l.8 9a1.5 1.5 0 001.5 1.5h3.4a1.5 1.5 0 001.5-1.5l.8-9" />
  </svg>
);
