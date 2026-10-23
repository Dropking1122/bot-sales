import React from 'react';

export const AutomotiveLogo: React.FC<{ className?: string; size?: number }> = ({
  className = "w-8 h-8",
  size = 32
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer precision hexagon / shield */}
      <path
        d="M24 4L42 12V24C42 34.5 34.3 42.6 24 45C13.7 42.6 6 34.5 6 24V12L24 4Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-900 dark:text-white"
      />
      {/* Dynamic aerodynamic center blades */}
      <path
        d="M16 22L24 16L32 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-600 dark:text-blue-400"
      />
      <path
        d="M19 28L24 24L29 28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-700 dark:text-slate-300"
      />
      <circle
        cx="24"
        cy="33"
        r="2"
        fill="currentColor"
        className="text-blue-600 dark:text-blue-400"
      />
    </svg>
  );
};
