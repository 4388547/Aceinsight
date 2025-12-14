import React from 'react';
import { CommentaryStyle } from '../types';
import { Mic2, Zap, UserCheck, MessageCircle, Feather } from 'lucide-react';

interface StyleSelectorProps {
  selectedStyle: CommentaryStyle;
  onStyleSelect: (style: CommentaryStyle) => void;
  disabled: boolean;
}

// Updated labels to match Chinese Context
const styles = [
  { id: CommentaryStyle.PROFESSIONAL, icon: Mic2, label: '专业', desc: '深度与正式' },
  { id: CommentaryStyle.TECHNICAL, icon: UserCheck, label: '教练', desc: '技术与战术' },
  { id: CommentaryStyle.EXCITED, icon: Zap, label: '激情', desc: '高能呐喊' },
  { id: CommentaryStyle.HUMOROUS, icon: MessageCircle, label: '幽默', desc: '玩梗吐槽' },
  { id: CommentaryStyle.POETIC, icon: Feather, label: '文艺', desc: '戏剧感' },
];

const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onStyleSelect, disabled }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
      {styles.map((style) => {
        const Icon = style.icon;
        const isSelected = selectedStyle === style.id;
        
        return (
          <button
            key={style.id}
            onClick={() => onStyleSelect(style.id)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200
              ${isSelected 
                ? 'bg-tennis-green/20 border-tennis-green text-white shadow-[0_0_15px_rgba(212,225,87,0.3)]' 
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon size={20} className={`mb-2 ${isSelected ? 'text-tennis-green' : 'text-slate-400'}`} />
            <span className="text-xs font-bold">{style.label}</span>
            <span className="text-[10px] opacity-70 mt-1 hidden lg:block">{style.desc}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StyleSelector;