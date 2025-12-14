import { GoogleGenAI, GenerateContentResponse, Chat, FunctionDeclaration, Type } from "@google/genai";
import { CommentaryStyle, Message } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the thumbnail generation tool
const thumbnailTool: FunctionDeclaration = {
  name: 'generateThumbnail',
  description: 'Call this tool when the user asks to generate a cover, thumbnail, or poster, OR when they ask to modify the existing cover.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      visualPrompt: {
        type: Type.STRING,
        description: 'A descriptive prompt for the AI image generator. Describe the scene, the text to include, and the vibe based on the video content. e.g. "A tennis player hitting a smash, text title: SUPER SMASH, energetic lighting"',
      },
    },
    required: ['visualPrompt'],
  },
};

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:video/mp4;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generates an AI Image based on a reference video frame.
 * Uses gemini-2.5-flash-image (Nano Banana).
 */
export const generateAIImage = async (base64Frame: string, promptText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType: 'image/jpeg', 
              data: base64Frame 
            } 
          },
          { text: `Generate a high-quality vertical tennis video cover. ${promptText}` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16", // Vertical for Short video cover
        }
      }
    });

    // Iterate through parts to find the image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated in response");
  } catch (e) {
    console.error("Image generation failed:", e);
    throw e;
  }
};

/**
 * Generates the initial commentary for a video.
 */
export const generateVideoCommentary = async (
  base64Data: string,
  mimeType: string,
  style: CommentaryStyle,
  enableSearch: boolean,
  videoDuration: number, // Added video duration param
  onStream: (text: string, groundingSources?: {title: string, uri: string}[]) => void
): Promise<string> => {
  const modelId = 'gemini-2.5-flash'; 
  
  // Calculate word limit based on average speaking rate (approx 4.5 chars per second for energetic commentary)
  const maxChars = Math.max(20, Math.floor(videoDuration * 4.5));

  let prompt = `
  你是一位世界顶级的网球解说员和社交媒体专家。
  请分析这段网球视频片段。
  
  **硬性限制（CRITICAL）：**
  1. **视频总时长为：${videoDuration.toFixed(1)}秒**。
  2. 你的解说词必须能在视频播放时间内读完。
  3. **字数严格限制**：按中文正常语速，请将正文控制在 **${maxChars}字以内**。
  
  你的解说风格是：${style}。
  
  **第一步：生成标题**
  在开始解说之前，请先为这段视频生成一个【中文标题】。
  标题要求：
  1. **吸引人**：类似抖音/B站的爆款风格，能勾起用户点击欲望。
  2. **准确**：基于视频真实内容，不能标题党（欺骗）。
  3. **格式**：请严格按照此格式在第一行输出： "标题：[这里是标题内容]"。

  **第二步：解说分析 (最高指令：所见即所得，绝不猜测)**
  1. **精准的击球分析 (每一拍)**：
     - **只描述确定的内容**。如果画面模糊，严禁猜测旋转或握拍。
     - 重点捕捉关键球（制胜分、失误、战术变化）。
  
  2. **球员身份识别**：
     - 除非画面极其清晰且能 100% 确认，否则**必须**使用视觉代称（“近端选手”、“发球方”）。
  
  3. **收尾**：
     - 在解说末尾，请另起一行，用括号标注预估阅读时长，例如："(预估阅读时长：5.2秒 / 视频时长：${videoDuration.toFixed(1)}秒)"。
  
  全程使用**中文（简体）**。
  `;

  if (enableSearch) {
    prompt += `
    【搜索增强模式】: 尝试识别球员。如果能确认，使用 Google Search 获取背景。如果无法确信，忽略搜索。
    `;
  }

  const tools = enableSearch ? [{ googleSearch: {} }] : [];

  try {
    const responseStream = await ai.models.generateContentStream({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        tools: tools,
        temperature: style === CommentaryStyle.TECHNICAL ? 0.2 : 0.5,
      }
    });

    let fullText = '';
    let groundingSources: {title: string, uri: string}[] = [];

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
      }
      
      const metadata = chunk.candidates?.[0]?.groundingMetadata;
      if (metadata?.groundingChunks) {
         metadata.groundingChunks.forEach((c: any) => {
           if (c.web) {
             groundingSources.push({ title: c.web.title, uri: c.web.uri });
           }
         });
      }

      const uniqueSources = Array.from(new Map(groundingSources.map(item => [item.uri, item])).values());

      onStream(fullText, uniqueSources.length > 0 ? uniqueSources : undefined);
    }
    return fullText;

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};

/**
 * Handles follow-up chat with context + tools.
 * Detects if the user wants to re-analyze the video, otherwise relies on history.
 */
export const sendFollowUpMessage = async (
  history: Message[],
  newMessage: string,
  enableSearch: boolean,
  base64VideoData: string | null,
  mimeType: string,
  videoDuration: number // Added duration param
): Promise<{ 
  text: string, 
  groundingSources?: {title: string, uri: string}[],
  thumbnailCall?: { visualPrompt: string } // Return structured data if tool was called
}> => {

  const modelId = 'gemini-2.5-flash';
  
  // Calculate word limit based on average speaking rate
  const maxChars = Math.max(20, Math.floor(videoDuration * 4.5));

  // 1. Check if user intends to re-analyze based on keywords
  const reAnalysisKeywords = ["重新分析", "再看一遍", "重看", "再分析", "re-analyze", "analyze again", "look again"];
  const shouldReAnalyze = reAnalysisKeywords.some(keyword => newMessage.toLowerCase().includes(keyword));

  const parts: any[] = [];
  
  // 2. Conditionally attach video data
  if (shouldReAnalyze && base64VideoData) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64VideoData
      }
    });
  }

  // 3. Construct Context Prompt
  let contextPrompt = `
  Previous context (Chat History):
  ${history.filter(h => h.role !== 'system').map(h => `${h.role}: ${h.text}`).join('\n')}
  
  Current User Instruction: ${newMessage}
  
  **硬性时长限制（CRITICAL）：**
  视频总时长为 **${videoDuration.toFixed(1)}秒**。
  任何生成的解说词/口播稿，字数必须严格控制在 **${maxChars}字以内**。
  `;

  if (shouldReAnalyze) {
    contextPrompt += `
    **任务指令：【重新分析模式】**
    用户明确要求重新分析视频。
    1. 请忽略历史对话中可能存在的错误判断。
    2. 结合视频画面，根据用户的新指令（"${newMessage}"）进行全新的、更准确的解说或回答。
    3. 必须在回答末尾标注："(预估阅读时长：X秒 / 视频时长：${videoDuration.toFixed(1)}秒)"。
    `;
  } else {
    contextPrompt += `
    **任务指令：【对话调整模式】**
    用户正在请求调整解说风格或纠正内容。
    1. 你**不需要**重新观看视频（为了节省资源）。请完全基于上述对话历史中的【初始解说】和已知的视频信息进行调整。
    2. 如果用户指出解说有误、要求修改风格、或觉得太长/太短，请直接**重写**相应的解说段落。
    3. **确保精炼**：不要解释你为什么修改，直接给出修改后的解说词即可。
    4. 必须在回答末尾标注："(预估阅读时长：X秒 / 视频时长：${videoDuration.toFixed(1)}秒)"。
    
    5. **生成/修改封面**：
       - 如果用户提到“封面”、“海报”、“缩略图”，请调用 \`generateThumbnail\` 工具。
    `;
  }

  parts.push({ text: contextPrompt });

  const tools: any[] = [];
  tools.push({ functionDeclarations: [thumbnailTool] }); // Add thumbnail tool
  if (enableSearch) {
    tools.push({ googleSearch: {} });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        tools: tools,
      }
    });

    // Check for function calls
    let thumbnailCall = undefined;
    const functionCalls = response.candidates?.[0]?.content?.parts?.[0]?.functionCall 
      ? [response.candidates[0].content.parts[0].functionCall] // Single call
      : response.functionCalls; // Multiple calls helper

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls.find(fc => fc.name === 'generateThumbnail');
      if (call) {
        thumbnailCall = {
          visualPrompt: call.args['visualPrompt'] as string
        };
      }
    }

    // Extract grounding info
    let groundingSources: {title: string, uri: string}[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingSources.push({
            title: chunk.web.title,
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      text: response.text || (thumbnailCall ? "没问题，正在为您设计视频封面..." : "抱歉，无法生成回答。"),
      groundingSources,
      thumbnailCall
    };

  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};