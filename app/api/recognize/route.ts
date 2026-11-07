import { createHash } from 'node:crypto';
import { ProviderError, recognizeImage, providerConfig } from '@/lib/ai/provider';
import type { RecognizeRequest, RecognitionResult } from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const cache=new Map<string,{expires:number;observation:Awaited<ReturnType<typeof recognizeImage>>}>();
const requests=new Map<string,{start:number;count:number}>();
function fail(code:string,message:string,status:number,retriable=false) { return Response.json({ok:false,error:{code,message,retriable}},{status,headers:{'Cache-Control':'no-store'}}); }
async function readLimited(request:Request) {
  const reader=request.body?.getReader();
  if(!reader) throw new ProviderError('INVALID_IMAGE','请选择有效画面。',400);
  const chunks:Uint8Array[]=[];let bytes=0;
  for(;;) { const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>560000){await reader.cancel();throw new ProviderError('IMAGE_TOO_LARGE','画面过大，请压缩后重试。',413);} chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as RecognizeRequest;
}
export async function POST(request:Request) {
  try {
    const origin=request.headers.get('origin');
    const requestUrl=new URL(request.url);
    const host=request.headers.get('host')||requestUrl.host;
    const protocol=request.headers.get('x-forwarded-proto')?.split(',')[0].trim()||requestUrl.protocol.slice(0,-1);
    if(origin&&origin!==new URL(`${protocol}://${host}`).origin) return fail('FORBIDDEN','请求来源不被允许。',403);
    const input=await readLimited(request);
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if(!input||!uuid.test(input.petId)||!uuid.test(input.sessionId)) return fail('INVALID_UUID','宠物或会话标识无效。',400);
    if(input.source!=='upload'&&input.source!=='camera') return fail('INVALID_SOURCE','预设数据不能经过真实识别接口。',400);
    if(typeof input.imageHash!=='string'||input.imageHash.length<1||input.imageHash.length>128 || (input.seq!==undefined&&(!Number.isSafeInteger(input.seq)||input.seq<0||input.seq>10000)) || (input.capturedAt!==undefined&&!Number.isFinite(Date.parse(input.capturedAt)))) return fail('INVALID_REQUEST','画面信息无效。',400);
    if(typeof input.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.image)) return fail('INVALID_IMAGE','请选择 JPEG 格式的有效画面。',400);
    if(input.image.length>400*1024) return fail('IMAGE_TOO_LARGE','画面不能超过 400KB。',413);
    const bytes=Buffer.from(input.image.split(',')[1],'base64');
    if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217) return fail('INVALID_IMAGE','画面文件损坏或格式无效。',400);
    const now=Date.now();
    const identity=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
    const quota=requests.get(identity);
    if(quota&&now-quota.start<60000&&quota.count>=30) return fail('RATE_LIMITED','请求过于频繁，请一分钟后重试。',429,true);
    requests.set(identity,!quota||now-quota.start>=60000?{start:now,count:1}:{start:quota.start,count:quota.count+1});
    if(requests.size>2048) {for(const [key,value] of requests) if(now-value.start>60000) requests.delete(key);}
    const key=providerConfig().selected+':'+createHash('sha256').update(bytes).digest('hex');
    const hit=cache.get(key);
    const cached=!!hit&&hit.expires>now;
    const observation=cached?hit!.observation:await recognizeImage(input.image,request.signal);
    if(!cached) {if(cache.size>=128) cache.delete(cache.keys().next().value!); cache.set(key,{observation,expires:now+600000});}
    const result:RecognitionResult={...observation,petId:input.petId,sessionId:input.sessionId,seq:input.seq,capturedAt:input.capturedAt,source:input.source,timestamp:new Date().toISOString(),status:observation.behavior!=='unknown'&&observation.confidence!==null&&observation.confidence<0.75?'low_confidence':'ok',cached,latencyMs:cached?0:observation.latencyMs};
    return Response.json({ok:true,data:result},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    if(error instanceof ProviderError) return fail(error.code,error.message,error.http,[429,502,503,504].includes(error.http)&&error.code!=='AI_NOT_CONFIGURED');
    if(error instanceof SyntaxError) return fail('INVALID_REQUEST','请求不是有效 JSON。',400);
    return fail('AI_UNAVAILABLE','识别请求未完成，请稍后重试。',503,true);
  }
}
