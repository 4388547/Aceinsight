import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Bot, User, Globe, Loader2, Image as ImageIcon, Download } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';

  // Helper to extract title if present in text (Format: "标题：xxxx")
  // We hide the raw "标题：" line from the markdown body if we render it separately
  let displayTitle = message.videoTitle;
  let displayText = message.text;

  if (!displayTitle && isModel && message.text.includes('标题：')) {
    const match = message.text.match(/标题：(.*?)(?:\n|$)/);
    if (match) {
      displayTitle = match[1].trim();
      // Optional: remove the title line from the main text to avoid duplication
      // displayText = message.text.replace(match[0], '').trim();
    }
  }

  return (
    <div className={`flex w-full mb-6 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1
          ${isModel ? 'bg-tennis-green text-tennis-dark' : 'bg-blue-600 text-white'} 
          ${isModel ? 'mr-3' : 'ml-3'}
        `}>
          {isModel ? <Bot size={18} /> : <User size={18} />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} w-full`}>
          
          {/* Viral Title Card */}
          {displayTitle && (
            <div className="mb-2 bg-gradient-to-r from-purple-900 to-slate-900 border-l-4 border-tennis-green p-3 rounded-r-lg shadow-lg max-w-full">
              <span className="text-[10px] uppercase text-tennis-green font-bold tracking-wider block mb-1">
                Video Title
              </span>
              <h3 className="text-white font-bold text-lg leading-tight">
                {displayTitle}
              </h3>
            </div>
          )}

          {/* AI Generated Thumbnail Card */}
          {message.thumbnailUrl && (
            <div className="mb-2 rounded-xl overflow-hidden border border-slate-700 shadow-xl group relative max-w-[300px]">
              <img src={message.thumbnailUrl} alt="AI Generated Cover" className="w-full h-auto" />
              <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                 <ImageIcon size={10} /> AI Cover
              </div>
              <a 
                href={message.thumbnailUrl} 
                download={`ace-insight-cover-${message.id}.png`}
                className="absolute bottom-2 right-2 bg-tennis-green text-tennis-dark p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                title="保存封面"
              >
                <Download size={16} />
              </a>
            </div>
          )}

          <div className={`
            p-4 rounded-2xl text-sm leading-relaxed shadow-md w-full
            ${isModel 
              ? 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700' 
              : 'bg-blue-600 text-white rounded-tr-none'
            }
          `}>
            {message.isThinking ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span>正在分析战局...</span>
              </div>
            ) : (
              <ReactMarkdown 
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                  strong: ({node, ...props}) => <strong className="text-tennis-green font-bold" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                }}
              >
                {displayText}
              </ReactMarkdown>
            )}
          </div>

          {/* Sources / Grounding */}
          {!message.isThinking && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-2 text-xs w-full max-w-full">
              <div className="flex items-center gap-1 text-slate-400 mb-1">
                <Globe size={12} />
                <span>参考来源</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {message.groundingSources.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-800/80 hover:bg-slate-700 text-blue-400 px-2 py-1 rounded border border-slate-700 truncate max-w-[200px]"
                  >
                    {source.title || new URL(source.uri).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}
          
          <span className="text-[10px] text-slate-500 mt-1 px-1">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;