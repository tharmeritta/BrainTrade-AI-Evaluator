import React from 'react';
import { PACKAGES, TRANSLATIONS } from '../constants';
import { Check, Info, X } from 'lucide-react';
import { Language } from '../types';

interface PackageReferenceProps {
  language: Language;
  onClose?: () => void;
}

export const PackageReference: React.FC<PackageReferenceProps> = ({ language, onClose }) => {
  const t = TRANSLATIONS[language];
  const currentPackages = PACKAGES[language];

  return (
    <div className="flex flex-col w-full h-full bg-slate-900 border-l border-slate-800 overflow-y-auto custom-scrollbar">
      <div className="p-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Info size={20} className="text-indigo-400" />
            {t.packagesTitle}
          </h2>
          {onClose && (
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
      
      <div className="p-4 space-y-4">
        {currentPackages.map((pkg) => (
          <div key={pkg.name} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-indigo-500/50 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-indigo-300">{pkg.name}</h3>
              <span className="bg-slate-700 text-white text-xs font-mono px-2 py-1 rounded">
                {t.price}{pkg.price}
              </span>
            </div>
            
            <div className="text-xs text-slate-300 space-y-1 mb-3">
              <div className="flex justify-between">
                <span>{t.courses}:</span>
                <span className="text-white font-medium">{pkg.courses}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.tools}:</span>
                <span className="text-white font-medium">{pkg.tools}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.ebooks}:</span>
                <span className="text-white font-medium">{pkg.ebooks}</span>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-2 space-y-1">
              {pkg.features.map((feat, idx) => (
                <div key={idx} className="flex items-center text-[10px] text-slate-400">
                  <Check size={10} className="text-emerald-400 mr-1" />
                  {feat}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 mt-auto border-t border-slate-800">
        <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg">
          <p className="text-xs text-indigo-200 text-center">
            <strong>{t.bonusTitle}</strong><br/>
            {t.bonusDesc}
          </p>
        </div>
      </div>
    </div>
  );
};