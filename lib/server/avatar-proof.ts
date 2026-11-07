import { createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AvatarProfile } from '../types.ts';
let secretPromise:Promise<Buffer>|undefined;
async function secret():Promise<Buffer> {
  if(!secretPromise)secretPromise=(async()=>{
    const dir=join(process.cwd(),'.pethome-data'),path=join(dir,'avatar-signing.key');await mkdir(dir,{recursive:true});
    try{return await readFile(path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const key=randomBytes(32);
    try{await writeFile(path,key,{flag:'wx',mode:0o600});return key;}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return readFile(path);throw error;}
  })().catch(error=>{secretPromise=undefined;throw error;});
  return secretPromise;
}
function content(a:AvatarProfile):string {return JSON.stringify([a.version,a.species,a.coatColor,a.patchColor,a.muzzleColor,a.eyeColor,a.collarColor,a.earShape,a.pattern,a.origin,a.generatedAt,a.model]);}
export async function signAvatar(a:AvatarProfile):Promise<AvatarProfile> {return {...a,verification:createHmac('sha256',await secret()).update(content(a)).digest('hex')};}
export async function verifiedAvatar(a:AvatarProfile):Promise<boolean> {
  if(a.origin!=='ai_vision')return true;
  if(!a.verification||!/^[a-f0-9]{64}$/.test(a.verification))return false;
  const expected=createHmac('sha256',await secret()).update(content(a)).digest();
  return timingSafeEqual(expected,Buffer.from(a.verification,'hex'));
}
