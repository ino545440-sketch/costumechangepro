import React, { useState, useRef } from 'react';
import { OUTFIT_PRESETS, CATEGORY_LABELS } from '../constants';
import { OutfitPreset } from '../types';
import { Shirt, Check, Sparkles, User, Briefcase, Smile, Anchor, Image as ImageIcon, Type, Upload, X } from 'lucide-react';
import { getDisplayUrl } from '../utils';

interface OutfitSelectorProps {
  // Text Mode Props
  selectedOutfit: string;
  onOutfitChange: (outfit: string) => void;
  
  // Ref Image Mode Props
  refImage: File | null;
  onRefImageChange: (file: File | null) => void;

  // State Props
  mode: 'text' | 'image';
  onModeChange: (mode: 'text' | 'image') => void;

  disabled: boolean;
}

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'casual': return <Smile size={16} />;
    case 'fantasy': return <Sparkles size={16} />;
    case 'formal': return <User size={16} />;
    case 'occupation': return <Briefcase size={16} />;
    case 'costume': return <Anchor size={16} />;
    default: return <Shirt size={16} />;
  }
};

const OutfitSelector: React.FC<OutfitSelectorProps> = ({ 
  selectedOutfit, 
  onOutfitChange, 
  refImage,
  onRefImageChange,
  mode,
  onModeChange,
  disabled 
}) => {
  const [customInput, setCustomInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group presets by category
  const groupedPresets = OUTFIT_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, OutfitPreset[]>);

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    onOutfitChange(val);
  };

  const handlePresetClick = (prompt: string) => {
    setCustomInput(''); // Clear custom input when clicking preset
    onOutfitChange(prompt);
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onRefImageChange(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files[0]) {
      onRefImageChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
      
      {/* TABS */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => onModeChange('text')}
          disabled={disabled}
          className={`
            flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors
            ${mode === 'text' 
              ? 'bg-slate-800 text-purple-400 border-b-2 border-purple-500' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }
          `}
        >
          <Type size={16} /> テキスト/プリセット
        </button>
        <button
          onClick={() => onModeChange('image')}
          disabled={disabled}
          className={`
            flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors
            ${mode === 'image' 
              ? 'bg-slate-800 text-purple-400 border-b-2 border-purple-500' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }
          `}
        >
          <ImageIcon size={16} /> 画像リファレンス
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        
        {/* --- TEXT MODE --- */}
        {mode === 'text' && (
          <div className="space-y-4">
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                変えたい服装を入力
              </label>
              <input
                type="text"
                value={customInput}
                onChange={handleCustomChange}
                disabled={disabled}
                placeholder="例: 白いTシャツとジーンズ..."
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-6">
              {Object.entries(groupedPresets).map(([category, presets]) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CategoryIcon category={category} />
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetClick(preset.prompt)}
                        disabled={disabled}
                        className={`
                          relative group flex items-start text-left p-2.5 rounded-lg border transition-all duration-200
                          ${selectedOutfit === preset.prompt && !customInput
                            ? 'bg-purple-600/20 border-purple-500 text-purple-100'
                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                          }
                        `}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate">{preset.name}</div>
                        </div>
                        {selectedOutfit === preset.prompt && !customInput && (
                          <div className="absolute top-1.5 right-1.5">
                            <Check size={12} className="text-purple-400" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- IMAGE MODE --- */}
        {mode === 'image' && (
          <div className="h-full flex flex-col items-center justify-center">
            <div 
              className={`
                w-full aspect-square max-h-[300px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all
                ${refImage 
                  ? 'border-purple-500/50 bg-slate-900' 
                  : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer'
                }
              `}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !refImage && fileInputRef.current?.click()}
            >
               <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleRefImageUpload} 
              />
              
              {refImage ? (
                <>
                  <img 
                    src={getDisplayUrl(refImage)} 
                    alt="Ref" 
                    className="w-full h-full object-contain p-2" 
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRefImageChange(null); }}
                    className="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <div className="absolute bottom-2 bg-black/60 px-2 py-1 rounded text-xs text-white/80">
                    参照画像
                  </div>
                </>
              ) : (
                <div className="text-center p-6 pointer-events-none">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-300">画像をドロップ</p>
                  <p className="text-xs text-slate-500 mt-1">またはクリックして選択</p>
                  <p className="text-[10px] text-slate-600 mt-4 max-w-[200px] mx-auto">
                    この画像の服装を解析して、キャラクターに着せ替えます。
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OutfitSelector;