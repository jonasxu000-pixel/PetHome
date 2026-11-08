import type { AvatarProfile, PetType } from '../types.ts';

export interface PetModelPreset {
  id: string;
  label: string;
  species: 'cat' | 'dog';
  src: string;
  description: string;
  source: string;
  license: string;
  creator?: string;
  licenseUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  pattern: 'solid' | 'bicolor' | 'tabby' | 'calico' | 'spotted';
  coatLength: 'short' | 'long';
  bodyShape: 'slim' | 'average' | 'round';
  earShape: 'floppy' | 'pointed' | 'folded';
  rotation?: [number, number, number];
  animations: { idle?: string; sleep?: string; interact?: string; walk?: string };
  customization: {
    coatMaterialNames: string[];
    patchMaterialNames?: string[];
    eyeMaterialNames?: string[];
    textureMode?: 'vuena-cat' | 'sloyd-cavapoo';
  };
}

// Only actually downloaded, inspected and licensed assets enter this catalogue.
export const PET_MODEL_PRESETS: readonly PetModelPreset[] = [{
  id: 'vuena-cat-cream', label: '橘猫 · 绒绒', species: 'cat',
  src: '/models/pets/vuena-cute-pets/cat.glb',
  description: '圆润猫咪，带原生待机、走路和睡觉动画。',
  source: 'https://vuena.itch.io/blocky-pets-free', license: 'CC0-1.0',
  primaryColor: '#F6A447', secondaryColor: '#CB7131', pattern: 'tabby',
  coatLength: 'short', bodyShape: 'round', earShape: 'pointed',
  animations: { idle: 'idle', sleep: 'sleep', interact: 'idle_alt', walk: 'walk' },
  customization: { coatMaterialNames: ['cat_mat'], patchMaterialNames: ['cat_mat'], eyeMaterialNames: ['cat_mat'], textureMode: 'vuena-cat' },
}, ...([
  { id: 'vuena-cat-orange-white', label: '橘白猫 · 奶酪', primaryColor: '#EEA45E', secondaryColor: '#F6EBDD', pattern: 'bicolor' },
  { id: 'vuena-cat-gray-white', label: '灰白猫 · 云朵', primaryColor: '#989A9D', secondaryColor: '#70747A', pattern: 'bicolor' },
  { id: 'vuena-cat-black-white', label: '黑白猫 · 奥利奥', primaryColor: '#363B44', secondaryColor: '#292D34', pattern: 'bicolor' },
  { id: 'vuena-cat-white', label: '奶白猫 · 糯米', primaryColor: '#EEE7DC', secondaryColor: '#E0D7C8', pattern: 'solid' },
] as const).map(p => ({
  ...p, species: 'cat' as const, src: '/models/pets/vuena-cute-pets/cat.glb',
  description: '保留原生猫咪造型，以毛色遮罩和中央白斑近似表达照片特征。',
  source: 'https://vuena.itch.io/blocky-pets-free', license: 'CC0-1.0',
  coatLength: 'short' as const, bodyShape: 'round' as const, earShape: 'pointed' as const,
  animations: { idle: 'idle', sleep: 'sleep', interact: 'idle_alt', walk: 'walk' },
  customization: { coatMaterialNames: ['cat_mat'], patchMaterialNames: ['cat_mat'], eyeMaterialNames: ['cat_mat'], textureMode: 'vuena-cat' as const },
})), ...([
  { id: 'sloyd-cavapoo-honey', label: '蜜糖卷毛犬', primaryColor: '#D9BC8A' },
  { id: 'sloyd-cavapoo-white', label: '奶白卷毛犬', primaryColor: '#EDE7DB' },
  { id: 'sloyd-cavapoo-cocoa', label: '可可卷毛犬', primaryColor: '#78604D' },
] as const).map(p => ({
  ...p, species: 'dog' as const, src: '/models/pets/sloyd/cavapoo-mobile.glb',
  description: '完整长毛狗外观，支持受控毛色微调和整体轻反馈；无骨骼与走路动画。',
  source: 'https://www.sloyd.ai/free-3d-models/model/a-golden-hair-cavapoo-with-a-base-pas04',
  license: 'CC BY 4.0', creator: 'Sloydinator', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  secondaryColor: '#765E46', pattern: 'solid' as const, coatLength: 'long' as const,
  bodyShape: 'round' as const, earShape: 'floppy' as const, animations: {},
  customization: { coatMaterialNames: [''], textureMode: 'sloyd-cavapoo' as const },
})), {
  id: 'sloyd-dalmatian', label: '黑白斑点犬', species: 'dog', src: '/models/pets/sloyd/dalmatian-mobile.glb',
  description: '保留原始黑白斑点贴图，支持整体轻反馈；没有骨骼，不能眨眼或走路。',
  source: 'https://www.sloyd.ai/free-3d-models/model/dalmatian-gl1xu', license: 'CC BY 4.0',
  creator: 'TopoForge', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  primaryColor: '#EFEFE8', secondaryColor: '#252525', pattern: 'spotted', coatLength: 'short',
  bodyShape: 'slim', earShape: 'floppy', animations: {}, customization: { coatMaterialNames: [] },
}];

export function getPetModelPresets(species?: PetType): PetModelPreset[] {
  return PET_MODEL_PRESETS.filter(p => !species || p.species === species);
}

function colorDistance(a: string, b: string): number {
  const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const x = rgb(a), y = rgb(b);
  return Math.hypot(...x.map((v, i) => v - y[i])) / 442;
}

export function matchPetModel(avatar: AvatarProfile): { preset: PetModelPreset | null; approximate: boolean; notes: string[] } {
  const candidates = getPetModelPresets(avatar.species);
  const wantedPattern=avatar.traits?.facePattern ?? (avatar.pattern === 'tuxedo' ? 'bicolor' : avatar.pattern);
  const lightness=(c:string)=>[1,3,5].reduce((n,i)=>n+parseInt(c.slice(i,i+2),16),0);
  const facePigment=avatar.origin==='ai_vision'&&!avatar.traits?.unknownFields.includes('patchColor')&&lightness(avatar.patchColor)<lightness(avatar.coatColor)?avatar.patchColor:avatar.coatColor;
  const ranked = candidates.map(p => ({ p, score: colorDistance(p.primaryColor, avatar.species==='cat'&&wantedPattern==='bicolor'&&p.pattern==='bicolor'?facePigment:avatar.coatColor)*1.6
    + (wantedPattern==='unknown'||p.pattern===wantedPattern ? 0 : p.pattern==='spotted'&&wantedPattern!=='spotted' ? .7 : .35)
    + (avatar.traits?.coatLength && avatar.traits.coatLength !== 'unknown' && p.coatLength !== avatar.traits.coatLength ? .3 : 0)
    + (avatar.traits?.bodyShape && avatar.traits.bodyShape !== 'unknown' && p.bodyShape !== avatar.traits.bodyShape ? .25 : 0)
    + (avatar.traits?.earShape && avatar.traits.earShape !== 'unknown' && p.earShape !== avatar.traits.earShape ? .2 : 0)
  })).sort((a, b) => a.score - b.score);
  return { preset: ranked[0]?.p ?? null, approximate: true,
    notes: candidates.length ? ['使用最接近的现有 3D 预设；体型与花纹为近似匹配，不是照片重建。'] : ['暂未提供该动物的可用 3D 模型。'] };
}

export function getPetModel(avatar?: AvatarProfile | null, fallbackType: PetType = 'cat'): PetModelPreset | null {
  const species = avatar?.species ?? (fallbackType === 'dog' ? 'dog' : 'cat');
  const selected = avatar?.modelPresetId && PET_MODEL_PRESETS.find(p => p.id === avatar.modelPresetId && p.species === species);
  return selected || (avatar ? matchPetModel(avatar).preset : getPetModelPresets(species)[0]) || null;
}
