'use client';
import type { ApiResponse,AvatarProfile,Pet,PetType } from '../types';
import { defaultAvatar,validateAvatar } from './profile';
import { matchPetModel } from '../pet3d/catalog';
function loadPhoto(src:string,signal?:AbortSignal):Promise<HTMLImageElement> {
  if(!/^data:image\/(jpeg|png|webp);base64,/.test(src))return Promise.reject(new Error('请选择 JPEG、PNG 或 WebP 照片。'));
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    const abort=()=>{cleanup();image.src='';reject(new DOMException('已取消','AbortError'));};
    image.onload=()=>{cleanup();resolve(image);};
    image.onerror=()=>{cleanup();reject(new Error('照片无法读取，请换一张。'));};
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted){abort();return;}
    image.src=src;
  });
}
function hex(r:number,g:number,b:number):string {return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function photoPalette(image:HTMLImageElement,type:PetType):AvatarProfile {
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器无法处理照片。');
  ctx.drawImage(image,0,0,48,48);
  const {data}=ctx.getImageData(0,0,48,48);
  const buckets=new Map<string,{weight:number;r:number;g:number;b:number}>();
  for(let y=6;y<42;y++)for(let x=6;x<42;x++) {
    const i=(y*48+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    const brightness=(r+g+b)/3;if(brightness>242||brightness<10)continue;
    const weight=1.5-Math.hypot(x-24,y-24)/40;
    const key=[r,g,b].map(v=>Math.floor(v/32)).join(':');
    const item=buckets.get(key)??{weight:0,r:0,g:0,b:0};item.weight+=weight;item.r+=r*weight;item.g+=g*weight;item.b+=b*weight;buckets.set(key,item);
  }
  const colors=[...buckets.values()].sort((a,b)=>b.weight-a.weight).map(v=>({r:v.r/v.weight,g:v.g/v.weight,b:v.b/v.weight}));
  const base=defaultAvatar(type),main=colors[0];
  const second=main?colors.find(c=>Math.hypot(c.r-main.r,c.g-main.g,c.b-main.b)>70):undefined;
  return {...base,coatColor:main?hex(main.r,main.g,main.b):base.coatColor,patchColor:second?hex(second.r,second.g,second.b):base.patchColor,origin:'photo_palette',generatedAt:new Date().toISOString(),model:null};
}
export async function createAvatarFromPhoto(photoUrl:string,petType:PetType,signal?:AbortSignal):Promise<{avatar:AvatarProfile;notice?:string}> {
  if(petType==='other')throw new Error('目前支持猫和狗的分身，请先选择其中一种。');
  signal?.throwIfAborted();
  const image=await loadPhoto(photoUrl,signal),palette=photoPalette(image,petType);
  const matched=matchPetModel(palette);
  const fallback={...palette,...(matched.preset?{modelPresetId:matched.preset.id}:{})};
  const canvas=document.createElement('canvas'),scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器无法处理照片。');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  let jpeg=canvas.toDataURL('image/jpeg',0.72);if(jpeg.length>700000)jpeg=canvas.toDataURL('image/jpeg',0.45);
  if(jpeg.length>700000)throw new Error('照片过大，请换一张分辨率较低的照片。');
  try {
    const timeout=AbortSignal.timeout(60000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
    const response=await fetch('/api/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:jpeg,petType}),signal:requestSignal});
    const body=await response.json() as ApiResponse<AvatarProfile>;
    if(!response.ok||!body.ok) {
      const error=body.ok?{code:'AI_UNAVAILABLE',message:'定制服务暂不可用。'}:body.error;
      if(response.status===422||response.status===400||response.status===413)throw Object.assign(new Error(error.message),{noFallback:true});
      return {avatar:fallback,notice:error.code==='AI_NOT_CONFIGURED'?'AI 尚未连接；当前仅为照片配色建议，不是外观识别结果。请选择最接近的 3D 预设后确认。':'AI 识别暂不可用；当前仅保留照片配色建议，请手动确认 3D 预设。'};
    }
    const avatar=validateAvatar(body.data);
    if(!avatar||avatar.origin!=='ai_vision')return {avatar:fallback,notice:'AI 返回的外观未能使用，已改为照片配色建议，请确认。'};
    const unknown=avatar.traits?.unknownFields??[];
    const notices=['已识别照片特征并匹配现有 3D 预设，体型和花纹为近似表达，不是照片转 3D 建模。'];
    if(avatar.species!==petType)notices.push(`照片中的宠物被识别为${avatar.species==='cat'?'猫':'狗'}，已切换类型，请确认。`);
    if(unknown.length)notices.push('部分特征未看清，预览中的对应颜色为默认值，可手动选择预设。');
    return {avatar,notice:notices.join(' ')};
  } catch(error) {
    if(signal?.aborted||(error as {noFallback?:boolean}).noFallback)throw error;
    return {avatar:fallback,notice:'暂时无法连接 AI，已生成照片配色建议。确认外观后仍可进入小屋。'};
  }
}
export async function saveProfileToServer(pet:Pet):Promise<void> {
  const response=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pet),signal:AbortSignal.timeout(8000)});
  const body=await response.json() as ApiResponse<{saved:boolean}>;
  if(!response.ok||!body.ok)throw Object.assign(new Error(body.ok?'服务端保存未完成。':body.error.message),{code:body.ok?'PROFILE_SAVE_FAILED':body.error.code,httpStatus:response.status});
}
export async function loadProfileFromServer():Promise<Pet|null> {
  const response=await fetch('/api/profile',{signal:AbortSignal.timeout(8000),cache:'no-store'});
  const body=await response.json() as ApiResponse<Pet|null>;
  if(!response.ok||!body.ok)throw new Error(body.ok?'服务端档案读取失败。':body.error.message);
  return body.data;
}
