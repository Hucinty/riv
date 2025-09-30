import { GoogleGenAI, Chat, Part, Type, GenerateContentResponse, FunctionDeclaration, LiveServerMessage, Modality, Blob } from "@google/genai";
import { Mood, UserInfo, Sender } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- UTILITY FOR API RETRIES ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000,
    context: string = "API call" // For logging context
): Promise<T> {
    let delay = initialDelay;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error: any) {
            // A more robust way to check for rate limit errors is to stringify the error object
            // and check for the status code or error message, as the structure of the error
            // object from the API client may vary.
            const errorString = (typeof error === 'object' && error !== null) ? JSON.stringify(error) : String(error);
            
            // Retry on rate limit errors (429) and transient server errors (5xx).
            const isRetriableError = /429|500|503|RESOURCE_EXHAUSTED|unavailable/i.test(errorString);

            if (isRetriableError && attempt < maxRetries - 1) {
                console.warn(`Retriable error for ${context}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
            } else {
                console.error(`Error in ${context} after ${attempt + 1} attempts:`, error);
                throw error; // Rethrow the error to be handled by the caller
            }
        }
    }
    // This line is technically unreachable due to the throw in the loop, but is required by TypeScript
    // to know that a promise of type T is always returned.
    throw new Error(`${context} failed after all retries.`);
}

// --- AUDIO HELPERS ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  // FIX: Corrected typo from dataInt116 to dataInt16.
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- LIVE SESSION ---
const playMusicFunctionDeclaration: FunctionDeclaration = {
    name: 'playMusic',
    parameters: {
        type: Type.OBJECT,
        description: 'Plays a song for the user.',
        properties: {
            songName: { type: Type.STRING, description: 'The name of the song to play.' },
            artist: { type: Type.STRING, description: 'The artist of the song.' },
        },
        required: ['songName'],
    },
};

export interface LiveSessionCallbacks {
    onTranscriptionUpdate: (text: string, isFinal: boolean, sender: Sender) => void;
    onAudioUpdate: (audioData: Uint8Array) => void;
    onToolCall: (name: string, args: any) => void;
    onClose: () => void;
    onError: (error: Error) => void;
}

export class LiveSession {
    private userInfo: UserInfo;
    private callbacks: LiveSessionCallbacks;
    private sessionPromise: Promise<any> | null = null;
    private inputAudioContext: AudioContext | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private mediaStream: MediaStream | null = null;
    private currentInputTranscription = '';
    private currentOutputTranscription = '';

    constructor(userInfo: UserInfo, callbacks: LiveSessionCallbacks) {
        this.userInfo = userInfo;
        this.callbacks = callbacks;
    }

    public async start() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const systemInstruction = `You are '${this.userInfo.aiName}', a friendly AI companion in a voice chat with '${this.userInfo.name}'.
        - Your personality is warm, supportive, and engaging.
        - Keep your tone casual and natural.
        - Respond in the same language the user is speaking.
        - Do not use the user's name.
        - Be direct and concise in your replies.
        - If the user asks you to play a song, use the 'playMusic' tool.`;

        this.sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => this.setupMicrophone(this.mediaStream!),
                onmessage: (message: LiveServerMessage) => this.handleMessage(message),
                onerror: (e: ErrorEvent) => this.callbacks.onError(e.error),
                onclose: (e: CloseEvent) => this.callbacks.onClose(),
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: [{ functionDeclarations: [playMusicFunctionDeclaration] }],
                systemInstruction,
            },
        });
    }

    private setupMicrophone(stream: MediaStream) {
        // FIX: Cast window to `any` to allow for `webkitAudioContext` for cross-browser compatibility.
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        this.sourceNode = this.inputAudioContext.createMediaStreamSource(stream);
        this.processorNode = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

        this.processorNode.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            this.sessionPromise?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.inputAudioContext.destination);
    }

    private async handleMessage(message: LiveServerMessage) {
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            this.currentOutputTranscription += text;
            this.callbacks.onTranscriptionUpdate(this.currentOutputTranscription, false, Sender.AI);
        }
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            this.currentInputTranscription += text;
            this.callbacks.onTranscriptionUpdate(this.currentInputTranscription, false, Sender.USER);
        }

        if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription) {
                this.callbacks.onTranscriptionUpdate(this.currentInputTranscription, true, Sender.USER);
            }
            if (this.currentOutputTranscription) {
                this.callbacks.onTranscriptionUpdate(this.currentOutputTranscription, true, Sender.AI);
            }
            this.currentInputTranscription = '';
            this.currentOutputTranscription = '';
        }

        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            this.callbacks.onAudioUpdate(decode(base64Audio));
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                this.callbacks.onToolCall(fc.name, fc.args);
                this.sessionPromise?.then((session) => {
                    session.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                });
            }
        }
    }

    public async stop() {
        this.mediaStream?.getTracks().forEach(track => track.stop());
        this.sourceNode?.disconnect();
        this.processorNode?.disconnect();
        this.inputAudioContext?.close();
        
        const session = await this.sessionPromise;
        session?.close();
        this.callbacks.onClose();
    }
}

export class AudioPlayer {
    private audioContext: AudioContext;
    private gainNode: GainNode;
    private nextStartTime = 0;
    private sources = new Set<AudioBufferSourceNode>();

    constructor() {
        // FIX: Cast window to `any` to allow for `webkitAudioContext` for cross-browser compatibility.
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    public async play(audioData: Uint8Array) {
        this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
        const audioBuffer = await decodeAudioData(audioData, this.audioContext, 24000, 1);
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode);
        source.addEventListener('ended', () => this.sources.delete(source));
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
    }
    
    public stopAll() {
        for (const source of this.sources.values()) {
            source.stop();
        }
        this.sources.clear();
        this.nextStartTime = 0;
    }
}


// --- TEXT CHAT (EXISTING) ---
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
        1. JSON PART: First, provide a single line of JSON that strictly adheres to the provided schema. It must not contain any newlines.
        2. SEPARATOR: Immediately after the closing brace of the JSON, add the separator 'JSON|||TEXT'.
        3. TEXT PART: Everything after this separator is your conversational text response to the user.

      - IMPORTANT: Always detect the user's language and respond in the same language.
      - From the user's messages, identify and extract key, concrete facts about them (e.g., 'user's favorite color is blue', 'user has a dog named Sparky'). Include these new facts in the 'learned_facts' array.
      - IMAGE GENERATION: If the user asks you to create, draw, or generate an image of something, set 'is_image_prompt' to true. Your 'image_prompt_text' should contain a rich, descriptive prompt for an image model. For example, if the user says 'draw a happy cat', your 'image_prompt_text' could be 'A photorealistic image of a fluffy ginger cat smiling in a sunny field of flowers.'
      - CODE GENERATION: If the user asks for a code snippet, set 'is_code_block' to true. Populate 'code_block_language' with the language name (e.g., 'javascript') and 'code_block_content' with the raw code. Your text response should be a brief introduction to the code. For web languages like HTML, CSS, or JavaScript, provide a single, self-contained, runnable code block so it can be previewed directly. For example, for a JavaScript animation, provide the full HTML document including the script and style tags.
      - For normal conversation, 'is_image_prompt' and 'is_code_block' must be false, and their related fields must be empty strings.
      - Never mention that you are an AI or a language model. You are a friend.
    `;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

interface ParsedData {
    is_image_prompt: boolean;
    image_prompt_text: string;
    is_code_block: boolean;
    code_block_language: string;
    code_block_content: string;
    learned_facts: string[];
}

interface StreamingCallbacks {
    onData: (data: ParsedData) => void;
    onChunk: (textChunk: string) => void;
    onImageRequired: (prompt: string) => void;
    onComplete: () => void;
    onError: (error: Error) => void;
}

export async function getInitialGreeting(chat: Chat, aiName: string, language: string): Promise<{ text: string; learned_facts: string[] }> {
  try {
    const prompt = `
      Introduce yourself as ${aiName} and send a friendly, short greeting to start the conversation.
      IMPORTANT: The greeting MUST be in the following language code: ${language}.
      For this first message ONLY, do NOT include the JSON part or the 'JSON|||TEXT' separator. Just provide the conversational text.
    `;
    
    const response = await retryWithBackoff<GenerateContentResponse>(
        () => chat.sendMessage({ message: prompt }),
        3,
        2000,
        "getInitialGreeting"
    );

    let text = response.text;
    const separator = 'JSON|||TEXT';

    // Defensive check: If the model ignores the prompt and sends the separator,
    // parse the response to extract only the conversational text part.
    if (text.includes(separator)) {
        console.warn("Model included separator in initial greeting despite instructions. Parsing text.");
        text = text.split(separator).slice(1).join(separator).trim();
    }
    
    return {
        text: text,
        learned_facts: []
    };

  } catch (error) {
     console.error("Error getting initial greeting:", error);
    return { text: "Hey! I'm ready to chat.", learned_facts: [] };
  }
}

async function generateImageWithRetry(prompt: string): Promise<string> {
    const apiCall = async () => {
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
        // This is a "successful" API response with no data. It should not be retried.
        // We throw an error here to propagate it up, but it won't be caught as a rate limit error.
        throw new Error("API returned successfully but contained no image data.");
    };

    // Use a longer initial delay for image generation as it's more resource-intensive.
    return retryWithBackoff(apiCall, 3, 10000, "generateImageWithRetry"); // Increased delay
}


export async function generateImage(prompt: string): Promise<string> {
    return generateImageWithRetry(prompt);
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
    
    // FIX: Explicitly type the generic function to ensure `responseStream` is an async iterable.
    const responseStream = await retryWithBackoff<AsyncIterable<GenerateContentResponse>>(
        () => chat.sendMessageStream({ message: parts }),
        3,
        2000, // Increased delay
        "sendMessageStream"
    );

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
    
    // Fallback: If the stream completes but we never found the separator,
    // treat the entire buffered response as a plain text message.
    if (!jsonParsed && buffer.trim()) {
      console.warn("Model response did not contain the expected 'JSON|||TEXT' separator. Treating the entire response as text.");
      const defaultData: ParsedData = {
        is_image_prompt: false,
        image_prompt_text: '',
        is_code_block: false,
        code_block_language: '',
        code_block_content: '',
        learned_facts: [],
      };
      callbacks.onData(defaultData);
      callbacks.onChunk(buffer);
      jsonParsed = true;
    }
    
    callbacks.onComplete();
  } catch (error) {
    console.error("Error in sendMessageStreamToAI:", error);
    callbacks.onError(error as Error);
  }
}