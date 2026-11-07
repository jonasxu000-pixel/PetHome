import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Pet } from '../types.ts';
import { validateAvatar } from '../avatar/profile.ts';
export const PROFILE_COOKIE='pethome_profile';
const keyPattern=/^[a-f0-9]{64}$/;
export function profileKey(cookie:string|null):string|null {
  const match=cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(PROFILE_COOKIE+'='))?.slice(PROFILE_COOKIE.length+1);
  return match&&keyPattern.test(match)?match:null;
}
export function validatePet(value:unknown):Pet|null {
  if(!value||typeof value!=='object')return null;
  const p=value as Record<string,unknown>;
  if(typeof p.id!=='string'||!/^[a-f0-9-]{36}$/i.test(p.id)||typeof p.ownerDeviceId!=='string'||p.ownerDeviceId.length>128||typeof p.name!=='string'||!p.name.trim()||Array.from(p.name.trim()).length>12||!['cat','dog','other'].includes(String(p.type))||!['lively','clingy','aloof'].includes(String(p.personality)))return null;
  if(p.photoUrl!==null&&(typeof p.photoUrl!=='string'||p.photoUrl.length>710000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.photoUrl)))return null;
  if(typeof p.createdAt!=='string'||typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.updatedAt)))return null;
  const avatar=p.avatar===undefined?undefined:validateAvatar(p.avatar);
  if(p.avatar!==undefined&&!avatar)return null;
  return {id:p.id,ownerDeviceId:p.ownerDeviceId,name:p.name.trim(),type:p.type as Pet['type'],personality:p.personality as Pet['personality'],photoUrl:p.photoUrl as string|null,createdAt:p.createdAt,updatedAt:p.updatedAt,...(avatar?{avatar}:{})};
}
function pathFor(key:string) {
  if(!keyPattern.test(key))throw new Error('Invalid profile key');
  return join(process.cwd(),'.pethome-data','profiles',key+'.json');
}
export async function readProfile(key:string):Promise<Pet|null> {
  try {return validatePet(JSON.parse(await readFile(pathFor(key),'utf8')));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export async function writeProfile(pet:Pet,existingKey:string|null):Promise<string> {
  const key=existingKey??randomBytes(32).toString('hex'),file=pathFor(key);
  await mkdir(join(process.cwd(),'.pethome-data','profiles'),{recursive:true});
  const temporary=file+'.'+randomBytes(6).toString('hex')+'.tmp';
  await writeFile(temporary,JSON.stringify(pet),{encoding:'utf8',mode:0o600});
  await rename(temporary,file);
  return key;
}
