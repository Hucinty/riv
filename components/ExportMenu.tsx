import React from 'react';

interface ExportMenuProps {
  onExport: (format: 'txt' | 'pdf') => void;
  onClose: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExport, onClose }) => {
    return (
        <div className="absolute right-0 top-full mt-2 w-48 bg-main rounded-lg shadow-xl z-10 border border-themed">
          <ul className="p-1">
            <li>
                <button
                  onClick={() => { onExport('txt'); onClose(); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-strong rounded-md hover:bg-input transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                  <span>Export as .txt</span>
                </button>
            </li>
            <li>
                <button
                  onClick={() => { onExport('pdf'); onClose(); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-strong rounded-md hover:bg-input transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                  <span>Export as .pdf</span>
                </button>
            </li>
          </ul>
        </div>
    );
};
