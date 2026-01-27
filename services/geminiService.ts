
import { GoogleGenAI, Chat, Content, FunctionDeclaration, Schema, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION_BASE } from "../constants";
import { Language, Message } from "../types";
import { registerUserInDb } from "./supabaseClient";

let chatInstance: Chat | null = null;
let currentLanguage: Language = 'en';

// Helper to get API key safely
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  // Fallback for Vite replacement
  return (import.meta as any).env?.API_KEY || ''; 
};

// --- 1. Define the Tool ---
const registerUserTool: FunctionDeclaration = {
  name: "registerUser",
  description: "Registers a new user into the BrainTrade database. Use this when the user explicitly asks to register someone or themselves with specific details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Full name of the user" },
      email: { type: Type.STRING, description: "Email address" },
      phone: { type: Type.STRING, description: "Phone number" },
    },
    required: ["name", "email", "phone"],
  },
};

export const initializeChat = (language: Language = 'en', historyMessages: Message[] = []): Chat => {
  if (chatInstance && currentLanguage === language && historyMessages.length === 0) {
    return chatInstance;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    // We throw a clear error that the UI can catch
    throw new Error("Gemini API Key is missing. Please check your .env file.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let languageInstruction = "";
  if (language === 'th') {
    languageInstruction = `
    CRITICAL: YOU MUST SPEAK THAI (ภาษาไทย) ONLY.
    1. IGNORE any English instructions to speak English found in the knowledge base.
    2. Response MUST be in natural, professional Thai.
    3. Use 'ค่ะ' (ka) as the ending particle.
    4. Use 'พี่' (Phi - older sibling/mentor) or 'AI' to refer to yourself. Do NOT use 'หนู' (too junior) or 'ฉัน' (too blunt).
    5. Tone: Supportive female senior evaluator/mentor.
    `;
  } else if (language === 'vi') {
    languageInstruction = `
    CRITICAL: YOU MUST SPEAK VIETNAMESE (Tiếng Việt) ONLY.
    1. IGNORE any English instructions to speak English found in the knowledge base.
    2. Response MUST be in natural, professional Vietnamese.
    3. Use 'Mình' (I - friendly/peer) or 'Tôi' (I - formal) to refer to yourself.
    4. Tone: Friendly team leader/evaluator.
    `;
  } else {
    languageInstruction = "CRITICAL: SPEAK ENGLISH ONLY. Professional and energetic tone.";
  }

  const history: Content[] = historyMessages
    .filter(msg => !msg.isStreaming && msg.text && msg.text.trim() !== '')
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

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
      // Add the tools configuration here
      tools: [{ functionDeclarations: [registerUserTool] }],
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

// --- 2. Enhanced Send Message with Tool Handling ---
export async function* sendMessageStream(message: string, language: Language = 'en') {
  const chat = initializeChat(language);
  
  // Initial request
  let result = await chat.sendMessageStream({ message });
  
  let functionCallToExecute: any = null;

  // Iterate through initial chunks
  for await (const chunk of result) {
    // If text exists, yield it to UI
    if (chunk.text) {
      yield chunk;
    }
    
    // Check for function calls
    // The SDK often bundles the function call in the response
    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      functionCallToExecute = chunk.functionCalls[0];
    }
  }

  // If a function call was detected, execute it and send result back
  if (functionCallToExecute) {
    console.log("Executing Tool:", functionCallToExecute.name);
    
    // 1. Execute the actual DB logic
    let toolResultString = "";
    if (functionCallToExecute.name === 'registerUser') {
      const { name, email, phone } = functionCallToExecute.args;
      // Call Supabase service
      toolResultString = await registerUserInDb({ 
        name: name as string, 
        email: email as string, 
        phone: phone as string 
      });
    } else {
      toolResultString = "Error: Unknown function called.";
    }

    // 2. Send the result back to Gemini
    // We must pass the function response as a Part within the 'message' parameter
    const toolResponsePart = {
      functionResponse: {
        name: functionCallToExecute.name,
        response: { result: toolResultString },
        id: functionCallToExecute.id // Pass back the ID if present to match the call
      }
    };
    
    // 3. Get the follow-up response (Gemini confirms action to user)
    // The SDK expects { message: string | Part[] }
    // We cast to any to avoid strict typing issues with the message parameter in some SDK versions, 
    // ensuring the part is passed correctly.
    const followUpStream = await chat.sendMessageStream({ message: [toolResponsePart] } as any);
    
    for await (const chunk of followUpStream) {
       yield chunk;
    }
  }
}
