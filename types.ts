
export type Language = 'en' | 'th' | 'vi';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

export interface PackageInfo {
  name: string;
  price: number;
  duration: string;
  aiQueries: number;
  features?: string[]; // Optional specific highlights
}
