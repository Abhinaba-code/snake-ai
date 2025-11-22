import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

let ai: GoogleGenAI | null = null;
let isRateLimited = false;
let rateLimitResetTime = 0;

// Safely access process.env to prevent crashes in browser environments
const getApiKey = (): string | undefined => {
  try {
    // Check if process exists before accessing it
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing process.env", e);
  }
  return undefined;
};

const apiKey = getApiKey();

try {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
} catch (error) {
  console.error("Failed to initialize Gemini client", error);
}

const getFallbackCommentary = (event: 'START' | 'GAME_OVER' | 'MILESTONE', score: number): string => {
  switch (event) {
    case 'START': return "Systems online. Ready to play!";
    case 'GAME_OVER': return `Game Over! Final Score: ${score}.`;
    case 'MILESTONE': return `Amazing! Score hit ${score}!`;
    default: return "Nice move!";
  }
};

export const generateGameCommentary = async (
  score: number, 
  highScore: number, 
  event: 'START' | 'GAME_OVER' | 'MILESTONE'
): Promise<string> => {
  if (!ai) return "AI Commentator is offline.";

  // Circuit Breaker: If rate limited, use fallback immediately to avoid API calls
  if (isRateLimited) {
    if (Date.now() > rateLimitResetTime) {
      isRateLimited = false; // Reset cooldown
    } else {
      return getFallbackCommentary(event, score);
    }
  }

  let prompt = "";

  switch (event) {
    case 'START':
      prompt = `You are a hyped-up e-sports announcer for a Snake game. The game just started. Give a one-sentence opening remark. Be energetic.`;
      break;
    case 'GAME_OVER':
      prompt = `You are a sarcastic game commentator. The player just lost the game of Snake. 
      Score: ${score}. 
      All-time High Score: ${highScore}. 
      Give a short, witty, slightly roasting one-sentence comment about their performance.`;
      break;
    case 'MILESTONE':
      prompt = `You are an impressed commentator. The player just reached a score of ${score} in Snake! Give a very short one-sentence compliment.`;
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    return response.text || getFallbackCommentary(event, score);
  } catch (error: any) {
    console.error("Gemini API Error:", error);

    // Detect 429 Resource Exhausted or similar quota errors
    const errorString = JSON.stringify(error);
    if (
      errorString.includes("429") || 
      errorString.includes("RESOURCE_EXHAUSTED") || 
      errorString.includes("quota")
    ) {
      console.warn("Gemini API Rate Limit Hit. Activating cooldown for 60 seconds.");
      isRateLimited = true;
      rateLimitResetTime = Date.now() + 60000; // 60 second cooldown
    }

    return getFallbackCommentary(event, score);
  }
};

export const checkApiKey = () => !!getApiKey();