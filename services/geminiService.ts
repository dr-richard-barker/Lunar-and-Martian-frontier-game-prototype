
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getSolarEvent(gameStateSummary: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the Mission Control AI for a colonization project on the Moon and Mars. 
      Generate a random 'Solar Event' or 'Mission Incident' that affects the players. 
      The event should have a creative name, a description, and a mechanical effect (e.g., losing a specific resource, getting a bonus, or skipping a turn).
      Context: ${gameStateSummary}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            effect: { type: Type.STRING },
            impact: { 
              type: Type.OBJECT, 
              properties: {
                resourceType: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              }
            }
          },
          required: ['title', 'description', 'effect']
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      title: "Comm Silence",
      description: "Atmospheric interference has cut off communications briefly.",
      effect: "No major impact this turn."
    };
  }
}

export async function getMissionLore(playerContext: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a 2-sentence atmospheric transmission from a commander on ${playerContext}. 
      Make it gritty and sci-fi. Focus on survival and resource scarcity.`
    });
    return response.text;
  } catch (error) {
    return "The stars are cold, but our resolve is steel. Keep drilling.";
  }
}
