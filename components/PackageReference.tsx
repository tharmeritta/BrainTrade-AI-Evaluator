import React from 'react';
import { PACKAGES, TRANSLATIONS } from '../constants';
import { Check, Info, X } from 'lucide-react';
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

        {/* Standard Title (Only show Close button here if no mobile controls were passed, to avoid double close buttons) */}
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
      
      <div className="p-4 space-y-4">
        {currentPackages.map((pkg) => (
          <div key={pkg.name} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-indigo-500/50 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">{pkg.name}</h3>
              <span className="bg-slate-800 text-white text-xs font-mono px-2 py-1 rounded border border-white/10">
                {t.price}{pkg.price}
              </span>
            </div>
            
            <div className="text-xs text-slate-300 space-y-2 mb-4">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>{t.courses}</span>
                <span className="text-white font-medium">{pkg.courses}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>{t.tools}</span>
                <span className="text-white font-medium">{pkg.tools}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.ebooks}</span>
                <span className="text-white font-medium">{pkg.ebooks}</span>
              </div>
            </div>

            <div className="bg-slate-950/30 rounded-lg p-3 space-y-2">
              {pkg.features.map((feat, idx) => (
                <div key={idx} className="flex items-start text-[10px] text-slate-400 leading-tight">
                  <Check size={10} className="text-emerald-400 mr-2 mt-0.5 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 mt-auto border-t border-white/10">
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-white/5 rounded-full blur-xl"></div>
          <p className="text-xs text-indigo-200 text-center relative z-10 leading-relaxed">
            <strong className="text-white block mb-1">{t.bonusTitle}</strong>
            {t.bonusDesc}
          </p>
        </div>
      </div>
    </div>
  );
};