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
}

export type Mood = 'neutral' | 'happy' | 'sad' | 'playful' | 'curious';

export interface UserInfo {
  name: string;
  gender: string;
  aiName: string;
}