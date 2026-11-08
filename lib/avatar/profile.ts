import type { AvatarProfile, PetType, PetVisualTraits } from '../types.ts';
import { getPetModelPresets } from '../pet3d/catalog.ts';
export function defaultAvatar(type:PetType='dog'):AvatarProfile {
  const preset=getPetModelPresets(type==='cat'?'cat':'dog')[0];
  return {version:1,species:type==='cat'?'cat':'dog',coatColor:preset?.primaryColor??'#C99A72',patchColor:preset?.secondaryColor??'#845F49',muzzleColor:'#FFF2DF',eyeColor:'#48322A',collarColor:'#7DAB9B',earShape:type==='cat'?'pointed':'floppy',pattern:'solid',origin:'starter',generatedAt:new Date().toISOString(),model:null,...(preset?{modelPresetId:preset.id}:{})};
}
const hex=/^#[0-9a-f]{6}$/i;
export function validateTraits(value:unknown):PetVisualTraits|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const t=value as Record<string,unknown>;
  if(!['short','long','unknown'].includes(String(t.coatLength))||!['slim','average','round','unknown'].includes(String(t.bodyShape))||!['solid','bicolor','tabby','calico','spotted','unknown'].includes(String(t.facePattern))||!['floppy','pointed','folded','unknown'].includes(String(t.earShape)))return null;
  if(!Array.isArray(t.unknownFields)||t.unknownFields.length>20||t.unknownFields.some(v=>typeof v!=='string'||!/^[a-zA-Z.]{1,40}$/.test(v)))return null;
  return {coatLength:t.coatLength as PetVisualTraits['coatLength'],bodyShape:t.bodyShape as PetVisualTraits['bodyShape'],facePattern:t.facePattern as PetVisualTraits['facePattern'],earShape:t.earShape as PetVisualTraits['earShape'],unknownFields:[...new Set(t.unknownFields as string[])]};
}
export function validateAvatar(value:unknown):AvatarProfile|null {
  if(!value||typeof value!=='object')return null;
  const a=value as Record<string,unknown>;
  if(a.version!==1||!['cat','dog'].includes(String(a.species))||!['floppy','pointed'].includes(String(a.earShape))||!['solid','tuxedo','spotted'].includes(String(a.pattern))||!['starter','photo_palette','ai_vision','manual'].includes(String(a.origin)))return null;
  for(const field of ['coatColor','patchColor','muzzleColor','eyeColor','collarColor'])if(typeof a[field]!=='string'||!hex.test(a[field] as string))return null;
  if(typeof a.generatedAt!=='string'||!Number.isFinite(Date.parse(a.generatedAt)))return null;
  if(a.model!==undefined&&a.model!==null&&(typeof a.model!=='string'||a.model.length>80))return null;
  if(a.origin==='ai_vision'&&(typeof a.model!=='string'||!a.model))return null;
  if((a.origin==='starter'||a.origin==='photo_palette')&&a.model!=null)return null;
  if(a.verification!==undefined&&(typeof a.verification!=='string'||!/^[a-f0-9]{64}$/.test(a.verification)))return null;
  if(a.modelPresetId!==undefined&&(typeof a.modelPresetId!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(a.modelPresetId)))return null;
  const traits=a.traits===undefined?undefined:validateTraits(a.traits);
  if(a.traits!==undefined&&!traits)return null;
  return {version:1,species:a.species as AvatarProfile['species'],coatColor:a.coatColor as string,patchColor:a.patchColor as string,muzzleColor:a.muzzleColor as string,eyeColor:a.eyeColor as string,collarColor:a.collarColor as string,earShape:a.earShape as AvatarProfile['earShape'],pattern:a.pattern as AvatarProfile['pattern'],origin:a.origin as AvatarProfile['origin'],generatedAt:a.generatedAt,model:a.model as string|null|undefined,...(a.modelPresetId?{modelPresetId:a.modelPresetId as string}:{}),...(traits?{traits}:{}),...(a.origin==='ai_vision'&&a.verification?{verification:a.verification as string}:{})};
}
export function avatarOriginLabel(avatar?:AvatarProfile):string {
  return {starter:'3D 预设分身',photo_palette:'照片配色建议 · 非 AI 识别',ai_vision:'AI 特征匹配 · 3D 预设',manual:'手动定制 · 3D 预设'}[avatar?.origin??'starter'];
}
