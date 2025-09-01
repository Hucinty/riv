
import React from 'react';

interface AiAvatarProps {
    imageUrl?: string | null;
}

export const AiAvatar: React.FC<AiAvatarProps> = ({ imageUrl }) => {
    if (imageUrl) {
        return (
             <img src={imageUrl} alt="AI Avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
        );
    }

    return (
      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
};
