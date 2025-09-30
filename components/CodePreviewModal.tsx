import React, { useEffect, useState, useRef, useCallback } from 'react';

interface CodePreviewModalProps {
  code: string;
  language: string;
  onClose: () => void;
}

const getPreviewContent = (code: string, language: string): string => {
    const langLower = language.toLowerCase();
    
    // The AI is prompted to return a full HTML document for JS, so we treat it like HTML.
    if (langLower === 'html' || langLower === 'javascript' || langLower === 'js') {
        return code;
    }

    // For CSS, we still wrap it in a boilerplate to make it viewable.
    if (langLower === 'css') {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CSS Preview</title>
                <style>
                    body { font-family: sans-serif; padding: 1rem; color: #333; background-color: #fff; }
                    ${code}
                </style>
            </head>
            <body>
                <h1>CSS Preview</h1>
                <p>This is a sample paragraph to demonstrate the styles provided.</p>
                <div class="card" style="padding: 1rem; border: 1px solid #ccc; border-radius: 8px; margin-top: 1rem;">
                  <h2>Sample Card</h2>
                  <p>Apply your CSS to elements like this.</p>
                  <button>Click Me</button>
                </div>
            </body>
            </html>
        `;
    }
    return 'Preview for this language is not supported.';
};


export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({ code, language, onClose }) => {
  const [editedCode, setEditedCode] = useState(code);
  const [previewSrcDoc, setPreviewSrcDoc] = useState(() => getPreviewContent(code, language));
  const [dividerPos, setDividerPos] = useState(50); // percentage
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleUpdatePreview = () => {
    setPreviewSrcDoc(getPreviewContent(editedCode, language));
  };
  
  const handleReset = () => {
    setEditedCode(code);
    setPreviewSrcDoc(getPreviewContent(code, language));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
  };

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newDividerPos = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newDividerPos > 15 && newDividerPos < 85) {
      setDividerPos(newDividerPos);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      className="code-preview-modal-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="code-preview-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="code-preview-modal-header">
          <div className="flex items-center gap-4">
             <h2 className="code-preview-modal-title">Code Playground</h2>
              <div className="code-preview-modal-header-actions">
                <button onClick={handleReset} className="code-preview-modal-action-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a9 9 0 0015-2.8L15 8" />
                  </svg>
                  <span>Reset</span>
                </button>
                <button onClick={handleUpdatePreview} className="code-preview-modal-action-btn primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Update Preview</span>
                </button>
              </div>
          </div>
          <button onClick={onClose} className="code-preview-modal-close-btn" aria-label="Close preview">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div 
          ref={containerRef} 
          className="code-preview-modal-body"
        >
          <div 
            className="code-preview-pane code-preview-pane-code" 
            style={{ flexBasis: `${dividerPos}%` }}
          >
            <textarea
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                className="code-editor-textarea"
                aria-label="Code Editor"
                spellCheck="false"
            />
          </div>
          <div 
            className="code-preview-divider"
            onMouseDown={handleMouseDown}
          />
          <div 
            className="code-preview-pane code-preview-pane-preview"
          >
            <iframe
              srcDoc={previewSrcDoc}
              title="Code Preview"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>
    </div>
  );
};