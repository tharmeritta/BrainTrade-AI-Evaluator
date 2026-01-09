import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { User, CheckCircle2, Bot } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

// Custom renderers for ReactMarkdown to enhance quiz readability
const MarkdownComponents = {
  // Style paragraphs for better readability
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-7 text-slate-200">{children}</p>,
  
  // Style bold text (often used for Question titles or correct answers)
  strong: ({ children }: any) => <span className="font-bold text-indigo-300">{children}</span>,
  
  // Style headings
  h1: ({ children }: any) => <h1 className="text-xl font-bold mb-4 text-emerald-400 border-b border-emerald-500/30 pb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mb-3 text-white border-b border-slate-600/50 pb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-bold mb-2 text-indigo-200">{children}</h3>,

  // Style lists (often used for quiz options)
  ul: ({ children }: any) => <ul className="space-y-3 my-4">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-3 my-4 text-slate-200">{children}</ol>,
  
  // Custom List Item Renderer: Detects "✅" to create Achievement Cards
  li: ({ children }: any) => {
    // Helper to get text content from children to check for emoji
    const getText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(getText).join('');
      if (node && node.props && node.props.children) return getText(node.props.children);
      return '';
    };

    const textContent = getText(children);
    const isAchievement = textContent.includes('✅');

    if (isAchievement) {
      return (
        <li className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex items-center gap-4 transition-all hover:scale-[1.02] duration-300 group">
          <div className="flex-shrink-0">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-400">
               <CheckCircle2 size={18} />
             </div>
          </div>
          <div className="flex-1 font-medium text-emerald-100 group-hover:text-white transition-colors">
            {children}
          </div>
        </li>
      );
    }

    // Default list item style
    return (
      <li className="bg-slate-700/40 rounded-lg p-3 border border-slate-600/50 text-slate-100 shadow-sm flex items-start gap-3">
        <span className="text-indigo-400 mt-1.5 text-[0.6rem]">•</span>
        <div className="flex-1">{children}</div>
      </li>
    );
  },
  
  // Blockquotes for explanations or tips
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-slate-800/50 italic text-slate-300 rounded-r">
      {children}
    </blockquote>
  ),
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isModel = message.role === 'model';

  return (
    <div className={`flex w-full mb-8 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[95%] lg:max-w-[85%] ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`hidden md:flex flex-shrink-0 h-10 w-10 rounded-full items-center justify-center shadow-lg mt-1 ${
          isModel ? 'bg-indigo-600 mr-4' : 'bg-slate-700 ml-4'
        }`}>
          {isModel ? <Bot size={20} className="text-white" /> : <User size={20} className="text-white" />}
        </div>

        {/* Message Content */}
        <div 
          className={`relative p-5 md:p-6 rounded-2xl shadow-md text-sm md:text-base leading-relaxed ${
            isModel 
              ? 'bg-[#1e293b] text-slate-100 rounded-tl-none border border-slate-700 shadow-slate-900/10' 
              : 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-900/20'
          }`}
        >
          {isModel ? (
            <div className="markdown-content">
              <ReactMarkdown components={MarkdownComponents}>
                {message.text}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap leading-7">{message.text}</p>
          )}
          {message.isStreaming && (
             <div className="mt-2 flex gap-1">
               <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
               <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
               <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};