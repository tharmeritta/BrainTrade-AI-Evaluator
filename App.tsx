
import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Menu, Trophy, Type, Minus, Plus, ChevronDown, Settings2, Lock, UserCircle, ArrowLeft, LogOut } from 'lucide-react';
import { sendMessageStream, resetChat, initializeChat } from './services/geminiService';
import { loadState, saveState, clearState } from './services/storageService';
import { syncAssessmentProgress } from './services/supabaseClient';
import { Message, Language } from './types';
import { MessageBubble } from './components/MessageBubble';
import { PackageReference } from './components/PackageReference';
import { AdminDashboard } from './components/AdminDashboard';
import { TRANSLATIONS } from './constants';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'TH' },
  { code: 'vi', label: 'VN' },
];

const FONT_SIZES = ['14px', '16px', '18px', '20px', '22px'];
const DEFAULT_FONT_INDEX = 1;

const App: React.FC = () => {
  // State
  const [view, setView] = useState<'agent_login' | 'chat' | 'admin_login' | 'admin_dashboard'>('agent_login');
  const [agentName, setAgentName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [score, setScore] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(DEFAULT_FONT_INDEX);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [dbSessionId, setDbSessionId] = useState<number | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];

  // Title Update
  useEffect(() => {
    document.title = t.title;
  }, [t.title]);

  // Restore State
  useEffect(() => {
    const restoreSession = async () => {
      const savedState = await loadState();
      // Only restore if we have messages. If not, start at login.
      if (savedState && savedState.messages.length > 0) {
        setLanguage(savedState.language);
        setScore(savedState.score);
        setFontSizeIndex(savedState.fontSizeIndex);
        setMessages(savedState.messages);
        setIsHeaderVisible(savedState.isHeaderVisible ?? true);
        setDbSessionId(savedState.dbSessionId);
        
        // Try to infer agent name from messages or storage if we had it (simplified for now)
        setView('chat');
        
        // Re-initialize chat with history
        try {
          initializeChat(savedState.language, savedState.messages);
        } catch (e) {
          console.error("Failed to re-init chat", e);
        }
      }
      setIsRestoring(false);
    };
    restoreSession();
  }, []);

  // Save State on Change
  useEffect(() => {
    if (!isRestoring && view === 'chat') {
      saveState({
        messages,
        score,
        language,
        fontSizeIndex,
        isHeaderVisible,
        dbSessionId
      });
    }
  }, [messages, score, language, fontSizeIndex, isHeaderVisible, isRestoring, view, dbSessionId]);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle AI Response Parsing
  const processAIResponse = (text: string) => {
    let cleanText = text;
    let newScore = score;
    let extractedFeedback = "";

    // 1. Extract Score: <<SCORE: 50>>
    const scoreMatch = text.match(/<<SCORE:\s*(\d+)>>/);
    if (scoreMatch) {
      newScore = parseInt(scoreMatch[1], 10);
      setScore(newScore);
      cleanText = cleanText.replace(/<<SCORE:\s*\d+>>/g, '');
    }

    // 2. Extract Feedback: <<FEEDBACK: ...>>
    const feedbackMatch = text.match(/<<FEEDBACK:\s*(.*?)>>/);
    if (feedbackMatch) {
      extractedFeedback = feedbackMatch[1].trim();
      cleanText = cleanText.replace(/<<FEEDBACK:\s*.*?>>/g, '');
    }

    // 3. Sync to Supabase if anything changed
    if (agentName && (scoreMatch || feedbackMatch || dbSessionId)) {
      // We don't await this to keep UI snappy, but we ensure the ID is passed if we have it
      syncAssessmentProgress({
        id: dbSessionId,
        agent_name: agentName,
        score: newScore,
        status: newScore >= 80 ? (newScore === 100 ? 'Certified' : 'Passed') : 'In Progress',
        language: language,
        last_feedback: extractedFeedback || undefined
      });
    }

    return cleanText.trim();
  };

  // Login Handler
  const handleAgentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;

    setView('chat');

    // Sync to Supabase immediately to start tracking "real-time" and get Session ID
    const newSessionId = await syncAssessmentProgress({
      agent_name: agentName.trim(),
      score: 0,
      status: 'In Progress',
      language: language,
      last_feedback: 'Started Assessment'
    });
    
    if (newSessionId) {
      setDbSessionId(newSessionId);
    }
    
    // Initial welcome logic
    const welcomeMsg: Message = {
      id: 'welcome',
      role: 'model',
      text: t.welcomeMessage
    };
    setMessages([welcomeMsg]);
    
    // Initialize Chat Service
    initializeChat(language, []);
  };

  // Message Handler
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    // Add User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Create placeholder for Model Message
      const modelMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: modelMessageId,
        role: 'model',
        text: '',
        isStreaming: true
      }]);

      let fullResponseText = '';
      
      // Stream response
      const stream = sendMessageStream(userText, language);
      
      for await (const chunk of stream) {
        const textChunk = chunk.text || '';
        fullResponseText += textChunk;
        
        setMessages(prev => prev.map(msg => 
          msg.id === modelMessageId 
            ? { ...msg, text: fullResponseText }
            : msg
        ));
      }

      // Final processing (remove score/feedback tags, update state)
      const cleanText = processAIResponse(fullResponseText);
      
      setMessages(prev => prev.map(msg => 
        msg.id === modelMessageId 
          ? { ...msg, text: cleanText, isStreaming: false }
          : msg
      ));

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "⚠️ Connection Error. Please try again.",
        isStreaming: false
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = async () => {
    if (confirm(t.resetConfirm)) {
      setMessages([]);
      setScore(0);
      setAgentName(''); // Reset name to force re-login or re-entry
      setDbSessionId(undefined);
      await clearState();
      resetChat(language);
      
      setView('agent_login');
      // If closing admin modal from chat, reset side effects are handled
    }
  };

  const handleLogout = async () => {
      setMessages([]);
      setScore(0);
      setAgentName('');
      setDbSessionId(undefined);
      await clearState();
      resetChat(language);
      setView('agent_login');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { // Hardcoded for demo
      setView('admin_dashboard');
      setAdminPassword('');
    } else {
      alert('Incorrect Password');
    }
  };

  // --- RENDER VIEWS ---

  if (isRestoring) {
    return <div className="flex items-center justify-center h-screen bg-slate-950 text-indigo-400">Loading...</div>;
  }

  // 1. Agent Login Screen
  if (view === 'agent_login') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
              <Trophy size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-slate-400 text-sm">{t.subtitle}</p>
          </div>

          <form onSubmit={handleAgentLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Language</label>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`py-2 rounded-xl text-sm font-medium transition-all ${
                      language === lang.code 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/20' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Agent Name</label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Start Assessment <ArrowLeft className="rotate-180" size={18} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => setView('admin_login')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <Lock size={12} /> Admin Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Admin Login Screen
  if (view === 'admin_login') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-2 mb-6 text-slate-400">
             <button 
               onClick={() => agentName ? setView('chat') : setView('agent_login')} 
               className="hover:text-white transition-colors"
               title="Back"
             >
               <ArrowLeft size={20} />
             </button>
             <span className="text-sm font-semibold uppercase tracking-wider">Admin Portal</span>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-6">Enter Password</h2>
          
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Admin Dashboard
  if (view === 'admin_dashboard') {
    return (
      <div className="h-screen w-full bg-[#0f172a]">
        <AdminDashboard onClose={() => agentName ? setView('chat') : setView('agent_login')} />
      </div>
    );
  }

  // 4. Chat View
  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar (Desktop) */}
      <div className="hidden lg:flex w-80 flex-col h-full bg-slate-900 border-r border-white/5 shadow-2xl z-20">
        <PackageReference language={language} />
        
        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-white/10 bg-slate-900">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                  disabled={fontSizeIndex === 0}
                >
                  <Minus size={16} />
                </button>
                <div className="flex items-center gap-1 text-slate-400 text-xs font-mono bg-slate-800 px-2 py-1 rounded">
                   <Type size={12} />
                   {FONT_SIZES[fontSizeIndex]}
                </div>
                <button 
                  onClick={() => setFontSizeIndex(Math.min(FONT_SIZES.length - 1, fontSizeIndex + 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                  disabled={fontSizeIndex === FONT_SIZES.length - 1}
                >
                  <Plus size={16} />
                </button>
             </div>
             
             <div className="flex items-center gap-1">
               <button 
                  onClick={() => setView('admin_login')}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Admin Access"
               >
                 <Lock size={18} />
               </button>
               <button 
                  onClick={handleReset}
                  className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 rounded-lg transition-colors"
                  title="Restart Assessment"
               >
                 <RefreshCw size={18} />
               </button>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut size={14} /> Exit Assessment
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)}></div>
          <div className="relative w-[85%] max-w-[320px] bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in">
             <PackageReference 
               language={language} 
               onClose={() => setShowMobileSidebar(false)}
               mobileControls={
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Font Size</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
                          className="p-1.5 bg-slate-800 rounded text-slate-300"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-xs font-mono w-8 text-center">{FONT_SIZES[fontSizeIndex]}</span>
                        <button 
                          onClick={() => setFontSizeIndex(Math.min(FONT_SIZES.length - 1, fontSizeIndex + 1))}
                          className="p-1.5 bg-slate-800 rounded text-slate-300"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => setView('admin_login')}
                      className="w-full py-2 bg-slate-800 text-slate-400 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Lock size={16} /> Admin Access
                    </button>
                    <button 
                      onClick={handleReset}
                      className="w-full py-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/30 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} /> Restart
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full py-2 bg-slate-800 text-slate-400 rounded-lg flex items-center justify-center gap-2"
                    >
                      <LogOut size={16} /> Exit
                    </button>
                 </div>
               } 
             />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative" style={{ fontSize: FONT_SIZES[fontSizeIndex] }}>
        
        {/* Header */}
        <div 
          className={`bg-slate-900/90 backdrop-blur-md border-b border-white/5 transition-all duration-300 z-10 
            ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full absolute w-full'}`}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <Menu size={24} />
              </button>
              <div>
                <h1 className="font-bold text-white leading-tight flex items-center gap-2">
                  <span className="hidden sm:inline">BrainTrade</span>
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI Evaluator</span>
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">Agent: <span className="text-slate-200">{agentName}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-slate-500">{t.score}</span>
                  <span className={`font-bold font-mono text-lg ${score >= 80 ? 'text-emerald-400' : 'text-indigo-400'}`}>
                    {score}%
                  </span>
                </div>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${score >= 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scroll-smooth custom-scrollbar"
        >
           <div className="max-w-4xl mx-auto flex flex-col min-h-full pb-4">
             {/* Header Toggle Hint (visible when header hidden) */}
             {!isHeaderVisible && (
               <button 
                 onClick={() => setIsHeaderVisible(true)}
                 className="absolute top-2 left-1/2 -translate-x-1/2 p-1.5 bg-slate-800/80 rounded-full text-slate-400 hover:text-white z-10"
               >
                 <ChevronDown size={16} />
               </button>
             )}

             {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 italic">
                  Loading...
                </div>
             ) : (
               messages.map((msg) => (
                 <MessageBubble key={msg.id} message={msg} />
               ))
             )}
             
             {/* Spacer for bottom input */}
             <div ref={messagesEndRef} className="h-4" />
           </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-white/5 relative z-20">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2">
            <div className="flex-1 relative bg-slate-800/50 rounded-2xl border border-white/10 focus-within:border-indigo-500/50 focus-within:bg-slate-800 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.placeholder}
                className="w-full bg-transparent text-white p-4 pr-12 rounded-2xl focus:outline-none resize-none placeholder-slate-500"
                disabled={isLoading}
              />
              <div className="absolute right-2 bottom-2 text-xs text-slate-500 px-2 py-1 select-none hidden md:block">
                Press Enter to send
              </div>
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className={`p-4 rounded-xl flex-shrink-0 transition-all duration-200 ${
                input.trim() && !isLoading
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95' 
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <RefreshCw className="animate-spin" size={24} />
              ) : (
                <Send size={24} className={input.trim() ? 'ml-0.5' : ''} />
              )}
            </button>
          </div>
          <div className="max-w-4xl mx-auto text-center mt-2">
             <p className="text-[10px] text-slate-600">
               {t.disclaimer}
             </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
