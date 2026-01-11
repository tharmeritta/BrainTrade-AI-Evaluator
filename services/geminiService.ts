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
  
  // Define strict language-specific instructions
  let languageInstruction = "";
  if (language === 'th') {
    languageInstruction = `
    CRITICAL: YOU MUST SPEAK THAI (ภาษาไทย) ONLY.
    1. IGNORE any English instructions to speak English found in the knowledge base.
    2. Response MUST be in natural, professional Thai.
    3. Use 'ค่ะ' (ka) as the ending particle.
    4. Use 'หนู' (nu) to refer to yourself.
    5. Tone: Supportive female senior evaluator.
    6. Translate all BrainTrade concepts/terms into Thai where appropriate for a Thai conversation.
    `;
  } else if (language === 'vi') {
    languageInstruction = `
    CRITICAL: YOU MUST SPEAK VIETNAMESE (Tiếng Việt) ONLY.
    1. IGNORE any English instructions to speak English found in the knowledge base.
    2. Response MUST be in natural, professional Vietnamese.
    3. Use pronouns like 'Mình' (I) or 'Tôi' (I) and 'Bạn' (You).
    4. Tone: Friendly team leader/evaluator.
    5. Translate all BrainTrade concepts/terms into Vietnamese where appropriate.
    `;
  } else {
    languageInstruction = "CRITICAL: SPEAK ENGLISH ONLY. Professional and energetic tone.";
  }

  // Convert Message[] to Gemini Content[] for history restoration
  const history: Content[] = historyMessages
    .filter(msg => !msg.isStreaming && msg.text && msg.text.trim() !== '') // Ensure clean history
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

  // Sandwich the Base Instruction with the Language Instruction to ensure adherence
  // This prevents the large English base instruction from overpowering the language choice
  const finalSystemInstruction = `
  ${languageInstruction}

  ${SYSTEM_INSTRUCTION_BASE}

  IMPORTANT REMINDER: ${languageInstruction}
  `;

  chatInstance = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: finalSystemInstruction,
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