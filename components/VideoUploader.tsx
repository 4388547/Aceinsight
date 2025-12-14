import React, { ChangeEvent, useState, useEffect } from 'react';
import { VideoState } from '../types';
import { Upload, X, Film } from 'lucide-react';
import { fileToGenerativePart } from '../services/geminiService';

interface VideoUploaderProps {
  videoState: VideoState;
  onVideoSelected: (state: VideoState) => void;
  onClear: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; // Added ref prop
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ videoState, onVideoSelected, onClear, videoRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Clean up object URL on unmount or when video is cleared to prevent memory leaks
  useEffect(() => {
    return () => {
      if (videoState.previewUrl) {
        URL.revokeObjectURL(videoState.previewUrl);
      }
    };
  }, [videoState.previewUrl]);

  const processFile = async (file: File) => {
    // Simple validation
    if (!file.type.startsWith('video/')) {
      alert('请上传有效的视频文件。');
      return;
    }
    
    // Warning for large files in this frontend-only demo
    if (file.size > 20 * 1024 * 1024) {
      alert('为了保证演示流畅，请使用 20MB 以内的视频片段。');
      return;
    }

    setIsLoading(true);
    try {
      const base64 = await fileToGenerativePart(file);
      const url = URL.createObjectURL(file);
      
      onVideoSelected({
        file: file,
        previewUrl: url,
        base64Data: base64,
        mimeType: file.type
      });
    } catch (e) {
      console.error("Error processing video", e);
      alert("处理视频文件时出错。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (videoState.previewUrl) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg border border-tennis-court/30 group">
        <video 
          ref={videoRef} // Attached ref here
          key={videoState.previewUrl} // FORCE RE-RENDER when video changes
          controls 
          playsInline
          crossOrigin="anonymous" // Important for canvas capture if using external URLs (not applicable for local blob but good practice)
          className="w-full h-auto max-h-[400px] mx-auto bg-black"
        >
          <source src={videoState.previewUrl} type={videoState.mimeType} />
          您的浏览器不支持 video 标签。
        </video>
        <button 
          onClick={onClear}
          className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500/80 text-white rounded-full transition-colors backdrop-blur-sm z-10"
        >
          <X size={20} />
        </button>
        <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/60 text-white text-xs rounded-full backdrop-blur-sm pointer-events-none">
          {videoState.file?.name}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        relative border-2 border-dashed rounded-xl p-8 transition-all duration-300
        flex flex-col items-center justify-center text-center h-[300px]
        ${isDragging 
          ? 'border-tennis-green bg-tennis-green/10 scale-[1.02]' 
          : 'border-slate-600 bg-slate-800/50 hover:border-tennis-green/50 hover:bg-slate-800'
        }
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isLoading ? (
        <div className="flex flex-col items-center animate-pulse">
          <Film className="w-12 h-12 text-tennis-green mb-4 animate-bounce" />
          <p className="text-slate-300 font-medium">正在处理视频...</p>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-tennis-green" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">上传网球比赛片段</h3>
          <p className="text-slate-400 text-sm max-w-xs mb-6">
            将视频拖放到此处，或点击浏览。(推荐使用 MP4, WebM)
          </p>
          <label className="relative cursor-pointer group">
            <span className="bg-tennis-green text-tennis-dark font-bold py-2 px-6 rounded-full shadow-lg shadow-tennis-green/20 hover:bg-white transition-all">
              选择文件
            </span>
            <input 
              type="file" 
              accept="video/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        </>
      )}
    </div>
  );
};

export default VideoUploader;