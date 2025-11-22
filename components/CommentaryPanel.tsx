import React, { useEffect, useRef } from 'react';
import { Commentary } from '../types';

interface CommentaryPanelProps {
  comments: Commentary[];
  theme: 'light' | 'dark';
}

const CommentaryPanel: React.FC<CommentaryPanelProps> = ({ comments, theme }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  return (
    <div className={`w-full h-full rounded-xl border flex flex-col overflow-hidden shadow-lg transition-colors duration-300 ${
      isDark 
        ? 'bg-slate-800/50 backdrop-blur-md border-slate-700' 
        : 'bg-white/80 backdrop-blur-md border-slate-200'
    }`}>
      <div className={`p-4 border-b flex items-center gap-2 shrink-0 ${
        isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-100 bg-white/90'
      }`}>
        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h2 className={`font-bold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          Live Commentary
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 && (
          <div className={`text-sm text-center mt-10 italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Waiting for game start...
          </div>
        )}
        {comments.map((comment, idx) => (
          <div 
            key={idx} 
            className={`text-sm p-3 rounded-lg animate-fade-in border ${
              comment.type === 'ai' 
                ? (isDark ? 'bg-purple-900/20 border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-800')
                : comment.type === 'failure'
                ? (isDark ? 'bg-red-900/20 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-800')
                : (isDark ? 'bg-slate-700/30 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')
            }`}
          >
            <div className="flex items-start gap-2">
              {comment.type === 'ai' && (
                 <span className="mt-0.5 flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white">AI</span>
              )}
              <span className="leading-relaxed font-mono font-medium">{comment.text}</span>
            </div>
            <div className={`text-[10px] mt-1 text-right opacity-60 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {new Date(comment.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second:'2-digit' })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default CommentaryPanel;