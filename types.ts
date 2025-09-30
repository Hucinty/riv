export enum Sender {
  USER = 'USER',
  AI = 'AI',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  imageUrl?: string;
  asciiArt?: string;
  codeBlockContent?: string;
  codeBlockLanguage?: string;
  isPartial?: boolean;
}

export type Mood = 'neutral' | 'happy' | 'sad' | 'playful' | 'curious' | 'code';

export interface UserInfo {
  name: string;
  gender: string;
  aiName: string;
}
