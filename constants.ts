import { OutfitPreset } from './types';

export const OUTFIT_PRESETS: OutfitPreset[] = [
  // Casual
  { id: '1', name: 'カジュアルパーカー', prompt: 'oversized casual hoodie and denim shorts, streetwear style', category: 'casual' },
  { id: '2', name: '夏のワンピース', prompt: 'white floral summer sundress, straw hat', category: 'casual' },
  { id: '3', name: '冬のコート', prompt: 'beige wool trench coat, red scarf, winter fashion', category: 'casual' },
  { id: '4', name: 'スポーツウェア', prompt: 'fitness gym wear, leggings and sports bra, athletic style', category: 'casual' },
  
  // Fantasy
  { id: '5', name: '重騎士の鎧', prompt: 'silver plate armor, knight aesthetics, fantasy style, cape', category: 'fantasy' },
  { id: '6', name: '魔法使いのローブ', prompt: 'mystical mage robe with starry patterns, hood, glowing runes', category: 'fantasy' },
  { id: '7', name: 'エルフの衣装', prompt: 'elegant elven tunic, forest green and gold details, nature motifs', category: 'fantasy' },
  { id: '8', name: '冒険者', prompt: 'leather adventurer gear, belts, pouches, rpg style', category: 'fantasy' },

  // Formal/Traditional
  { id: '9', name: 'ビジネススーツ', prompt: 'sharp black business suit, white shirt, professional look', category: 'formal' },
  { id: '10', name: 'イブニングドレス', prompt: 'elegant red evening gown, jewelry, luxury fashion', category: 'formal' },
  { id: '11', name: '着物 (桜柄)', prompt: 'traditional japanese kimono with cherry blossom patterns, obi belt', category: 'formal' },
  { id: '12', name: 'タキシード', prompt: 'classic black tuxedo, bow tie, formal wear', category: 'formal' },

  // Occupation
  { id: '13', name: '白衣 (ドクター)', prompt: 'white medical lab coat, stethoscope, doctor outfit', category: 'occupation' },
  { id: '14', name: 'ナース服', prompt: 'classic nurse uniform, medical cap', category: 'occupation' },
  { id: '15', name: '警察官', prompt: 'police officer uniform, badge, hat', category: 'occupation' },
  { id: '16', name: 'シェフ', prompt: 'white chef uniform, chef hat, apron', category: 'occupation' },

  // Costume
  { id: '17', name: 'メイド服', prompt: 'classic french maid outfit, frills, apron, headdress', category: 'costume' },
  { id: '18', name: 'サイバーパンク', prompt: 'futuristic cyberpunk techwear, neon accents, transparent jacket', category: 'costume' },
  { id: '19', name: 'スチームパンク', prompt: 'steampunk attire, gears, goggles, victorian influence, corset', category: 'costume' },
  { id: '20', name: '忍者', prompt: 'black ninja shinobi shozoku, mask, stealth gear', category: 'costume' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  casual: 'カジュアル',
  fantasy: 'ファンタジー',
  formal: 'フォーマル/和装',
  occupation: '職業',
  costume: 'コスチューム',
};
