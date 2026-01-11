import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Menu, Trophy, Type, Minus, Plus, ChevronDown, Settings2 } from 'lucide-react';
import { sendMessageStream, resetChat, initializeChat } from './services/geminiService';
import { loadState, saveState, clearState } from './services/storageService';
import { Message, Language } from './types';
import { MessageBubble } from './components/MessageBubble';
import { PackageReference } from './components/PackageReference';
import { TRANSLATIONS } from './constants';
import { GenerateContentResponse } from '@google/genai';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'TH' },
  { code: 'vi', label: 'VN' },
];

const FONT_SIZES = ['14px', '16px', '18px', '20px', '22px'];
const DEFAULT_FONT_INDEX = 1;

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [score, setScore] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(DEFAULT_FONT_INDEX);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    document.title = t.title;
  }, [t.title]);

  useEffect(() => {
    const restoreSession = async () => {
      const savedState = await loadState();
      if (savedState) {
        setLanguage(savedState.language);
        setScore(savedState.score);
        setFontSizeIndex(savedState.fontSizeIndex);
        setMessages(savedState.messages);
        setIsHeaderVisible(savedState.isHeaderVisible ?? true);
        try {
          initializeChat(savedState.language, savedState.messages);
        } catch (e) {
          console.error("Failed to restore chat context", e);
        }
      } else {
        startNewSession('en'); 
      }
      setIsRestoring(false);
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (!isRestoring && messages.length > 0) {
      saveState({
        messages,
        score,
        language,
        fontSizeIndex,
        isHeaderVisible
      });
    }
  }, [messages, score, language, fontSizeIndex, isHeaderVisible, isRestoring]);

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontSizeIndex];
  }, [fontSizeIndex]);

  const startNewSession = async (lang: Language) => {
    try {
      resetChat(lang);
      const currentT = TRANSLATIONS[lang];
      setScore(0);
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

  // Smart scrolling: Scroll to TOP if it's a reset/init message, otherwise scroll to bottom
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'init-1') {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      scrollToBottom();
    }
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
        
        let displayText = fullText;
        const scoreMatch = fullText.match(/<<SCORE:\s*(\d+)>>/);
        
        if (scoreMatch) {
          const newScore = parseInt(scoreMatch[1]);
          if (!isNaN(newScore)) {
             setScore(newScore);
          }
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

  const isPassingVisual = score >= 80;

  // --- COMPONENT: Settings Controls (Used in Desktop Header and Mobile Sidebar) ---
  const SettingsControls = ({ isMobile = false }) => (
    <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center gap-3'}`}>
      
      {/* Language Switcher */}
      <div className={`flex bg-white/5 rounded-lg p-1 border border-white/10 ${isMobile ? 'w-full' : ''}`}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => handleLanguageSwitch(l.code)}
            className={`
              relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300
              ${isMobile ? 'flex-1 py-3 text-sm' : ''}
              ${language === l.code
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
              }
            `}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className={`flex ${isMobile ? 'w-full gap-2' : 'gap-2'}`}>
        {/* Font Controls */}
        <div className={`flex items-center bg-white/5 rounded-lg p-1 border border-white/10 ${isMobile ? 'flex-1 justify-between px-2' : ''}`}>
            <button 
              onClick={() => handleFontSizeChange(-1)}
              disabled={fontSizeIndex === 0}
              className={`p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors ${isMobile ? 'p-2' : ''}`}
            >
              <Minus size={isMobile ? 18 : 14} />
            </button>
            <div className="px-2 text-slate-300">
              <Type size={isMobile ? 18 : 14} />
            </div>
            <button 
              onClick={() => handleFontSizeChange(1)}
              disabled={fontSizeIndex === FONT_SIZES.length - 1}
              className={`p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors ${isMobile ? 'p-2' : ''}`}
            >
              <Plus size={isMobile ? 18 : 14} />
            </button>
        </div>

        {/* Reset Button */}
        <button 
          onClick={handleReset}
          className={`
            flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all
            ${isMobile ? 'px-4' : 'p-2'}
          `}
          title="Restart Assessment"
        >
          <RefreshCw size={isMobile ? 20 : 16} />
          {isMobile && <span className="text-sm font-medium">Reset</span>}
        </button>
      </div>
    </div>
  );

  if (isRestoring) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#0f172a] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#0f172a] overflow-hidden text-slate-100 font-sans selection:bg-indigo-500/30">
      
      {/* Mobile Sidebar & Settings Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden animate-in fade-in duration-200" onClick={() => setShowMobileSidebar(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm z-50 shadow-2xl animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
             <PackageReference 
                language={language} 
                onClose={() => setShowMobileSidebar(false)}
                mobileControls={<SettingsControls isMobile={true} />} 
             />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
        
        {/* "Show Header" Floating Tab (Centered & Sleek) */}
        <div className={`absolute left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          !isHeaderVisible 
            ? 'top-2 opacity-100 translate-y-0' 
            : '-top-10 opacity-0 -translate-y-4 pointer-events-none'
        }`}>
          <button
            onClick={() => setIsHeaderVisible(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/90 backdrop-blur-md text-xs font-bold text-slate-400 hover:text-white rounded-full shadow-lg border border-white/10 hover:border-indigo-500/50 hover:bg-slate-800 transition-all group"
          >
            <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
            <span>MENU</span>
          </button>
        </div>

        {/* --- UNIFIED HEADER --- */}
        <header 
          className={`shrink-0 z-30 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] relative ${
            isHeaderVisible 
              ? 'h-[72px] opacity-100 translate-y-0' 
              : 'h-0 opacity-0 -translate-y-4 overflow-hidden border-b-0'
          }`}
        >
          <div className="h-full max-w-7xl mx-auto px-4 lg:px-6 flex items-center justify-between">
            
            {/* 1. Left: Identity */}
            <div className="flex items-center gap-3 w-1/4 min-w-fit">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
                <span className="font-bold text-white text-sm">BT</span>
              </div>
              <div className="hidden sm:block leading-tight">
                <h1 className="font-bold text-sm tracking-wide text-white">{t.title}</h1>
                <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">AI Evaluator</p>
              </div>
            </div>

            {/* 2. Center: Score HUD (The Star of the Show) */}
            <div className="flex-1 flex justify-center">
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-1.5 flex items-center gap-3 pl-4 pr-2 shadow-inner min-w-[180px] sm:min-w-[240px] max-w-md w-full relative group">
                  <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex flex-col items-start gap-0.5 min-w-fit relative z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.score}</span>
                  </div>

                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative z-10">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(99,102,241,0.6)] ${isPassingVisual ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                      style={{ width: `${Math.max(5, score)}%` }}
                    />
                  </div>
                  
                  <div className="bg-slate-800 rounded-lg px-2.5 py-1 min-w-[3rem] text-center border border-white/5 relative z-10">
                    <span className={`font-mono text-sm font-bold ${isPassingVisual ? 'text-emerald-400' : 'text-white'}`}>
                      {score}%
                    </span>
                  </div>
              </div>
            </div>

            {/* 3. Right: Actions & Tools */}
            <div className="flex items-center justify-end gap-2 w-1/4 min-w-fit">
              
              {/* Desktop Controls (Hidden on Mobile) */}
              <div className="hidden md:flex items-center">
                 <SettingsControls />
                 <div className="w-px h-6 bg-white/10 mx-3"></div>
              </div>

              {/* Mobile Menu Trigger (Opens Sidebar with Settings) */}
              <button 
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden p-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
              >
                <div className="relative">
                   <Settings2 size={20} />
                   <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#0f172a]"></div>
                </div>
              </button>

              {/* Collapse Button */}
              <button 
                onClick={() => setIsHeaderVisible(false)}
                className="hidden sm:flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                title="Hide Header"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-4 h-0.5 bg-current rounded-full"></div>
                </div>
              </button>
            </div>

          </div>
        </header>

        {/* Messages List */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 px-4 lg:px-8 py-6 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 lg:p-6 bg-[#0f172a] border-t border-slate-800/60 z-20">
          <div className="max-w-4xl mx-auto relative group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder}
              disabled={isLoading}
              className="w-full bg-slate-900/50 text-slate-100 rounded-2xl pl-6 pr-16 py-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-900 placeholder-slate-500 shadow-xl border border-white/5 hover:border-white/10 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 disabled:hover:shadow-none transform active:scale-95"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] uppercase tracking-widest text-slate-600 mt-4 font-bold">
             BrainTrade Internal Training System
          </p>
        </div>
      </div>

      {/* Desktop Sidebar (Permanent) */}
      <div className="hidden lg:flex w-80 shrink-0 h-full border-l border-white/5">
        <PackageReference language={language} />
      </div>

    </div>
  );
};

export default App;