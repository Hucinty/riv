import React from 'react';

export const AiAvatar: React.FC = () => {
    return (
      <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shrink-0 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Head */}
            <rect x="5" y="8" width="14" height="10" rx="4" />
            {/* Eyes */}
            <line x1="9.5" y1="11.5" x2="9.5" y2="13.5" />
            <line x1="14.5" y1="11.5" x2="14.5" y2="13.5" />
            {/* Smile */}
            <path d="M9 15.5 Q 12 17 15 15.5" />
            {/* Antenna */}
            <line x1="12" y1="8" x2="12" y2="5" />
            <circle cx="12" cy="4" r="1" fill="currentColor" />
        </svg>
      </div>
    );
};