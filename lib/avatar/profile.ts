import type { AvatarProfile, PetType } from '../types.ts';
export function defaultAvatar(type:PetType='dog'):AvatarProfile {
  return {version:1,species:type==='cat'?'cat':'dog',coatColor:'#C99A72',patchColor:'#845F49',muzzleColor:'#FFF2DF',eyeColor:'#48322A',collarColor:'#7DAB9B',earShape:type==='cat'?'pointed':'floppy',pattern:'solid',origin:'starter',generatedAt:new Date().toISOString(),model:null};
}
const hex=/^#[0-9a-f]{6}$/i;
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
  return {version:1,species:a.species as AvatarProfile['species'],coatColor:a.coatColor as string,patchColor:a.patchColor as string,muzzleColor:a.muzzleColor as string,eyeColor:a.eyeColor as string,collarColor:a.collarColor as string,earShape:a.earShape as AvatarProfile['earShape'],pattern:a.pattern as AvatarProfile['pattern'],origin:a.origin as AvatarProfile['origin'],generatedAt:a.generatedAt,model:a.model as string|null|undefined,...(a.origin==='ai_vision'&&a.verification?{verification:a.verification as string}:{})};
}
export function avatarOriginLabel(avatar?:AvatarProfile):string {
  return {starter:'通用分身',photo_palette:'照片配色定制',ai_vision:'AI 照片定制',manual:'手动定制'}[avatar?.origin??'starter'];
}
