export enum CommentaryStyle {
  PROFESSIONAL = '专业解说 (深度战术分析)',
  EXCITED = '激情粉丝 (高能量/呐喊)',
  TECHNICAL = '技术教练 (动作/机制)',
  HUMOROUS = '幽默风趣 (玩梗/吐槽)',
  POETIC = '文艺诗人 (优美/戏剧化)'
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  videoTitle?: string; // New: For the viral title
  thumbnailUrl?: string; // New: For the generated thumbnail image
  groundingSources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface VideoState {
  file: File | null;
  previewUrl: string | null;
  base64Data: string | null;
  mimeType: string;
}

export interface AnalysisConfig {
  style: CommentaryStyle;
  enableSearch: boolean;
}