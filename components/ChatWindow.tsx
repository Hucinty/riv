import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message as MessageType, Mood, UserInfo } from '../types';
import { Message } from './Message';
import { AiAvatar } from './Avatar';
import { MoodSelector } from './MoodSelector';
import { EmojiPicker } from './EmojiPicker';
import { ExportMenu } from './ExportMenu';
import { generateContent } from '../utils/exportUtils';
import { Tooltip } from './Tooltip';

interface ImageInput {
    data: string;
    mimeType: string;
    previewUrl: string;
}

interface ChatWindowProps {
  messages: MessageType[];
  onSendMessage: (text: string, image?: ImageInput, options?: { isCode?: boolean }) => void;
  isLoading: boolean;
  userInfo: UserInfo;
  learnedFacts: string[];
  currentMood: Mood;
  isManualMood: boolean;
  onMoodChange: (mood: Mood | 'auto') => void;
  onExport: (format: 'txt' | 'pdf') => void;
  isVoiceSessionActive: boolean;
  onToggleVoiceSession: () => void;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-start gap-3 justify-start">
    <div className="animate-thinking">
        <AiAvatar />
    </div>
    <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-ai-bubble text-strong rounded-tl-none flex items-center space-x-1.5">
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
    </div>
  </div>
);

const PreviewModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  content: string;
}> = ({ isOpen, onClose, content }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-300 animate-pop-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-main rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-themed">
          <h2 className="text-xl font-bold text-strong">Information Preview</h2>
          <button onClick={onClose} className="text-subtle hover:text-strong p-1 rounded-full" aria-label="Close preview">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <pre className="text-sm whitespace-pre-wrap font-sans text-strong bg-input p-4 rounded-lg border border-themed">{content}</pre>
        </div>
        <div className="p-4 border-t border-themed">
            <button 
              onClick={onClose} 
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              Close
            </button>
        </div>
      </div>
    </div>
  );
};


export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, userInfo, learnedFacts, currentMood, isManualMood, onMoodChange, onExport, isVoiceSessionActive, onToggleVoiceSession }) => {
  const { aiName } = userInfo;
  const [inputText, setInputText] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [imageToSend, setImageToSend] = useState<ImageInput | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const DEBOUNCE_DELAY = 20000; // 20 seconds
  const formRef = useRef<HTMLFormElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  const previewContent = useMemo(() => {
    return generateContent(userInfo, learnedFacts);
  }, [userInfo, learnedFacts]);

  useEffect(() => {
    // Check for microphone support
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => setIsMicSupported(true))
        .catch(() => setIsMicSupported(false));
  }, []);

  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }

    // Conditions to prevent auto-sending (e.g., if there's no text, an image is staged, or AI is typing)
    if (!inputText.trim() || imageToSend || isLoading || isVoiceSessionActive) {
        return;
    }

    // Set a new timeout to auto-submit the form
    debounceTimeoutRef.current = window.setTimeout(() => {
        formRef.current?.requestSubmit();
    }, DEBOUNCE_DELAY);

    // Cleanup on component unmount
    return () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
    };
  }, [inputText, imageToSend, isLoading, isVoiceSessionActive]);


  useEffect(() => {
    if (!isLoading && !isVoiceSessionActive) {
      chatInputRef.current?.focus();
    }
  }, [isLoading, isVoiceSessionActive]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
    }

    if ((!inputText.trim() && !imageToSend) || isLoading || isVoiceSessionActive) return;
    onSendMessage(inputText, imageToSend ?? undefined, { isCode: isCodeMode });
    setInputText('');
    setImageToSend(null);
    setShowEmojiPicker(false);
    setIsCodeMode(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        if (base64Data) {
            setImageToSend({
                data: base64Data,
                mimeType: file.type,
                previewUrl: result
            });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  return (
    <>
      <PreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} content={previewContent} />
      <div className="w-full h-screen bg-main flex flex-col transition-colors duration-500 doodle-bg">
        <header className="relative z-10 flex items-center justify-between gap-4 p-4 border-b border-themed shrink-0 transition-colors duration-500 bg-main/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
              <div className="relative">
                  <AiAvatar />
                  <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${isVoiceSessionActive ? 'bg-red-500' : 'bg-green-400'}`}></span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-strong transition-colors duration-500">{aiName}</h1>
                <p className="text-sm text-subtle transition-colors duration-500">{isVoiceSessionActive ? 'In a call...' : 'Online'}</p>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <Tooltip text="Change AI Mood">
                <MoodSelector 
                    currentMood={currentMood}
                    isManual={isManualMood}
                    onSelect={onMoodChange}
                />
              </Tooltip>
               <div className="relative">
                  <Tooltip text="More Options">
                    <button
                        onClick={() => setShowExportMenu(prev => !prev)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-input text-strong hover:opacity-80 transition-all duration-200 border border-themed"
                        aria-label="More options"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                  </Tooltip>
                  {showExportMenu && <ExportMenu onExport={onExport} onPreview={() => setShowPreview(true)} onClose={() => setShowExportMenu(false)} />}
              </div>
          </div>
        </header>
        <main className="w-full max-w-4xl mx-auto flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.sender === 'USER' && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </main>
        <footer className="p-2 md:p-4 border-t border-themed shrink-0 transition-colors duration-500 bg-main/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl mx-auto">
            {imageToSend && (
                <div className="p-2 relative w-24">
                    <img src={imageToSend.previewUrl} alt="Preview" className="rounded-lg w-full h-auto" />
                    <button
                        onClick={() => setImageToSend(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold"
                        aria-label="Remove image"
                    >&times;</button>
                </div>
            )}
            <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2 relative">
              {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <Tooltip text="Attach Image">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isVoiceSessionActive}
                    className="shrink-0 w-10 h-10 bg-input text-subtle rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                    aria-label="Attach image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip text={isCodeMode ? 'Disable Code Mode' : 'Enable Code Mode'}>
                <button
                    type="button"
                    onClick={() => setIsCodeMode(prev => !prev)}
                    disabled={isLoading || isVoiceSessionActive}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 ${isCodeMode ? 'bg-primary-600 text-white' : 'bg-input text-subtle'}`}
                    aria-label={isCodeMode ? 'Disable code generation mode' : 'Enable code generation mode'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
              </Tooltip>
              {isMicSupported && (
                <Tooltip text={isVoiceSessionActive ? 'End Call' : 'Start Voice Chat'}>
                  <button
                    type="button"
                    onClick={onToggleVoiceSession}
                    disabled={isLoading}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 ${isVoiceSessionActive ? 'bg-red-500 text-white animate-mic-pulse' : 'bg-input text-subtle'}`}
                    aria-label={isVoiceSessionActive ? 'End voice session' : 'Start voice session'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              <div className="relative flex-grow">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isVoiceSessionActive ? 'Listening...' : (isCodeMode ? 'Describe the code you need...' : 'Type a message...')}
                  disabled={isLoading || isVoiceSessionActive}
                  className="w-full h-12 px-4 pr-12 bg-input text-strong rounded-full focus:outline-none focus:ring-2 focus:ring-primary-600 transition-all duration-200"
                />
                <Tooltip text="Select Emoji" position="left">
                  <button
                      type="button"
                      onClick={() => setShowEmojiPicker(prev => !prev)}
                      disabled={isLoading || isVoiceSessionActive}
                      className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 text-subtle rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:bg-slate-200"
                      aria-label="Select emoji"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                      </svg>
                  </button>
                </Tooltip>
              </div>
              <Tooltip text="Send Message">
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !imageToSend) || isLoading || isVoiceSessionActive}
                  className="shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  aria-label="Send message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </Tooltip>
            </form>
          </div>
        </footer>
      </div>
    </>
  );
};