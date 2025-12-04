export interface OutfitPreset {
  id: string;
  name: string;
  prompt: string;
  category: 'casual' | 'fantasy' | 'formal' | 'occupation' | 'costume';
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface GenerationResult {
  yamlAnalysis: string;
  generatedImageUrl: string | null;
}

export type AppState =
  | 'idle'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'complete'
  | 'error';

export type ModelTier = 'pro' | 'flash';
