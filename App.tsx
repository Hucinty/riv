import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message as MessageType, Sender, Mood, UserInfo } from './types';
import { createChatSession, getInitialGreeting, sendMessageStreamToAI, generateImage, imageToAscii, LiveSession, AudioPlayer } from './services/geminiService';
import { ChatWindow } from './components/ChatWindow';
import { Onboarding } from './components/Onboarding';
import { Chat } from '@google/genai';
import { exportAsTxt, exportAsPdf } from './utils/exportUtils';


interface ImageInput {
    data: string;
    mimeType: string;
    previewUrl: string;
}

const ALL_MOODS: Readonly<Mood[]> = ['neutral', 'happy', 'sad', 'playful', 'curious', 'code'];

const App: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mood, setMood] = useState<Mood>('neutral');
  const [isManualMood, setIsManualMood] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [learnedFacts, setLearnedFacts] = useState<string[]>([]);
  const moodIndexRef = useRef(0);

  // Voice Session State
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const audioPlayer = useRef<AudioPlayer | null>(null);
  const partialMessageId = useRef<string | null>(null);

  useEffect(() => {
    // Initialize the audio player once.
    audioPlayer.current = new AudioPlayer();
  }, []);

  const cycleMood = useCallback(() => {
    if (isManualMood) return;
    moodIndexRef.current = (moodIndexRef.current + 1) % ALL_MOODS.length;
    setMood(ALL_MOODS[moodIndexRef.current]);
  }, [isManualMood]);

  const handleOnboardingComplete = useCallback(async (info: UserInfo, saveToStorage = true) => {
    setIsLoading(true);
    setUserInfo(info);
    if (saveToStorage) {
      localStorage.setItem('userInfo', JSON.stringify(info));
    }
    
    try {
      const chatSession = createChatSession(info);
      setChat(chatSession);
      
      const userLang = navigator.language || 'en';
      const initialResponse = await getInitialGreeting(chatSession, info.aiName, userLang);
      
      const initialMood = 'neutral';
      moodIndexRef.current = ALL_MOODS.indexOf(initialMood);
      setMood(initialMood);

      setMessages([{
        id: crypto.randomUUID(),
        text: initialResponse.text,
        sender: Sender.AI,
      }]);

      if (initialResponse.learned_facts.length > 0) {
        setLearnedFacts(prev => [...new Set([...prev, ...initialResponse.learned_facts])]);
      }

    } catch (error) {
       console.error("Initialization failed:", error);
       setMessages([{
        id: crypto.randomUUID(),
        text: "Hello! I'm having a little trouble starting up. Please refresh the page.",
        sender: Sender.AI,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      handleOnboardingComplete(JSON.parse(storedUserInfo), false);
    } else {
      setIsLoading(false);
    }
  }, [handleOnboardingComplete]);


  const handleSendMessage = useCallback(async (text: string, image?: ImageInput, options?: { isCode?: boolean }) => {
    if ((!text.trim() && !image) || !chat) return;

    const userMessage: MessageType = {
      id: crypto.randomUUID(),
      text,
      sender: Sender.USER,
      imageUrl: image?.previewUrl,
    };
    
    const aiMessageId = crypto.randomUUID();
    const aiMessagePlaceholder: MessageType = {
        id: aiMessageId,
        text: '',
        sender: Sender.AI,
    };

    setMessages(prev => [...prev, userMessage, aiMessagePlaceholder]);
    cycleMood();
    setIsLoading(true);

    const handleImageGeneration = async (prompt: string) => {
        try {
            const imageBase64 = await generateImage(prompt);
            const asciiArt = await imageToAscii(imageBase64);
            setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                ...m,
                text: 'Here is the image you asked for! What do you think?',
                asciiArt
            } : m));
        } catch (error: any) {
            console.error("Image generation process failed:", error);
            // Silently fail by removing the placeholder message
            setMessages(prev => prev.filter(m => m.id !== aiMessageId));
        } finally {
            setIsLoading(false);
            cycleMood();
        }
    };
    
    const textForAI = options?.isCode ? `Generate a code snippet for: ${text}` : text;

    sendMessageStreamToAI(
        chat,
        textForAI,
        image ? { data: image.data, mimeType: image.mimeType } : undefined,
        {
            onData: (data) => {
                if (data.learned_facts.length > 0) {
                    setLearnedFacts(prev => [...new Set([...prev, ...data.learned_facts])]);
                }
                if (data.is_code_block && data.code_block_content && data.code_block_language) {
                    setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                        ...m,
                        codeBlockContent: data.code_block_content,
                        codeBlockLanguage: data.code_block_language,
                    } : m));
                }
            },
            onChunk: (textChunk) => {
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: m.text + textChunk } : m));
            },
            onImageRequired: (prompt) => {
                handleImageGeneration(prompt);
            },
            onComplete: () => {
                setIsLoading(false);
                cycleMood();
            },
            onError: (err) => {
                console.error("Streaming Error:", err);
                // Display an error message to the user instead of failing silently.
                setMessages(prev => prev.map(m => 
                    m.id === aiMessageId 
                    ? { ...m, text: "I'm sorry, I had a little trouble responding. Could you please try that again?" } 
                    : m
                ));
                setIsLoading(false);
                cycleMood();
            }
        }
    );
  }, [chat, cycleMood]);

  const handleToggleVoiceSession = async () => {
    if (isVoiceSessionActive) {
      await liveSession?.stop();
      return;
    }
    
    if (!userInfo) return;
    
    const handleTranscriptionUpdate = (text: string, isFinal: boolean, sender: Sender) => {
        if (!partialMessageId.current) {
            const newId = crypto.randomUUID();
            partialMessageId.current = newId;
            setMessages(prev => [...prev, { id: newId, text, sender, isPartial: true }]);
        } else {
            setMessages(prev => prev.map(m => m.id === partialMessageId.current ? { ...m, text, isPartial: !isFinal } : m));
            if (isFinal) {
                partialMessageId.current = null;
            }
        }
    };

    const session = new LiveSession(userInfo, {
        onTranscriptionUpdate: handleTranscriptionUpdate,
        onAudioUpdate: (audioData) => {
            audioPlayer.current?.play(audioData);
        },
        onToolCall: (name, args) => {
            if (name === 'playMusic') {
                const songInfo = args.artist ? `${args.songName} by ${args.artist}` : args.songName;
                const systemMessage: MessageType = {
                    id: crypto.randomUUID(),
                    text: `[System: Playing "${songInfo}"]`,
                    sender: Sender.AI
                };
                setMessages(prev => [...prev, systemMessage]);
            }
        },
        onClose: () => {
            setIsVoiceSessionActive(false);
            setLiveSession(null);
            partialMessageId.current = null;
            audioPlayer.current?.stopAll();
        },
        onError: (error) => {
            console.error('Live session error:', error);
            const errorMessage: MessageType = {
                id: crypto.randomUUID(),
                text: "[System: Sorry, the voice connection failed.]",
                sender: Sender.AI
            };
            setMessages(prev => [...prev, errorMessage]);
        }
    });

    try {
      await session.start();
      setLiveSession(session);
      setIsVoiceSessionActive(true);
    } catch(error) {
       console.error("Failed to start live session:", error);
       alert("Could not start voice chat. Please ensure your microphone is enabled and permissions are granted.");
    }
  };
  
  const handleMoodChange = (newMood: Mood | 'auto') => {
    if (newMood === 'auto') {
        setIsManualMood(false);
    } else {
        setIsManualMood(true);
        setMood(newMood);
        const newIndex = ALL_MOODS.indexOf(newMood);
        if (newIndex > -1) {
            moodIndexRef.current = newIndex;
        }
    }
  };

  const handleExport = (format: 'txt' | 'pdf') => {
    if (!userInfo) return;
    if (format === 'txt') {
        exportAsTxt(userInfo, learnedFacts);
    } else {
        exportAsPdf(userInfo, learnedFacts);
    }
  };
  
  if (!userInfo) {
      return (
        <div className="bg-body font-sans flex items-center justify-center min-h-screen">
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      );
  }

  return (
    <div data-theme={mood} className="bg-body font-sans min-h-screen transition-colors duration-500">
      <ChatWindow
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        userInfo={userInfo}
        learnedFacts={learnedFacts}
        currentMood={mood}
        isManualMood={isManualMood}
        onMoodChange={handleMoodChange}
        onExport={handleExport}
        isVoiceSessionActive={isVoiceSessionActive}
        onToggleVoiceSession={handleToggleVoiceSession}
      />
    </div>
  );
};

export default App;