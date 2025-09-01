import React, { useState, useRef, useEffect } from 'react';
import { Mood } from '../types';

interface MoodSelectorProps {
  currentMood: Mood;
  isManual: boolean;
  onSelect: (mood: Mood | 'auto') => void;
}

type MoodOption = {
  key: Mood | 'auto';
  label: string;
  icon: JSX.Element;
};

const moodOptions: MoodOption[] = [
  { key: 'auto', label: 'Auto', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> },
  { key: 'happy', label: 'Happy', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" /></svg> },
  { key: 'sad', label: 'Sad', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 7.536a1 1 0 001.415-1.415 3 3 0 014.242 0 1 1 0 001.415 1.415 5 5 0 01-7.072 0z" clipRule="evenodd" /></svg> },
  { key: 'playful', label: 'Playful', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 1.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM10 12c-2.21 0-4-1.79-4-4h8c0 2.21-1.79 4-4 4z" /><path d="M10 12c-2.21 0-4-1.79-4-4h8c0 2.21-1.79 4-4 4zM6.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 1.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM10 2a8 8 0 100 16 8 8 0 000-16z" /></svg> },
  { key: 'curious', label: 'Curious', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-1 1v1a1 1 0 102 0V8a1 1 0 00-1-1zm1 4a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg> },
];

export const MoodSelector: React.FC<MoodSelectorProps> = ({ currentMood, isManual, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = isManual
    ? moodOptions.find(opt => opt.key === currentMood) || moodOptions[1]
    : moodOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: MoodOption) => {
    onSelect(option.key);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-input text-strong hover:opacity-80 transition-all duration-200 border border-themed"
      >
        {selectedOption.icon}
        <span className="text-sm font-medium hidden sm:inline">{selectedOption.label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-main rounded-lg shadow-xl z-10 border border-themed">
          <ul className="p-1">
            {moodOptions.map(option => (
              <li key={option.key}>
                <button
                  onClick={() => handleSelect(option)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-strong rounded-md hover:bg-input transition-colors duration-200"
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};