import { GoogleGenAI, Chat, Content } from "@google/genai";
import { SYSTEM_INSTRUCTION_BASE } from "../constants";
import { Language, Message } from "../types";

let chatInstance: Chat | null = null;
let currentLanguage: Language = 'en';

export const initializeChat = (language: Language = 'en', historyMessages: Message[] = []): Chat => {
  // If instance exists, language matches, AND we aren't trying to force a restore with history
  if (chatInstance && currentLanguage === language && historyMessages.length === 0) {
    return chatInstance;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    throw new Error("API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Define language-specific instruction
  let languageInstruction = "";
  if (language === 'th') {
    languageInstruction = "IMPORTANT: YOU MUST SPEAK NATURAL, PROFESSIONAL THAI (ภาษาไทย) ONLY. Use 'ค่ะ' (ka) exclusively as the polite particle. Use 'หนู' (nu) as your self-reference pronoun. Act as a supportive female senior evaluator guiding a junior telesales agent. Translate all training concepts to Thai.";
  } else if (language === 'vi') {
    languageInstruction = "IMPORTANT: YOU MUST SPEAK NATURAL, PROFESSIONAL VIETNAMESE (Tiếng Việt) ONLY. Use pronouns like 'Mình' (I) and 'Bạn' (You) to sound like a friendly team leader/evaluator. Translate all training concepts to Vietnamese.";
  } else {
    languageInstruction = "IMPORTANT: SPEAK ENGLISH ONLY. Professional and energetic tone.";
  }

  // Convert Message[] to Gemini Content[] for history restoration
  const history: Content[] = historyMessages
    .filter(msg => !msg.isStreaming && msg.text && msg.text.trim() !== '') // Ensure clean history
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

  chatInstance = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION_BASE}\n\n${languageInstruction}`,
      temperature: 0.7, 
    },
    history: history
  });
  
  currentLanguage = language;
  return chatInstance;
};

export const resetChat = (language: Language = 'en') => {
  chatInstance = null;
  return initializeChat(language);
};

export const sendMessageStream = async (message: string, language: Language = 'en') => {
  const chat = initializeChat(language);
  return await chat.sendMessageStream({ message });
};