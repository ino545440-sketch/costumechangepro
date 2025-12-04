import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ModelTier } from '../types';

// NOTE: We now require the API Key to be passed in, supporting both Env vars (dev) and User Input (web).

const MODEL_CONFIG = {
  pro: {
    analysis: "gemini-2.5-pro",
    verification: "gemini-2.5-pro"
  },
  flash: {
    analysis: "gemini-2.5-flash",
    verification: "gemini-2.5-flash"
  }
};

/**
 * Helper function to retry operations with exponential backoff.
 * Useful for handling transient 503 or timeout errors from the API.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const msg = error.message || JSON.stringify(error);

      // Check for transient errors: 503, 500, 504, 429, or timeouts
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('500') ||
        msg.includes('TIMEOUT') ||
        msg.includes('timed out') ||
        msg.includes('429');

      if (!isTransient || i === retries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i); // 1s, 2s, 4s
      console.warn(`API Attempt ${i + 1} failed. Retrying in ${delay}ms...`, msg);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Debug function to list available models for the API key.
 */
export const listModels = async (apiKey: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.list();
    // The response itself is iterable or has a models property depending on version.
    // For @google/genai v1.30, it returns a Pager.
    // We can iterate it asynchronously or check documentation.
    // Let's try simple iteration as it likely implements AsyncIterable.
    const models: string[] = [];
    for await (const model of response) {
      if (model.name) models.push(model.name);
    }
    return models;
  } catch (error) {
    console.error("List Models Error:", error);
    return [];
  }
};

/**
 * Analyzes the image to extract character details and creates a new prompt with the target outfit.
 */
export const analyzeAndCreatePrompt = async (
  apiKey: string,
  imageBase64: string,
  targetOutfit: string,
  modelTier: ModelTier = 'pro'
): Promise<{ yaml: string; prompt: string }> => {

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are an expert Technical Artist specializing in AI Image Editing and Inpainting consistency.
    Your GOAL is to write a precise "Edit Instruction Prompt" that tells the AI exactly what to change and what to PROTECT.
    The user wants to change ONLY the outfit. The Face, Hair, Pose, and Background must remain PIXEL-PERFECTLY identical to the original.

    ## STEP 1: IMMUTABLE FEATURE EXTRACTION (YAML)
    Analyze the image and extract these specific features into YAML.
    
    1. **VISIBLE_ZONES**:
       - List EXPLICITLY visible body parts: ["HEAD", "NECK", "SHOULDERS", "CHEST", "ARMS", "WAIST", "HIPS", "LEGS", "FEET"].
       - If the image is a bust-up/portrait, do NOT list HIPS, LEGS, or FEET.
    2. **HAIR_MASTER**:
       - Color & Style (e.g., "Silver twin-tails").
       - **LOCK_INSTRUCTION**: "Keep the [Color] [Style] hair exactly as is."
    3. **FACE_MASTER**:
       - Expression & Features.
       - **LOCK_INSTRUCTION**: "Do not change the face, eyes, or expression."
    4. **POSE_MASTER**:
       - Exact limb positions.
       - **LOCK_INSTRUCTION**: "Maintain the exact pose: [Description]."
    5. **BACKGROUND_MASTER**:
       - Describe the background elements (lighting, setting, objects) briefly.
       - **LOCK_INSTRUCTION**: "Keep the [Description] background exactly unchanged."

    ## STEP 2: EDITING PROMPT GENERATION
    Create a prompt specifically for an Image-to-Image / Inpainting model.
    The prompt should NOT describe the scene from scratch. It should be a command to MODIFY.
    
    Structure:
    "/* --- OUTFIT (New!) --- */
    [TARGET_OUTFIT COPIED VERBATIM. See Rules below.]
    
    *** PROTECTION MANDATES (STRICTLY ENFORCE) ***
    - BACKGROUND: [BACKGROUND_MASTER LOCK_INSTRUCTION]. Do not regenerate the background.
    - IDENTITY: [FACE_MASTER LOCK_INSTRUCTION]. [HAIR_MASTER LOCK_INSTRUCTION].
    - POSE: [POSE_MASTER LOCK_INSTRUCTION].
    - PHOTOGRAPHY: Keep the original camera angle, lighting, and composition."

    ## STRICT RULES
    - **VERBATIM OUTFIT RULE (CRITICAL)**:
      - The user's input "${targetOutfit}" is the SOURCE OF TRUTH.
      - **DO NOT SUMMARIZE. DO NOT TRANSLATE. DO NOT SIMPLIFY.**
      - COPY the user's outfit description EXACTLY as provided into the "/* --- OUTFIT (New!) --- */" section.
      - **PRESERVE** all adjectives, parentheses, detailed cuts, trims, materials, and styles.
      - Example: If user says "white halter bodysuit (heart cutout)", output MUST be "white halter bodysuit (heart cutout)".
    
    - **SANITIZE TARGET OUTFIT (MINIMAL)**: 
      - ONLY remove instructions that explicitly contradict the task, such as "change background to beach" or "change pose to sitting".
      - **KEEP** everything else, even if it seems complex or verbose.
    
    - **VISIBILITY FILTER**: Intelligent Filtering is required.
      - If 'FEET' are missing in VISIBLE_ZONES -> REMOVE shoes, socks, boots from target outfit.
      - If 'LEGS' are missing -> REMOVE pants, skirts, shorts, leggings.
      - If only 'HEAD/NECK' visible -> REMOVE shirt, jacket, etc., keep only headwear/neck accessories if applicable.
      - **EXAMPLE**: If target is "Hoodie, Jeans, Sneakers" but image is Bust-Up -> Output only "Hoodie".
    
    - **FORMATTING**: The outfit section MUST start with "/* --- OUTFIT (New!) --- */".
    - **NEVER** describe the *original* outfit.
    - **EMPHASIZE**: "Change ONLY the outfit."
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_CONFIG[modelTier].analysis,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: `Analyze this image and generate the strict outfit-change editing prompt.\n\nTARGET OUTFIT COMMAND: "${targetOutfit}"` }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            yaml_analysis: {
              type: Type.STRING,
              description: "The strict YAML analysis including VISIBLE_ZONES, HAIR, FACE, POSE, BACKGROUND."
            },
            generation_prompt: {
              type: Type.STRING,
              description: "The editing prompt starting with '/* --- OUTFIT (New!) --- */...'"
            }
          },
          required: ["yaml_analysis", "generation_prompt"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    return {
      yaml: result.yaml_analysis || "解析に失敗しました。",
      prompt: result.generation_prompt || `/* --- OUTFIT (New!) --- */\n${targetOutfit}\n\n*** PROTECTION MANDATES ***\nKeep everything else.`
    };

  } catch (error) {
    console.error("Analysis Error:", error);
    // Propagate the specific error message if possible to help with debugging/feedback
    throw error;
  }
};

/**
 * Analyzes a reference image to extract ONLY the outfit details.
 */
export const analyzeReferenceOutfit = async (
  apiKey: string,
  refImageBase64: string,
  modelTier: ModelTier = 'pro'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a Fashion Analyst expert.
    Your task is to analyze the image and extract a precise, comma-separated description of the outfit/clothing shown.
    
    RULES:
    - **IGNORE** the person (face, hair, body type, pose).
    - **IGNORE** the background.
    - **FOCUS ONLY** on clothes, shoes, accessories (jewelry, hats, bags).
    - **OUTPUT** a comma-separated list of English keywords describing items, materials, colors, and specific styles.
    - **FORMAT**: "Item 1 (color/material), Item 2 (style), Item 3..."
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_CONFIG[modelTier].analysis,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: refImageBase64 } },
          { text: "Extract the outfit keywords from this reference image." }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfit_keywords: {
              type: Type.STRING,
              description: "Comma-separated list of outfit keywords."
            }
          },
          required: ["outfit_keywords"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    return result.outfit_keywords || "";
  } catch (error) {
    console.error("Reference Analysis Error:", error);
    throw new Error("リファレンス画像の解析に失敗しました。");
  }
}

/**
 * Analyzes the image to extract character details and creates a prompt to remove the background.
 */
export const analyzeAndCreateExtractionPrompt = async (
  apiKey: string,
  imageBase64: string,
  modelTier: ModelTier = 'pro'
): Promise<{ yaml: string; prompt: string }> => {

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are an expert Technical Artist.
    Your GOAL is to isolate the character by removing the background while keeping the character (including their CURRENT OUTFIT) exactly as is.
    
    ## STEP 1: IMMUTABLE FEATURE EXTRACTION (YAML)
    Analyze the image and extract these specific features into YAML.
    
    1. **HAIR_MASTER**:
       - Color & Style.
       - **LOCK_INSTRUCTION**: "Keep the [Color] [Style] hair exactly as is."
    2. **FACE_MASTER**:
       - Expression & Features.
       - **LOCK_INSTRUCTION**: "Do not change the face, eyes, or expression."
    3. **OUTFIT_MASTER**:
       - Describe the CURRENT outfit in detail.
       - **LOCK_INSTRUCTION**: "Keep the [Description] outfit exactly unchanged."
    4. **POSE_MASTER**:
       - Exact limb positions.
       - **LOCK_INSTRUCTION**: "Maintain the exact pose."
    5. **BACKGROUND_MASTER**:
       - Describe the current background that needs to be removed.
       - **LOCK_INSTRUCTION**: "Completely remove the [Description]. The character must be isolated on a solid white background."

    ## STEP 2: EDITING PROMPT GENERATION
    Structure:
    "/* --- BACKGROUND REMOVAL --- */
    Solid white background, clean isolation, product shot style, no shadows, simple background.
    
    *** PROTECTION MANDATES (STRICTLY ENFORCE) ***
    - OUTFIT: [OUTFIT_MASTER LOCK_INSTRUCTION].
    - IDENTITY: [FACE_MASTER LOCK_INSTRUCTION]. [HAIR_MASTER LOCK_INSTRUCTION].
    - POSE: [POSE_MASTER LOCK_INSTRUCTION].
    - ACTION: Remove the original background completely."
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_CONFIG[modelTier].analysis,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: "Analyze this image and generate the background removal prompt." }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            yaml_analysis: {
              type: Type.STRING,
              description: "The strict YAML analysis."
            },
            generation_prompt: {
              type: Type.STRING,
              description: "The editing prompt starting with '/* --- BACKGROUND REMOVAL --- */...'"
            }
          },
          required: ["yaml_analysis", "generation_prompt"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    return {
      yaml: result.yaml_analysis || "解析に失敗しました。",
      prompt: result.generation_prompt || "Remove background, keep character."
    };

  } catch (error) {
    console.error("Analysis Error:", error);
    throw new Error("キャラクターの解析に失敗しました。");
  }
};

/**
 * Generates the image using the Nano Banana Pro model with Image-to-Image editing.
 */
export const generateOutfitImage = async (
  apiKey: string,
  originalImageBase64: string,
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  try {
    // We send BOTH the original image and the text prompt to perform an Edit/Variation.
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: originalImageBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "2K"
        }
      }
    }));

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data returned.");

  } catch (error: any) {
    console.error("Generation Error:", error);

    // Check for permission errors (403)
    const msg = error.message || JSON.stringify(error);
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      throw new Error("PERMISSION_DENIED: 権限エラー(403)。このモデルを使用するには、Google Cloudプロジェクトで課金が有効なAPIキーが必要です。");
    }

    throw new Error("画像の生成に失敗しました。");
  }
};

/**
 * Verifies if the generated image plausibly matches the target outfit description.
 */
export const verifyOutfitMatch = async (
  apiKey: string,
  generatedImageBase64: string,
  targetDescription: string,
  modelTier: ModelTier = 'pro'
): Promise<{ match: boolean; reason: string }> => {
  // Use a faster, multimodal capable model for verification
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a Quality Assurance Judge for an AI Fashion Tool.
    Your task is to compare the OUTFIT in the generated image against the USER'S TEXT DESCRIPTION.
    
    INPUT:
    - Image: The generated character image.
    - Description: "${targetDescription}"
    
    JUDGMENT RULES:
    1. **MATCH (true)**: The outfit generally resembles the description (e.g., correct item type, correct main color). Small details can be ignored.
    2. **MISMATCH (false)**: The outfit is completely different (e.g., User asked for "Blue Dress" but got "Red Armor", or "Hoodie" but got "Suit").
    
    Output JSON: { "match": boolean, "reason": string }
    The "reason" must be in JAPANESE, briefly explaining why it matches or not.
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_CONFIG[modelTier].verification,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: generatedImageBase64 } }, // generatedImage is usually PNG
          { text: `Does the character's outfit in this image match the description: "${targetDescription}"?` }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["match", "reason"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    return {
      match: result.match ?? true, // Default to true if parsing fails to avoid false alarms
      reason: result.reason || ""
    };

  } catch (error) {
    console.warn("Verification failed, assuming success to avoid blocking user.", error);
    return { match: true, reason: "" };
  }
};