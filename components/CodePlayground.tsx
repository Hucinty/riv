import React, { useState, useMemo } from 'react';
import { Tooltip } from './Tooltip';
import { CodePreviewModal } from './CodePreviewModal';

interface CodePlaygroundProps {
  code: string;
  language: string;
}

export const highlightSyntax = (code: string, language: string): string => {
  // 1. Escape HTML special characters to prevent XSS and rendering issues.
  let highlightedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lang = language.toLowerCase();

  // Define patterns
  const strings = /(".*?"|'.*?'|`.*?`)/g;
  const numbers = /\b(\d+(\.\d+)?)\b/g;

  // Apply general highlighting that doesn't conflict
  highlightedCode = highlightedCode.replace(strings, '<span class="token string">$1</span>');
  highlightedCode = highlightedCode.replace(numbers, '<span class="token number">$1</span>');

  if (lang.includes('javascript') || lang.includes('js') || lang.includes('ts')) {
    const comments = /(\/\/.*|\/\*[\s\S]*?\*\/)/g;
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|from|class|export|default|async|await|try|catch|new|this|typeof|instanceof|null|undefined|true|false)\b/g;
    const functions = /(\w+)\s*(?=\()/g;
    
    highlightedCode = highlightedCode.replace(comments, '<span class="token comment">$1</span>');
    highlightedCode = highlightedCode.replace(keywords, '<span class="token keyword">$1</span>');
    highlightedCode = highlightedCode.replace(functions, '<span class="token function">$1</span>');

  } else if (lang.includes('python') || lang.includes('py')) {
    const comments = /(#.*)/g;
    const keywords = /\b(def|for|in|while|if|elif|else|return|import|from|class|pass|try|except|finally|with|as|lambda|True|False|None)\b/g;
    const functions = /(\w+)\s*(?=\()/g;
    
    highlightedCode = highlightedCode.replace(comments, '<span class="token comment">$1</span>');
    highlightedCode = highlightedCode.replace(keywords, '<span class="token keyword">$1</span>');
    highlightedCode = highlightedCode.replace(functions, '<span class="token function">$1</span>');
    
  } else if (lang.includes('css')) {
    const comments = /(\/\*[\s\S]*?\*\/)/g;
    // Simple selector highlighter - not perfect for complex cases but good for demonstration
    const selectors = /(^|[\s,}{])([\.#]?-?[_a-zA-Z]+[_a-zA-Z0-9-]*\s*:{0,2}[a-zA-Z-]*)(?=\s*\{)/g;
    const properties = /([\w-]+)\s*(?=:)/g;
    
    highlightedCode = highlightedCode.replace(comments, '<span class="token comment">$1</span>');
    highlightedCode = highlightedCode.replace(selectors, '$1<span class="token keyword">$2</span>');
    highlightedCode = highlightedCode.replace(properties, '<span class="token function">$1</span>');

  } else if (lang.includes('html')) {
    const comments = /(&lt;!--[\s\S]*?--&gt;)/g;
    // Highlight tag names within <...> or </...>
    const tags = /(&lt;\/?)([\w\d-]+)/g;
    // Highlight attribute names
    const attributes = /\s([\w-]+)(?==)/g;
    
    // The strings rule has already highlighted attribute values.
    highlightedCode = highlightedCode.replace(comments, '<span class="token comment">$1</span>');
    highlightedCode = highlightedCode.replace(tags, '$1<span class="token keyword">$2</span>');
    highlightedCode = highlightedCode.replace(attributes, ' <span class="token function">$1</span>');
  } else {
     // Generic fallback for other languages
    const comments = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g;
    const functions = /(\w+)\s*(?=\()/g;
    highlightedCode = highlightedCode.replace(comments, '<span class="token comment">$1</span>');
    highlightedCode = highlightedCode.replace(functions, '<span class="token function">$1</span>');
  }

  return highlightedCode;
};


export const CodePlayground: React.FC<CodePlaygroundProps> = ({ code, language }) => {
    const [copyText, setCopyText] = useState('Copy');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    
    const highlightedCode = useMemo(() => highlightSyntax(code, language), [code, language]);
    const langLower = language.toLowerCase();
    const isPreviewable = ['html', 'css', 'javascript', 'js'].includes(langLower);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopyText('Copied!');
            setTimeout(() => setCopyText('Copy'), 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            setCopyText('Error');
            setTimeout(() => setCopyText('Copy'), 2000);
        });
    };

    return (
        <>
            <div className="code-playground">
                <div className="code-playground-header">
                    <span className="code-playground-lang">{language}</span>
                    <div className="code-playground-header-actions">
                        {isPreviewable && (
                           <button onClick={() => setIsPreviewModalOpen(true)} className="code-playground-action-btn">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C3.732 4.943 9.522 3 10 3s6.268 1.943 9.542 7c-3.274 5.057-9.064 7-9.542 7S3.732 15.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                               </svg>
                               <span>Open Playground</span>
                           </button>
                        )}
                        <Tooltip text={copyText === 'Copy' ? 'Copy to clipboard' : copyText} position="left">
                          <button onClick={handleCopy} className="code-playground-action-btn">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{copyText}</span>
                          </button>
                        </Tooltip>
                    </div>
                </div>
                <pre>
                    <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
                </pre>
            </div>
            {isPreviewModalOpen && (
                <CodePreviewModal
                    code={code}
                    language={language}
                    onClose={() => setIsPreviewModalOpen(false)}
                />
            )}
        </>
    );
};