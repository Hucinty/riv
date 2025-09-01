import React, { useState, useRef, useEffect } from 'react';
import { Message as MessageType, Mood } from '../types';
import { Message } from './Message';
import { AiAvatar } from './Avatar';
import { MoodSelector } from './MoodSelector';
import { EmojiPicker } from './EmojiPicker';
import { ExportMenu } from './ExportMenu';

// Define types for the Web Speech API for better TypeScript support
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

interface ImageInput {
    data: string;
    mimeType: string;
    previewUrl: string;
}

interface ChatWindowProps {
  messages: MessageType[];
  onSendMessage: (text: string, image?: ImageInput) => void;
  isLoading: boolean;
  avatarUrl: string | null;
  aiName: string;
  currentMood: Mood;
  isManualMood: boolean;
  onMoodChange: (mood: Mood | 'auto') => void;
  onExport: (format: 'txt' | 'pdf') => void;
  isImageGenerationEnabled: boolean;
  onImageGenerationToggle: (isEnabled: boolean) => void;
}

interface TypingIndicatorProps {
    avatarUrl: string | null;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ avatarUrl }) => (
  <div className="flex items-start gap-3 justify-start">
    <div className="animate-thinking">
        <AiAvatar imageUrl={avatarUrl} />
    </div>
    <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-ai-bubble text-strong rounded-tl-none flex items-center space-x-1.5">
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
    </div>
  </div>
);

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, avatarUrl, aiName, currentMood, isManualMood, onMoodChange, onExport, isImageGenerationEnabled, onImageGenerationToggle }) => {
  const [inputText, setInputText] = useState('');
  const [imageToSend, setImageToSend] = useState<ImageInput | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const DEBOUNCE_DELAY = 1500; // 1.5 seconds
  const formRef = useRef<HTMLFormElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }

    // Conditions to prevent auto-sending (e.g., if there's no text, an image is staged, or AI is typing)
    if (!inputText.trim() || imageToSend || isLoading) {
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
  }, [inputText, imageToSend, isLoading]);


  useEffect(() => {
    // Refocus the chat input when the component mounts and after the AI finishes responding.
    // This provides a smoother user experience, allowing for continuous conversation.
    if (!isLoading) {
      chatInputRef.current?.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    // Initialize Speech Recognition API
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsMicSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert("Microphone access denied. Please allow microphone access in your browser settings.");
        }
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join('');
        setInputText(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any pending auto-send timeout to prevent double submission
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
    }

    if ((!inputText.trim() && !imageToSend) || isLoading) return;
    onSendMessage(inputText, imageToSend ?? undefined);
    setInputText('');
    setImageToSend(null);
    setShowEmojiPicker(false);
  };

  const handleMicClick = () => {
    if (isLoading || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInputText('');
      setImageToSend(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting speech recognition:", err);
        alert("Could not start voice recording. Please make sure microphone permission is granted in your browser settings.");
      }
    }
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
    <div className="w-full max-w-2xl h-[95vh] md:h-[85vh] bg-main rounded-2xl shadow-2xl flex flex-col p-2 md:p-4 mx-2 md:mx-4 my-4 transition-colors duration-500 doodle-bg">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-themed shrink-0 transition-colors duration-500 bg-main/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-4">
            <div className="relative">
                <AiAvatar imageUrl={avatarUrl} />
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white"></span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-strong transition-colors duration-500">{aiName}</h1>
              <p className="text-sm text-subtle transition-colors duration-500">Online</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <MoodSelector 
                currentMood={currentMood}
                isManual={isManualMood}
                onSelect={onMoodChange}
            />
             <button
                onClick={() => onImageGenerationToggle(!isImageGenerationEnabled)}
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 border border-themed focus:outline-none focus:ring-2 focus:ring-primary-600 ${
                    isImageGenerationEnabled 
                    ? 'bg-input text-strong' 
                    : 'bg-slate-200 text-slate-500'
                }`}
                aria-label={isImageGenerationEnabled ? "Disable image generation" : "Enable image generation"}
                title={isImageGenerationEnabled ? "Image Generation ON" : "Image Generation OFF"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity duration-300 ${isImageGenerationEnabled ? 'opacity-100' : 'opacity-50'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                {!isImageGenerationEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )}
            </button>
             <div className="relative">
                <button
                    onClick={() => setShowExportMenu(prev => !prev)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-input text-strong hover:opacity-80 transition-all duration-200 border border-themed"
                    aria-label="More options"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>
                {showExportMenu && <ExportMenu onExport={onExport} onClose={() => setShowExportMenu(false)} />}
            </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} avatarUrl={avatarUrl} />
        ))}
        {isLoading && messages.length > 0 && <TypingIndicator avatarUrl={avatarUrl} />}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-2 md:p-4 border-t border-themed shrink-0 transition-colors duration-500 bg-main/80 backdrop-blur-sm rounded-b-xl">
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
          <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="shrink-0 w-10 h-10 bg-input text-subtle rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
              aria-label="Attach image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
           {isMicSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isLoading}
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-input text-subtle'}`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          <div className="relative flex-grow">
            <input
              ref={chatInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading || isListening}
              className="w-full h-12 px-4 pr-12 bg-input text-strong rounded-full focus:outline-none focus:ring-2 focus:ring-primary-600 transition-all duration-200"
            />
            <button
                type="button"
                onClick={() => setShowEmojiPicker(prev => !prev)}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 text-subtle rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:bg-slate-200"
                aria-label="Select emoji"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                </svg>
            </button>
          </div>
          <button
            type="submit"
            disabled={(!inputText.trim() && !imageToSend) || isLoading}
            className="shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};
