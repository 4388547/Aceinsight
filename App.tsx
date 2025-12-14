import React, { useState, useRef, useEffect } from 'react';
import { Activity, Send, Search, Trash2, Github, Globe } from 'lucide-react';
import { CommentaryStyle, Message, VideoState } from './types';
import VideoUploader from './components/VideoUploader';
import StyleSelector from './components/StyleSelector';
import ChatMessage from './components/ChatMessage';
import { generateVideoCommentary, sendFollowUpMessage, generateAIImage } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [videoState, setVideoState] = useState<VideoState>({
    file: null,
    previewUrl: null,
    base64Data: null,
    mimeType: '',
  });
  
  const [selectedStyle, setSelectedStyle] = useState<CommentaryStyle>(CommentaryStyle.PROFESSIONAL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // Ref to access the video element

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Video Selection
  const handleVideoSelected = (newState: VideoState) => {
    setVideoState(newState);
    setHasStartedAnalysis(false);
    setMessages([]);
  };

  const handleClearVideo = () => {
    setVideoState({ file: null, previewUrl: null, base64Data: null, mimeType: '' });
    setMessages([]);
    setHasStartedAnalysis(false);
  };

  /**
   * Captures the current frame from the video element as a base64 JPEG string.
   */
  const captureCurrentFrame = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw the video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 jpeg (without the data prefix for the API usually, but here we strip it in service if needed)
    // The service expects raw base64 usually, so let's strip header here or there.
    // The existing fileToGenerativePart strips it. Let's do it here.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return dataUrl.split(',')[1];
  };

  // Start Initial Commentary
  const handleStartAnalysis = async () => {
    if (!videoState.base64Data || !videoState.mimeType) return;

    // Get duration from video element
    const duration = videoRef.current?.duration || 0;
    if (duration === 0) {
        console.warn("Video duration is 0 or not ready.");
    }

    setIsProcessing(true);
    setHasStartedAnalysis(true);
    
    const initialMessageId = Date.now().toString();
    
    // Add placeholder for streaming response
    setMessages(prev => [
      ...prev,
      {
        id: initialMessageId,
        role: 'model',
        text: '',
        timestamp: new Date(),
        isThinking: true
      }
    ]);

    try {
      await generateVideoCommentary(
        videoState.base64Data,
        videoState.mimeType,
        selectedStyle,
        enableSearch,
        duration, // Pass duration
        (streamedText, groundingSources) => {
          setMessages(prev => prev.map(msg => 
            msg.id === initialMessageId 
              ? { 
                  ...msg, 
                  text: streamedText, 
                  isThinking: false,
                  groundingSources: groundingSources
                } 
              : msg
          ));
        }
      );
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === initialMessageId 
          ? { ...msg, text: '抱歉，分析视频时遇到了错误，请重试。', isThinking: false } 
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Chat Input
  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: botMsgId,
      role: 'model',
      text: '',
      timestamp: new Date(),
      isThinking: true
    }]);

    try {
      // Get duration again (safe check)
      const duration = videoRef.current?.duration || 0;

      const response = await sendFollowUpMessage(
        messages, // pass full history
        userMsg.text,
        enableSearch,
        videoState.base64Data,
        videoState.mimeType,
        duration // Pass duration
      );

      // Handle AI Thumbnail Generation if Gemini called the tool
      let thumbnailUrl: string | undefined = undefined;
      let finalBotText = response.text;
      
      if (response.thumbnailCall) {
        // 1. Capture Frame (High quality base)
        const frameBase64 = captureCurrentFrame();
        
        if (frameBase64) {
             // 2. Call AI Generation (Nano Banana)
             try {
                const generatedImgData = await generateAIImage(frameBase64, response.thumbnailCall.visualPrompt);
                thumbnailUrl = generatedImgData;
             } catch (err) {
                console.error("AI Image Gen Failed", err);
                finalBotText += "\n\n(封面生成失败，请重试)";
             }
        } else {
             finalBotText += "\n\n(无法获取视频画面，请确保视频已加载)";
        }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { 
              ...msg, 
              text: finalBotText, 
              isThinking: false,
              groundingSources: response.groundingSources,
              thumbnailUrl: thumbnailUrl
            } 
          : msg
      ));

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, text: '连接服务时遇到问题，请检查您的网络。', isThinking: false } 
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      
      {/* Header */}
      <header className="flex-none bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-20">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-tennis-green p-2 rounded-lg">
              <Activity className="text-tennis-dark" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">AceInsight</h1>
              <p className="text-xs text-tennis-green font-medium">AI 网球解说员</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden container mx-auto max-w-6xl p-4 gap-6">
        
        {/* Left Column: Video & Controls */}
        <div className="w-full md:w-[45%] flex flex-col gap-4 overflow-y-auto scrollbar-hide">
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
               <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">分析面板</h2>
               {hasStartedAnalysis && (
                  <button onClick={handleClearVideo} className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300">
                    <Trash2 size={12} /> 重置
                  </button>
               )}
            </div>
            
            <VideoUploader 
              videoState={videoState} 
              onVideoSelected={handleVideoSelected} 
              onClear={handleClearVideo}
              videoRef={videoRef} // Pass Ref
            />

            {/* Config Panel */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">解说风格</label>
                <StyleSelector 
                  selectedStyle={selectedStyle} 
                  onStyleSelect={setSelectedStyle} 
                  disabled={isProcessing}
                />
              </div>

              {/* Research Toggle - Moved here for better visibility during setup */}
              <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2">
                    <Globe size={18} className="text-blue-400" />
                    <div className="flex flex-col">
                       <span className="text-sm font-medium text-slate-200">智能搜索联网</span>
                       <span className="text-[10px] text-slate-400">识别球员、比赛数据与历史</span>
                    </div>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={enableSearch}
                      onChange={(e) => setEnableSearch(e.target.checked)}
                      disabled={isProcessing}
                    />
                    <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tennis-green"></div>
                 </label>
              </div>

              {!hasStartedAnalysis && videoState.file && (
                <button
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="w-full py-4 bg-gradient-to-r from-tennis-green to-lime-500 text-tennis-dark font-bold text-lg rounded-xl shadow-lg shadow-lime-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? '正在分析比赛...' : '开始解说'}
                </button>
              )}
            </div>
          </div>
          
          {/* Instructions / Tips */}
          {!hasStartedAnalysis && (
            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-800 text-sm text-slate-400">
              <h3 className="text-slate-200 font-semibold mb-2">使用说明</h3>
              <ul className="space-y-2 list-disc pl-4">
                <li>上传一个简短的网球回合片段。</li>
                <li>选择你喜欢的解说风格（例如：专业、激情）。</li>
                <li>开启 <strong>智能搜索联网</strong> 以获取球员背景和数据支持。</li>
                <li>AI 将分析视频并提供同步解说。</li>
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Chat Interface */}
        <div className="w-full md:w-[55%] flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[600px] md:h-auto">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex justify-between items-center z-10">
            <span className="font-semibold text-slate-200">实时解说</span>
            {enableSearch && (
              <span className="text-xs text-blue-400 flex items-center gap-1 bg-blue-400/10 px-2 py-1 rounded">
                <Globe size={10} /> 搜索增强已开启
              </span>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0b1221]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                <Activity size={48} className="mb-4" />
                <p>准备好分析您的比赛了。</p>
              </div>
            ) : (
              messages.map(msg => <ChatMessage key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasStartedAnalysis ? "纠正解说，或输入“生成封面”..." : "上传视频以开始聊天"}
                disabled={!hasStartedAnalysis || isProcessing}
                className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700 rounded-full py-3 pl-5 pr-12 focus:outline-none focus:border-tennis-green/50 focus:ring-1 focus:ring-tennis-green/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || !hasStartedAnalysis || isProcessing}
                className="absolute right-2 p-2 bg-tennis-green text-tennis-dark rounded-full hover:bg-lime-400 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            {enableSearch && (
               <p className="text-[10px] text-blue-400/70 mt-2 ml-4">
                 * 智能体将专门搜索球员数据和比赛信息。
               </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;