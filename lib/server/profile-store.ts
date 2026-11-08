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
export const PROFILE_UNREADABLE='PROFILE_UNREADABLE';
const UNREADABLE_MESSAGE='已保存的档案无法读取（文件损坏或与当前版本不兼容）。原文件已保留，本次操作不会覆盖或删除它。';
function unreadable():never {
  throw Object.assign(new Error(UNREADABLE_MESSAGE),{status:409,code:PROFILE_UNREADABLE});
}
function profilesDir():string {
  return join(process.cwd(),'.pethome-data','profiles');
}
/**
 * 读取一个档案文件。语义（与 lib/db/index.ts 的约定一致）：
 *   null  = 文件确实不存在（ENOENT），服务端确实没有档案；
 *   抛错  = 存在但读不出来（JSON 损坏 / 不符合现有 schema / 其他 IO 错误）。
 * 坏档案一律原样保留，不删除、不改名、不返回 null（否则会被当成空档并被新档案覆盖）。
 */
async function loadProfileFile(file:string):Promise<Pet|null> {
  let text:string;
  try{text=await readFile(file,'utf8');}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{return unreadable();}
  const pet=validatePet(parsed);
  if(!pet)return unreadable();
  return pet;
}
export async function readProfile(key:string):Promise<Pet|null> {
  return loadProfileFile(pathFor(key));
}
export async function writeProfile(pet:Pet,existingKey:string|null):Promise<string> {
  const key=existingKey??randomBytes(32).toString('hex'),file=pathFor(key),dir=profilesDir();
  await mkdir(dir,{recursive:true});
  if(existingKey!==null){
    // 覆盖前先确认目标文件不是坏档案：坏档案抛 PROFILE_UNREADABLE(409)，
    // 写入在这里中止——不删除原文件、不改 cookie、不静默覆盖。
    await loadProfileFile(file);
  }
  const temporary=file+'.'+randomBytes(6).toString('hex')+'.tmp';
  await writeFile(temporary,JSON.stringify(pet),{encoding:'utf8',mode:0o600});
  await rename(temporary,file);
  return key;
}
