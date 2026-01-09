import React from 'react';
import { PACKAGES, TRANSLATIONS } from '../constants';
import { Check, Info } from 'lucide-react';
import { Language } from '../types';

interface PackageReferenceProps {
  language: Language;
}

export const PackageReference: React.FC<PackageReferenceProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const currentPackages = PACKAGES[language];

  return (
    <div className="hidden lg:flex flex-col w-80 bg-slate-900 border-l border-slate-800 h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Info size={20} className="text-indigo-400" />
          {t.packagesTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t.packagesSubtitle}</p>
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