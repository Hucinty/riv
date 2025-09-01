import React, { useState, useEffect, useCallback } from 'react';
import { Message as MessageType, Sender, Mood, UserInfo } from './types';
import { createChatSession, getInitialGreeting, sendMessageStreamToAI, generateImage, imageToAscii, generateAvatarImage } from './services/geminiService';
import { ChatWindow } from './components/ChatWindow';
import { Onboarding } from './components/Onboarding';
import { Chat } from '@google/genai';
import { exportAsTxt, exportAsPdf } from './utils/exportUtils';


interface ImageInput {
    data: string;
    mimeType: string;
    previewUrl: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mood, setMood] = useState<Mood>('neutral');
  const [isManualMood, setIsManualMood] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [learnedFacts, setLearnedFacts] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarCache, setAvatarCache] = useState<Partial<Record<Mood, string>>>({});
  const [isImageGenerationEnabled, setIsImageGenerationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('imageGenerationEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('imageGenerationEnabled', JSON.stringify(isImageGenerationEnabled));
  }, [isImageGenerationEnabled]);


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
      
      if (!isManualMood) {
          setMood(initialResponse.mood);
      }
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
  }, [isManualMood]);
  
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      handleOnboardingComplete(JSON.parse(storedUserInfo), false);
    } else {
      setIsLoading(false);
    }
  }, [handleOnboardingComplete]);


  useEffect(() => {
    if (!userInfo) return;
    
    if (!isImageGenerationEnabled) {
      if (avatarUrl !== null) setAvatarUrl(null);
      return;
    }

    const generateAndCacheAvatar = async (currentMood: Mood) => {
        if (avatarCache[currentMood]) {
            setAvatarUrl(avatarCache[currentMood]);
            return;
        }

        // Don't clear avatar, just generate new one in background for better UX
        try {
            const newAvatarBase64 = await generateAvatarImage(userInfo, currentMood);
            if (newAvatarBase64) {
                const newAvatarUrl = `data:image/jpeg;base64,${newAvatarBase64}`;
                setAvatarUrl(newAvatarUrl);
                setAvatarCache(prev => ({ ...prev, [currentMood]: newAvatarUrl }));
            }
        } catch (error) {
            console.error("Failed to generate new avatar:", error);
        }
    };
    
    // Debounce avatar generation to prevent hitting rate limits on rapid mood changes.
    const handler = setTimeout(() => {
      generateAndCacheAvatar(mood);
    }, 2000);

    return () => {
      clearTimeout(handler);
    };

  }, [mood, userInfo, avatarCache, isImageGenerationEnabled]);


  const handleSendMessage = useCallback(async (text: string, image?: ImageInput) => {
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
    setIsLoading(true);

    const handleImageGeneration = async (prompt: string) => {
        if (!isImageGenerationEnabled) {
             setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                ...m,
                text: "Image generation is currently disabled. You can re-enable it in the header.",
            } : m));
            setIsLoading(false);
            if (!isManualMood) setMood('neutral');
            return;
        }

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
            const errorMessage = error.toString();
            const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');

            const userFacingMessage = isRateLimitError
                ? "I'm a bit busy creating things right now! Please try asking for an image again in a little bit."
                : "I tried to create an image, but something went wrong. Let's try something else!";

            setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                ...m,
                text: userFacingMessage,
            } : m));

            if (!isManualMood) setMood('sad');
        } finally {
            setIsLoading(false);
        }
    };

    sendMessageStreamToAI(
        chat,
        text,
        image ? { data: image.data, mimeType: image.mimeType } : undefined,
        {
            onData: (data) => {
                if (!isManualMood) setMood(data.mood);
                if (data.learned_facts.length > 0) {
                    setLearnedFacts(prev => [...new Set([...prev, ...data.learned_facts])]);
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
            },
            onError: (err) => {
                console.error("Streaming Error:", err);
                const errorMessage: MessageType = {
                    id: crypto.randomUUID(),
                    text: 'Sorry, I hit a snag. Could you try that again?',
                    sender: Sender.AI,
                };
                // Replace placeholder with error message
                setMessages(prev => [...prev.filter(m => m.id !== aiMessageId), errorMessage]);
                if (!isManualMood) setMood('sad');
                setIsLoading(false);
            }
        }
    );
  }, [chat, isManualMood, isImageGenerationEnabled]);
  
  const handleMoodChange = (newMood: Mood | 'auto') => {
    if (newMood === 'auto') {
        setIsManualMood(false);
    } else {
        setIsManualMood(true);
        setMood(newMood);
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
    <div data-theme={mood} className="bg-body font-sans flex items-center justify-center min-h-screen transition-colors duration-500">
      <ChatWindow
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        avatarUrl={avatarUrl}
        aiName={userInfo.aiName}
        currentMood={mood}
        isManualMood={isManualMood}
        onMoodChange={handleMoodChange}
        onExport={handleExport}
        isImageGenerationEnabled={isImageGenerationEnabled}
        onImageGenerationToggle={setIsImageGenerationEnabled}
      />
    </div>
  );
};

export default App;