'use client';
import type { ApiResponse, RecognitionResult } from '../types';
import { usePetStore } from '../store';
import { extractFrames } from '../capture/video';
import { saveFrames } from '../db';
function uuid() {
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function pause(ms:number,signal?:AbortSignal):Promise<void> {
  if(ms<=0){signal?.throwIfAborted();return Promise.resolve();}
  return new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('已取消','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
}
async function requestFrame(payload:unknown,signal?:AbortSignal):Promise<RecognitionResult> {
  for(let attempt=0;attempt<2;attempt++) {
    signal?.throwIfAborted();
    try {
      const timeout=AbortSignal.timeout(22000),requestSignal=signal?AbortSignal.any([timeout,signal]):timeout;
      const response=await fetch('/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},signal:requestSignal,body:JSON.stringify(payload)});
      const body=await response.json() as ApiResponse<RecognitionResult>;
      if(!response.ok||!body.ok) {
        const error=body.ok?{code:'AI_UNAVAILABLE',message:'识别失败，请重试。',retriable:response.status>=500}:body.error;
        throw Object.assign(new Error(error.message),{code:error.code,retriable:error.retriable});
      }
      return body.data;
    } catch(error) {
      if(signal?.aborted)throw error;
      const e=error as {retriable?:boolean;code?:string;name?:string};
      if(e.name==='TimeoutError') {e.code='AI_TIMEOUT';e.retriable=true;}
      const retry=e.retriable??(error instanceof TypeError);
      if(!retry||attempt===1)throw error;
      await pause(e.code==='RATE_LIMITED'?4000:1500,signal);
    }
  }
  throw new Error('识别请求未完成。');
}
export async function analyzeVideo(file:File,options:{signal?:AbortSignal}={}):Promise<void> {
  const initial=usePetStore.getState();
  if(initial.busy)return;
  if(!initial.pet){initial.setError('请先创建宠物档案。');return;}
  initial.setBusy(true);initial.beginAnalysis();initial.setError(null);initial.setVideoName(file.name);initial.setProgress(0,0);
  const petId=initial.pet.id,sessionId=uuid();
  let accepted=0;
  try {
    const frames=await extractFrames(file,{signal:options.signal});
    initial.setProgress(0,frames.length);
    let nextRequestAt=0;
    for(const frame of frames) {
      options.signal?.throwIfAborted();
      await pause(nextRequestAt-Date.now(),options.signal);
      nextRequestAt=Date.now()+4000;
      let result:RecognitionResult;
      try {
        const data=await requestFrame({sessionId,petId,image:frame.image,imageHash:frame.imageHash,source:'upload',seq:frame.seq,capturedAt:frame.capturedAt},options.signal);
        result={...data,seq:frame.seq,capturedAt:frame.capturedAt};
      } catch(error) {
        if(options.signal?.aborted)throw error;
        const code=(error as {code?:string}).code;
        result={petId,sessionId,seq:frame.seq,capturedAt:frame.capturedAt,behavior:'unknown',confidence:null,hasPet:null,reasonCode:'unclear',source:'upload',timestamp:new Date().toISOString(),status:code==='RATE_LIMITED'?'rate_limited':code==='AI_TIMEOUT'?'timeout':'failed',model:null,provider:null,cached:false};
        await saveFrames([result]);
        initial.ingestRecognition(result);
        throw error;
      }
      await saveFrames([result]);
      initial.ingestRecognition(result);accepted++;
      initial.setProgress(accepted,frames.length);
    }
  } catch(error) {
    const cancelled=options.signal?.aborted;
    if(cancelled)initial.interruptAnalysis();
    initial.setError(cancelled?`已取消分析${accepted?'，已完成的结果已保存':''}。`:error instanceof Error?error.message:'视频分析失败，请重试。');
  } finally {
    initial.setBusy(false);
  }
}
