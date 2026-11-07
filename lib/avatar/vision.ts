import { ProviderError,runVision } from '../ai/provider.ts';
import { defaultAvatar,validateAvatar } from './profile.ts';
import type { AvatarProfile } from '../types.ts';
import { modelJsonText } from '../ai/json.ts';
const prompt=`只分析照片中唯一一只猫或狗的可见外观，帮助创建卡通分身。不要判断品种、年龄、健康或情绪。不是唯一清晰猫/狗时hasPet=false，species=unknown。只返回JSON：{"hasPet":true,"species":"cat或dog或unknown","coatColor":"#六位HEX主毛色","patchColor":"#六位HEX花纹毛色","muzzleColor":"#六位HEX口鼻部毛色","eyeColor":"#六位HEX眼睛颜色","earShape":"floppy或pointed","pattern":"solid或tuxedo或spotted"}。pattern=solid表示大体纯色，tuxedo表示脸胸浅色与身体深色，spotted表示明显斑块。看不清的眼色用深棕#48322A；不要把背景颜色当毛色。`;
export function parseAvatarObservation(raw:string):Omit<AvatarProfile,'model'> {
  let value:Record<string,unknown>;
  try {value=JSON.parse(modelJsonText(raw));} catch {throw new ProviderError('AI_BAD_RESPONSE','照片外观返回格式无效，请重试。',502);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ProviderError('AI_BAD_RESPONSE','照片外观返回格式无效。',502);
  if(value.hasPet!==true||!['cat','dog'].includes(String(value.species)))throw new ProviderError('NO_CLEAR_PET','没能看清唯一一只猫或狗，请换一张正面清晰照片。',422);
  for(const field of ['coatColor','patchColor','muzzleColor','eyeColor','earShape','pattern'])if(typeof value[field]!=='string')throw new ProviderError('AI_BAD_RESPONSE','模型未完整描述外观，请重试。',502);
  const avatar=validateAvatar({...defaultAvatar(value.species as 'cat'|'dog'),...value,version:1,origin:'manual',generatedAt:new Date().toISOString(),model:null});
  if(!avatar)throw new ProviderError('AI_BAD_RESPONSE','模型返回了无效的外观字段，请重试。',502);
  return {...avatar,origin:'ai_vision'};
}
export async function describeAvatar(image:string,signal?:AbortSignal):Promise<AvatarProfile> {
  const result=await runVision(image,prompt,parseAvatarObservation,signal);
  return {...result,origin:'ai_vision',generatedAt:new Date().toISOString()};
}
