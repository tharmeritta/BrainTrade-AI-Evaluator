import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Menu, X, Trophy, Type, Minus, Plus } from 'lucide-react';
import { sendMessageStream, resetChat, initializeChat } from './services/geminiService';
import { loadState, saveState, clearState } from './services/storageService';
import { Message, Language } from './types';
import { MessageBubble } from './components/MessageBubble';
import { PackageReference } from './components/PackageReference';
import { TRANSLATIONS } from './constants';
import { GenerateContentResponse } from '@google/genai';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
];

// 16px is the default browser base (1rem). We scale around it.
const FONT_SIZES = ['14px', '16px', '18px', '20px', '22px'];
const DEFAULT_FONT_INDEX = 1; // 16px

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [score, setScore] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(DEFAULT_FONT_INDEX);
  const [isRestoring, setIsRestoring] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];

  // Update document title when language changes
  useEffect(() => {
    document.title = t.title;
  }, [t.title]);

  // Load state on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedState = await loadState();
      if (savedState) {
        setLanguage(savedState.language);
        setScore(savedState.score);
        setFontSizeIndex(savedState.fontSizeIndex);
        setMessages(savedState.messages);
        
        // Restore chat context with Google GenAI with history
        // This ensures the AI remembers the conversation
        try {
          initializeChat(savedState.language, savedState.messages);
        } catch (e) {
          console.error("Failed to restore chat context", e);
        }
      } else {
        // No saved state, start fresh
        startNewSession('en'); 
      }
      setIsRestoring(false);
    };
    restoreSession();
  }, []);

  // Save state on changes (Debounced by effect nature mostly, but runs on every update)
  useEffect(() => {
    if (!isRestoring && messages.length > 0) {
      saveState({
        messages,
        score,
        language,
        fontSizeIndex
      });
    }
  }, [messages, score, language, fontSizeIndex, isRestoring]);

  // Update root font size when index changes (Accessibility)
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontSizeIndex];
  }, [fontSizeIndex]);

  const startNewSession = async (lang: Language) => {
    try {
      resetChat(lang);
      const currentT = TRANSLATIONS[lang];
      setScore(0);
      
      // Add initial greeting manually based on language
      setMessages([
        {
          id: 'init-1',
          role: 'model',
          text: currentT.welcomeMessage
        }
      ]);
    } catch (error) {
      console.error("Failed to initialize chat", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const botMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: botMessageId, role: 'model', text: '', isStreaming: true },
      ]);

      const streamResult = await sendMessageStream(userMessage.text, language);
      
      let fullText = '';
      
      for await (const chunk of streamResult) {
        const c = chunk as GenerateContentResponse;
        const chunkText = c.text || '';
        fullText += chunkText;
        
        // Parse Score Logic: Look for <<SCORE: XX>> tag
        let displayText = fullText;
        const scoreMatch = fullText.match(/<<SCORE:\s*(\d+)>>/);
        
        if (scoreMatch) {
          const newScore = parseInt(scoreMatch[1]);
          if (!isNaN(newScore)) {
             setScore(newScore);
          }
          // Remove the tag from the UI text
          displayText = fullText.replace(/<<SCORE:\s*(\d+)>>/, '').trim();
        }
        
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === botMessageId 
              ? { ...msg, text: displayText } 
              : msg
          )
        );
      }

      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === botMessageId 
              ? { ...msg, isStreaming: false } 
              : msg
        )
      );

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { 
          id: Date.now().toString(), 
          role: 'model', 
          text: "⚠️ System Error: Unable to connect to training module. Please check your connection." 
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleReset = async () => {
    if (window.confirm(t.resetConfirm)) {
      await clearState();
      startNewSession(language);
    }
  };

  const handleLanguageSwitch = (newLang: Language) => {
    if (newLang !== language) {
      setLanguage(newLang);
      // We pass 0 messages to force a reset of the chat context for the new language
      // But we call startNewSession which handles this.
      startNewSession(newLang);
    }
  };

  const handleFontSizeChange = (delta: number) => {
    setFontSizeIndex(prev => {
      const newIndex = prev + delta;
      if (newIndex < 0) return 0;
      if (newIndex >= FONT_SIZES.length) return FONT_SIZES.length - 1;
      return newIndex;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // UI Threshold for "Success" visual state is 80% (The Trick)
  const isPassingVisual = score >= 80;

  if (isRestoring) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f172a] overflow-hidden text-slate-100 font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" onClick={() => setShowMobileSidebar(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-80 z-30 shadow-2xl" onClick={e => e.stopPropagation()}>
             <PackageReference language={language} />
             <button 
                onClick={() => setShowMobileSidebar(false)}
                className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"
             >
               <X size={20} />
             </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        
        {/* Header */}
        <header className="h-18 border-b border-slate-800/60 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-between px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-bold text-white text-lg">BT</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">{t.title}</h1>
              <p className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {t.subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            
            {/* Score Display (Desktop) */}
            <div className="hidden md:flex flex-col items-end min-w-[100px]">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                <Trophy size={12} className={isPassingVisual ? "text-emerald-400" : "text-slate-500"} />
                {t.score}
              </div>
              <div className="flex items-center gap-2 w-full">
                <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${isPassingVisual ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-indigo-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className={`font-mono font-bold text-sm ${isPassingVisual ? 'text-emerald-400' : 'text-white'}`}>{score}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{t.passingScore}</div>
            </div>

            {/* Font Size Controls (Desktop) */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/50">
              <button 
                onClick={() => handleFontSizeChange(-1)}
                disabled={fontSizeIndex === 0}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Decrease font size"
              >
                <Minus size={14} />
              </button>
              <div className="px-2 flex items-center text-slate-300">
                <Type size={16} />
              </div>
              <button 
                onClick={() => handleFontSizeChange(1)}
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Increase font size"
              >
                <Plus size={14} />
              </button>
            </div>

             {/* Desktop Language Switcher */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/50 mr-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleLanguageSwitch(l.code)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    language === l.code
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <button 
              onClick={handleReset}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
              title="Restart Assessment"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Mobile Language Switcher & Controls */}
        <div className="sm:hidden bg-slate-900/95 border-b border-slate-800 backdrop-blur">
           <div className="px-4 py-3 flex flex-col gap-3">
             <div className="flex gap-2">
                {/* Mobile Language */}
                <div className="flex-1 bg-slate-800 p-1 rounded-xl border border-slate-700/50 flex">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => handleLanguageSwitch(l.code)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                          language === l.code
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                </div>

                {/* Mobile Font Controls */}
                <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/50">
                    <button 
                      onClick={() => handleFontSizeChange(-1)}
                      disabled={fontSizeIndex === 0}
                      className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="px-1 text-slate-300">
                      <Type size={14} />
                    </div>
                    <button 
                      onClick={() => handleFontSizeChange(1)}
                      disabled={fontSizeIndex === FONT_SIZES.length - 1}
                      className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                </div>
             </div>
              
              {/* Mobile Score Compact */}
              <div className="flex items-center justify-between px-2">
                 <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{t.score}</span>
                 <div className="flex items-center gap-3">
                   <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className={`h-full transition-all duration-500 ${isPassingVisual ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${score}%` }}
                      />
                   </div>
                   <span className={`text-sm font-bold ${isPassingVisual ? 'text-emerald-400' : 'text-indigo-400'}`}>{score}%</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-[#0f172a] border-t border-slate-800/60">
          <div className="max-w-4xl mx-auto relative group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder}
              disabled={isLoading}
              className="w-full bg-slate-800/50 text-slate-100 rounded-2xl pl-6 pr-16 py-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-800 placeholder-slate-400 shadow-xl border border-slate-700/50 hover:border-slate-600 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 disabled:hover:shadow-none transform active:scale-95"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-xs text-slate-500 mt-4 font-medium">
            {t.disclaimer}
          </p>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <PackageReference language={language} />

    </div>
  );
};

export default App;