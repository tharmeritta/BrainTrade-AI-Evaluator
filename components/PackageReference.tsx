
import React from 'react';
import { PACKAGES, TRANSLATIONS } from '../constants';
import { Info, X, Clock, Bot, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

interface PackageReferenceProps {
  language: Language;
  onClose?: () => void;
  mobileControls?: React.ReactNode; // Slot for injecting settings on mobile
}

export const PackageReference: React.FC<PackageReferenceProps> = ({ language, onClose, mobileControls }) => {
  const t = TRANSLATIONS[language];
  const currentPackages = PACKAGES[language];

  return (
    <div className="flex flex-col w-full h-full bg-slate-900 border-l border-white/10 overflow-y-auto custom-scrollbar">
      
      {/* Header / Mobile Controls Area */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-white/10">
        
        {/* Mobile Settings Injection */}
        {mobileControls && (
          <div className="p-4 pb-2 border-b border-white/5 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settings</span>
                {onClose && (
                  <button 
                    onClick={onClose}
                    className="p-2 -mr-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
             </div>
             {mobileControls}
          </div>
        )}

        {/* Standard Title */}
        <div className="p-6 py-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Info size={18} className="text-indigo-400" />
              {t.packagesTitle}
            </h2>
            {onClose && !mobileControls && (
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">{t.packagesSubtitle}</p>
        </div>
      </div>

      {/* Common Features Banner */}
      <div className="px-4 pt-2 pb-2">
        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-3">
          <p className="text-[10px] text-indigo-200 leading-relaxed font-medium">
            {t.commonFeatures}
          </p>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {currentPackages.map((pkg) => (
          <div key={pkg.name} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-indigo-500/50 transition-colors group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors text-base">{pkg.name}</h3>
              <span className="bg-slate-800 text-white text-sm font-mono px-2 py-1 rounded border border-white/10 font-bold">
                {t.price}{pkg.price.toLocaleString()}
              </span>
            </div>
            
            <div className="space-y-3">
              {/* Duration Row */}
              <div className="flex items-center justify-between bg-slate-950/30 p-2 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Clock size={14} className="text-emerald-400" />
                  <span>{t.duration}</span>
                </div>
                <span className="text-white text-sm font-medium">{pkg.duration}</span>
              </div>

              {/* AI Queries Row */}
              <div className="flex items-center justify-between bg-slate-950/30 p-2 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Bot size={14} className="text-purple-400" />
                  <span>{t.aiQueries}</span>
                </div>
                <span className="text-white text-sm font-medium">{pkg.aiQueries}</span>
              </div>
            </div>

            {/* Visual Indicator for Tier (Optional subtle bar at bottom) */}
            <div className="mt-3 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-50" 
                 style={{ width: `${(pkg.price / 3000) * 100}%` }}
               ></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Spacer to push content up if needed */}
      <div className="p-4 mt-auto"></div>
    </div>
  );
};
