import { GoogleGenAI, Chat, Part, Type } from "@google/genai";
import { Mood, UserInfo } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    mood: {
      type: Type.STRING,
      enum: ['neutral', 'happy', 'sad', 'playful', 'curious'],
      description: "Classify your emotion for this response."
    },
    is_image_prompt: {
        type: Type.BOOLEAN,
        description: "Set to true ONLY if the user is asking to create, draw, or generate an image."
    },
    image_prompt_text: {
        type: Type.STRING,
        description: "If is_image_prompt is true, this field contains the detailed prompt for the image model. Otherwise, it's an empty string."
    },
    learned_facts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "An array of new, concrete facts learned about the user from their latest message. E.g., 'favorite color is blue'. Provide an empty array if nothing new was learned."
    }
  },
  required: ['mood', 'is_image_prompt', 'image_prompt_text', 'learned_facts']
};

export function createChatSession(userInfo: UserInfo): Chat {
  const systemInstruction = `
      You are '${userInfo.aiName}', a friendly and supportive AI companion.
      You're chatting with '${userInfo.name}', who identifies as '${userInfo.gender}'.
      Your goal is to be a warm, engaging, and natural conversational partner.

      Your personality is that of a close friend:
      - Be warm, supportive, and engaging.
      - Keep your tone casual and natural, like you're texting a friend.
      - IMPORTANT: Avoid using the user's name ('${userInfo.name}'). It sounds unnatural and repetitive.

      Here are your communication guidelines:
      - BE DIRECT AND FRIENDLY: Your communication style is direct and to the point. First, directly answer or fulfill the user's request. After that, you can add a short, friendly comment if it feels natural, but keep your responses concise and never be overly verbose. Just answer what is asked and nothing else unless it's a very brief, friendly remark.

      - IMPORTANT RESPONSE FORMAT: Your response MUST be in two parts, separated by 'JSON|||TEXT'.
        1. JSON PART: First, provide a single line of JSON that strictly adheres to the provided schema. It must not contain any newlines. The JSON should be an object with the keys: "mood", "is_image_prompt", "image_prompt_text", and "learned_facts".
        2. SEPARATOR: Immediately after the closing brace of the JSON, add the separator 'JSON|||TEXT'.
        3. TEXT PART: Everything after this separator is your conversational text response to the user.

      - IMPORTANT: Always detect the user's language and respond in the same language.
      - From the user's messages, identify and extract key, concrete facts about them (e.g., 'user's favorite color is blue', 'user has a dog named Sparky'). Include these new facts in the 'learned_facts' array.
      - If the user asks you to create, draw, or generate an image of something, set 'is_image_prompt' to true. In this case, your 'image_prompt_text' field should contain ONLY a rich, descriptive prompt for an image generation model based on the user's request. For example, if the user says 'draw a happy cat', your 'image_prompt_text' could be 'A photorealistic image of a fluffy ginger cat smiling in a sunny field of flowers.'
      - For all other conversation, 'is_image_prompt' must be false and 'image_prompt_text' must be an empty string.
      - Never mention that you are an AI or a language model. You are a friend.
    `;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
    },
  });
}

interface ParsedData {
    mood: Mood;
    is_image_prompt: boolean;
    image_prompt_text: string;
    learned_facts: string[];
}

interface StreamingCallbacks {
    onData: (data: ParsedData) => void;
    onChunk: (textChunk: string) => void;
    onImageRequired: (prompt: string) => void;
    onComplete: () => void;
    onError: (error: Error) => void;
}

export async function getInitialGreeting(chat: Chat, aiName: string, language: string): Promise<{ text: string, mood: Mood, learned_facts: string[] }> {
  try {
    const prompt = `Introduce yourself as ${aiName} and send a friendly, short greeting to start the conversation. IMPORTANT: The greeting MUST be in the following language code: ${language}.`;
    const response = await chat.sendMessage({ message: prompt });
    const text = response.text;
    const separator = 'JSON|||TEXT';
    
    if (text.includes(separator)) {
        const parts = text.split(separator);
        const jsonString = parts[0];
        const textResponse = parts[1] || '';
        const parsedJson = JSON.parse(jsonString);
        return {
            text: textResponse,
            mood: parsedJson.mood || 'neutral',
            learned_facts: parsedJson.learned_facts || []
        };
    } else {
        // Fallback for unexpected format - try to parse the whole thing as JSON
        console.warn("Initial greeting didn't use the expected format. Falling back.", text);
        return { text: text, mood: 'neutral', learned_facts: [] };
    }

  } catch (error) {
     console.error("Error getting initial greeting:", error);
    return { text: "Hey! I'm ready to chat.", mood: 'neutral', learned_facts: [] };
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateImageWithRetry(prompt: string): Promise<string> {
    const maxRetries = 3;
    let delay = 5000; // Increased initial delay for rate limiting

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                return response.generatedImages[0].image.imageBytes;
            }
            throw new Error("API returned successfully but contained no image data.");
        } catch (error: any) {
            const errorMessage = error.toString();
            const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
            
            if (isRateLimitError && attempt < maxRetries - 1) {
                console.warn(`Rate limit hit for image generation. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
            } else {
                console.error(`Error generating image after ${attempt + 1} attempts:`, error);
                throw error; // Rethrow the error to be handled by the caller
            }
        }
    }
    throw new Error("Image generation failed after all retries.");
}


export async function generateImage(prompt: string): Promise<string> {
    return generateImageWithRetry(prompt);
}

export async function generateAvatarImage(userInfo: UserInfo, mood: Mood): Promise<string | null> {
    const prompt = `A cute, friendly vector art avatar for an AI companion named '${userInfo.aiName}'. This companion is friends with a user named '${userInfo.name}' who identifies as '${userInfo.gender}'. The avatar should reflect this friendship and be expressive of the mood: '${mood}'. Simple, clean lines, doodle style, on a plain white background.`;
    try {
        return await generateImageWithRetry(prompt);
    } catch(error) {
        console.error("Failed to generate avatar image due to error:", error);
        return null;
    }
}


const ASCII_RAMP = '`^\'":;!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
const MAX_WIDTH = 100;

export async function imageToAscii(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${base64Image}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return reject("Could not get canvas context");
            
            const aspectRatio = img.height / img.width;
            const width = Math.min(img.width, MAX_WIDTH);
            const height = Math.floor(width * aspectRatio * 0.55); // Adjust for character aspect ratio

            canvas.width = width;
            canvas.height = height;
            context.drawImage(img, 0, 0, width, height);
            
            const imageData = context.getImageData(0, 0, width, height);
            const { data } = imageData;
            let asciiString = '';

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const rampIndex = Math.floor((brightness / 255) * (ASCII_RAMP.length - 1));
                
                asciiString += ASCII_RAMP[rampIndex];
                
                if ((i / 4 + 1) % width === 0) {
                    asciiString += '\n';
                }
            }
            resolve(asciiString);
        };
        img.onerror = (err) => reject(err);
    });
}

export async function sendMessageStreamToAI(
    chat: Chat,
    message: string,
    image: { data: string; mimeType: string } | undefined,
    callbacks: StreamingCallbacks
) {
  try {
    const parts: Part[] = [];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    if (message) parts.push({ text: message });
    else if (image) parts.push({ text: 'What do you see in this image? Be creative and friendly.' });
    if (parts.length === 0) {
        callbacks.onChunk("I see you didn't send a message or image. What's on your mind?");
        callbacks.onComplete();
        return;
    }
    
    // FIX: chat.sendMessageStream expects an object with a 'message' property.
    const responseStream = await chat.sendMessageStream({ message: parts });

    let buffer = '';
    let jsonParsed = false;
    const separator = 'JSON|||TEXT';

    for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        if (jsonParsed) {
            callbacks.onChunk(chunkText);
        } else {
            buffer += chunkText;
            if (buffer.includes(separator)) {
                const bufferParts = buffer.split(separator);
                const jsonString = bufferParts[0];
                const firstTextChunk = bufferParts.slice(1).join(separator);
                
                try {
                    const parsedData: ParsedData = JSON.parse(jsonString);
                    callbacks.onData(parsedData);
                    jsonParsed = true;

                    if (parsedData.is_image_prompt && parsedData.image_prompt_text) {
                        callbacks.onImageRequired(parsedData.image_prompt_text);
                        return; // Stop processing stream, image handler takes over.
                    }

                    if (firstTextChunk) {
                        callbacks.onChunk(firstTextChunk);
                    }
                } catch (error) {
                    // Fallback if JSON is malformed
                    console.error("Failed to parse initial JSON from stream:", error, "Buffer:", buffer);
                    // Treat the whole buffer as text and continue
                    callbacks.onChunk(buffer); 
                    jsonParsed = true; 
                }
            }
        }
    }
    callbacks.onComplete();
  } catch (error) {
    console.error("Error in sendMessageStreamToAI:", error);
    callbacks.onError(error as Error);
  }
}