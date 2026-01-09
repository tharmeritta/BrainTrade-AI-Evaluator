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
  courses: number;
  ebooks: number;
  tools: number;
  features: string[];
}