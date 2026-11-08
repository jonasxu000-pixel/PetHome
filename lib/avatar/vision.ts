import { ProviderError,runVision } from '../ai/provider.ts';
import { defaultAvatar,validateAvatar } from './profile.ts';
import type { AvatarProfile } from '../types.ts';
import { modelJsonText } from '../ai/json.ts';
import { matchPetModel } from '../pet3d/catalog.ts';
export const AVATAR_PROMPT=`只分析照片中唯一一只清晰猫或狗的可见外观，用于匹配现有3D预设，不是生成3D模型。不要判断年龄、健康、情绪或编造品种。无宠物、多只、看不清物种时hasPet=false,species=unknown。只返回JSON：{"hasPet":true,"species":"cat或dog或unknown","coatColor":"#六位HEX主毛色或null","patchColor":"#六位HEX次毛色或null","muzzleColor":"#六位HEX口鼻毛色或null","eyeColor":"#六位HEX虹膜色或null","earShape":"floppy或pointed或unknown","pattern":"solid或tuxedo或spotted或unknown","coatLength":"short或long或unknown","bodyShape":"slim或average或round或unknown","facePattern":"solid或bicolor或tabby或calico或spotted或unknown","earFeature":"floppy或pointed或folded或unknown","unknownFields":[]}。tuxedo表示明显双色/脸胸浅色，不要求特定黑白；看不清的特征必须null或unknown，并把字段名放unknownFields，不用默认颜色冒充观察值。不要把背景或衣服当毛色；所有字段必须出现。`;
export function parseAvatarObservation(raw:string):Omit<AvatarProfile,'model'> {
  let value:Record<string,unknown>;
  try {value=JSON.parse(modelJsonText(raw));} catch {throw new ProviderError('AI_BAD_RESPONSE','照片外观返回格式无效，请重试。',502);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ProviderError('AI_BAD_RESPONSE','照片外观返回格式无效。',502);
  if(value.hasPet!==true||!['cat','dog'].includes(String(value.species)))throw new ProviderError('NO_CLEAR_PET','没能看清唯一一只猫或狗，请换一张正面清晰照片。',422);
  const base=defaultAvatar(value.species as 'cat'|'dog');
  const unknown=new Set<string>();
  const normalized:Record<string,unknown>={...value};
  for(const field of ['coatColor','patchColor','muzzleColor','eyeColor','earShape','pattern']) {
    if(!(field in value))throw new ProviderError('AI_BAD_RESPONSE','模型未完整描述外观，请重试。',502);
    if(value[field]===null||value[field]==='unknown') {
      normalized[field]=base[field as keyof AvatarProfile];unknown.add(field);
    } else if(typeof value[field]!=='string')throw new ProviderError('AI_BAD_RESPONSE','模型未完整描述外观，请重试。',502);
  }
  // The persisted v1 avatar used three coarse pattern names. Preserve the
  // model's detailed observation in traits, while accepting its exact synonym.
  const legacyPatterns:Record<string,string>={bicolor:'tuxedo',tabby:'spotted',calico:'spotted'};
  if(typeof normalized.pattern==='string'&&legacyPatterns[normalized.pattern])normalized.pattern=legacyPatterns[normalized.pattern];
  if(normalized.earShape==='folded')normalized.earShape='floppy';
  const traitValue=(key:string,allowed:string[])=>{
    if(value[key]===undefined||value[key]===null||value[key]==='unknown'){unknown.add(key);return 'unknown';}
    if(!allowed.includes(String(value[key])))throw new ProviderError('AI_BAD_RESPONSE','模型返回了无效外观特征。',502);
    return value[key];
  };
  if(Array.isArray(value.unknownFields))for(const key of value.unknownFields)if(typeof key==='string'&&/^[a-zA-Z.]{1,40}$/.test(key))unknown.add(key);
  const traits={coatLength:traitValue('coatLength',['short','long']),bodyShape:traitValue('bodyShape',['slim','average','round']),facePattern:traitValue('facePattern',['solid','bicolor','tabby','calico','spotted']),earShape:traitValue('earFeature',['floppy','pointed','folded']),unknownFields:[...unknown]};
  const avatar=validateAvatar({...base,...normalized,traits,version:1,origin:'manual',generatedAt:new Date().toISOString(),model:null});
  if(!avatar)throw new ProviderError('AI_BAD_RESPONSE','模型返回了无效的外观字段，请重试。',502);
  return {...avatar,origin:'ai_vision'};
}
export async function describeAvatar(image:string,signal?:AbortSignal):Promise<AvatarProfile> {
  const result=await runVision(image,AVATAR_PROMPT,parseAvatarObservation,signal,{timeoutMs:25000,maxOutputTokens:1024});
  const matched=matchPetModel(result);
  return {...result,origin:'ai_vision',generatedAt:new Date().toISOString(),...(matched.preset?{modelPresetId:matched.preset.id}:{})};
}
