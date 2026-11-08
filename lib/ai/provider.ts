import { RECOGNITION_PROMPT } from '../prompt.ts';
import type { Behavior, ReasonCode } from '../types';
import { takeVisionSlot } from '../server/vision-limits.ts';
import { modelJsonText } from './json.ts';
export class ProviderError extends Error {
  code:string;
  http:number;
  constructor(code:string, message:string, http:number=503) { super(message);this.code=code;this.http=http; }
}
export interface ModelObservation { behavior:Behavior;confidence:number|null;hasPet:boolean|null;reasonCode:ReasonCode }
export function parseObservation(raw:string):ModelObservation {
  const text=modelJsonText(raw);
  let obj:unknown;
  try { obj=JSON.parse(text); } catch { throw new ProviderError('AI_BAD_RESPONSE','模型返回格式不符合要求，请重试。',502); }
  if(!obj || typeof obj!=='object' || Array.isArray(obj)) throw new ProviderError('AI_BAD_RESPONSE','模型返回格式不符合要求。',502);
  const o=obj as Record<string,unknown>;
  const behavior=o.behavior;
  const confidence=o.confidence===undefined?null:o.confidence;
  const hasPet=o.hasPet??o.has_pet??null;
  let reasonCode=o.reasonCode??o.reason_code;
  if(!['sleeping','walking','eating','playing','unknown'].includes(behavior as string) ||
    (confidence!==null&&(typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1)) ||
    (hasPet!==null&&typeof hasPet!=='boolean') || !['none','no_pet','too_blurry','multi_pet','unclear'].includes(reasonCode as string)) {
    throw new ProviderError('AI_BAD_RESPONSE','模型返回了无效字段，请重试。',502);
  }
  let normalized=behavior as Behavior;
  if(hasPet===false || reasonCode==='no_pet'||reasonCode==='too_blurry'||reasonCode==='multi_pet' || (typeof confidence==='number'&&confidence<0.5)) normalized='unknown';
  if(normalized==='unknown'&&reasonCode==='none') reasonCode='unclear';
  if(normalized!=='unknown') reasonCode='none';
  return {behavior:normalized,confidence:normalized==='unknown'?null:confidence as number|null,hasPet:hasPet as boolean|null,reasonCode:reasonCode as ReasonCode};
}
export function providerConfig() {
  const selected:'gemini'|'zhipu'=process.env.AI_PROVIDER==='gemini'?'gemini':'zhipu';
  const available={gemini:!!process.env.GEMINI_API_KEY,zhipu:!!process.env.ZHIPU_API_KEY};
  return {selected,available};
}
export async function runVision<T>(image:string,prompt:string,parse:(raw:string)=>T,signal?:AbortSignal,options?:{timeoutMs?:number;maxOutputTokens?:number}):Promise<T&{model:string;provider:'gemini'|'zhipu';latencyMs:number}> {
  const {selected,available}=providerConfig();
  // The default free-model route must never silently switch to a paid provider.
  // Gemini is used only when the user explicitly selects it.
  const candidates:{provider:'gemini'|'zhipu';model:string;timeout:number;thinking:boolean}[]=selected==='gemini'
    ?[{provider:'gemini',model:'gemini-3.7-flash',timeout:8000,thinking:false},{provider:'zhipu',model:'glm-4.6v-flash',timeout:8000,thinking:false}]
    :[{provider:'zhipu',model:'glm-4.6v-flash',timeout:8000,thinking:false},{provider:'zhipu',model:'glm-4.1v-thinking-flash',timeout:10000,thinking:true}];
  let last:unknown;
  for(const {provider,model,timeout:timeoutMs,thinking} of candidates) {
    if(!available[provider]) continue;
    signal?.throwIfAborted();
    const started=Date.now();
    try {
      if(!takeVisionSlot())throw new ProviderError('RATE_LIMITED','本分钟的识别次数已用完，请稍后重试。',429);
      const timeout=AbortSignal.timeout(options?.timeoutMs??timeoutMs);
      const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
      const response=provider==='gemini' ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY!},signal:requestSignal,
        body:JSON.stringify({contents:[{parts:[{text:prompt},{inlineData:{mimeType:'image/jpeg',data:image.split(',')[1]}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:options?.maxOutputTokens??512}})
      }) : await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ZHIPU_API_KEY!}`},signal:requestSignal,
        body:JSON.stringify({model,...(thinking?{}:{thinking:{type:'disabled'}}),temperature:0,max_tokens:thinking?4096:(options?.maxOutputTokens??512),messages:[{role:'user',content:[{type:'image_url',image_url:{url:image}},{type:'text',text:prompt}]}]})
      });
      if(!response.ok) throw new ProviderError(response.status===429?'RATE_LIMITED':'AI_UNAVAILABLE',response.status===429?'免费模型当前繁忙，请稍后重试。':'模型服务暂不可用，请检查配置后重试。',response.status===429?429:503);
      const body=await response.json();
      const raw=provider==='gemini'?body.candidates?.[0]?.content?.parts?.filter((p:{text?:string;thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text??'').join(''):body.choices?.[0]?.message?.content;
      if(typeof raw!=='string') throw new ProviderError('AI_BAD_RESPONSE','模型没有返回可解析结果。',502);
      return {...parse(raw),model,provider,latencyMs:Date.now()-started};
    } catch(error) {
      if(signal?.aborted) throw error;
      if(error instanceof ProviderError&&error.http===422)throw error;
      last=error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?new ProviderError('AI_TIMEOUT','模型识别超时，请重试。',504):error;
    }
  }
  if(!candidates.some(({provider})=>available[provider])) throw new ProviderError('AI_NOT_CONFIGURED','尚未配置所选模型服务，请先配置服务端 API 密钥。',503);
  throw last instanceof ProviderError?last:new ProviderError('AI_UNAVAILABLE','无法连接模型服务，请稍后重试。');
}
export async function recognizeImage(image:string,signal?:AbortSignal) {
  return runVision(image,RECOGNITION_PROMPT,parseObservation,signal);
}
