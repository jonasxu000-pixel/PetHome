import type { CaptureFrame } from '../types';
import { frameHash } from './dedupe';
function waitEvent(video:HTMLVideoElement,event:string,signal?:AbortSignal):Promise<void> {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,ready);video.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted);};
    const ready=()=>{cleanup();resolve();};
    const failed=()=>{cleanup();reject(new Error('无法解码此视频，请使用 H.264 编码的 MP4。'));};
    const aborted=()=>{cleanup();reject(new DOMException('已取消','AbortError'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('读取视频超时，请换一段较短的 MP4 后重试。'));},8000);
    video.addEventListener(event,ready,{once:true});video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true});
    if(signal?.aborted)aborted();
  });
}
export async function extractFrames(file:File,options:{signal?:AbortSignal;onProgress?:(current:number,total:number)=>void}={}):Promise<CaptureFrame[]> {
  if(file.size===0||file.size>32*1024*1024)throw new Error('请选择大小不超过 32MB 的有效视频。');
  if(!file.type.startsWith('video/')&&!/\.(mp4|mov|webm)$/i.test(file.name))throw new Error('请选择 MP4、MOV 或 WebM 视频。');
  const {signal}=options;
  signal?.throwIfAborted();
  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.preload='auto';
  video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);
  const url=URL.createObjectURL(file);
  try {
    const loaded=waitEvent(video,'loadeddata',signal);video.src=url;video.load();await loaded;
    if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>30.05)throw new Error('视频时长须在 0—30 秒之间，请先截短后重试。');
    if(!video.videoWidth||!video.videoHeight)throw new Error('视频没有可读取的画面。');
    const canvas=document.createElement('canvas');
    const scale=Math.min(1,768/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器不支持视频截帧。');
    const offsets:number[]=[];for(let t=0;t<video.duration;t+=4)offsets.push(t);
    const frames:CaptureFrame[]=[],base=Date.now()-video.duration*1000;
    for(const [seq,offset] of offsets.entries()) {
      signal?.throwIfAborted();
      const target=Math.min(offset+0.05,Math.max(0,video.duration-0.01));
      if(Math.abs(video.currentTime-target)>0.005){const seeked=waitEvent(video,'seeked',signal);video.currentTime=target;await seeked;}
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      let image=canvas.toDataURL('image/jpeg',0.7);
      if(image.length>400*1024)image=canvas.toDataURL('image/jpeg',0.4);
      if(image.length>400*1024)throw new Error('画面压缩后仍过大，请使用分辨率较低的视频。');
      frames.push({image,imageHash:frameHash(canvas),seq,capturedAt:new Date(base+offset*1000).toISOString(),offsetSec:offset});
      options.onProgress?.(seq+1,offsets.length);
    }
    return frames;
  } finally {
    video.pause();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);
  }
}
