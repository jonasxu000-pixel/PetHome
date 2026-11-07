export function sameOrigin(request:Request):boolean {
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try {
    const url=new URL(request.url),host=request.headers.get('host')||url.host;
    const protocol=request.headers.get('x-forwarded-proto')?.split(',')[0].trim()||url.protocol.slice(0,-1);
    return origin===new URL(`${protocol}://${host}`).origin;
  } catch{return false;}
}
export async function readJsonLimited(request:Request,maxBytes:number):Promise<unknown> {
  const reader=request.body?.getReader();
  if(!reader)throw Object.assign(new Error('请求内容为空。'),{status:400,code:'INVALID_REQUEST'});
  const chunks:Uint8Array[]=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw Object.assign(new Error('内容过大，请压缩图片后重试。'),{status:413,code:'PAYLOAD_TOO_LARGE'});}chunks.push(value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('请求格式无效。'),{status:400,code:'INVALID_REQUEST'});}
}
export function jsonError(error:unknown) {
  const e=error as {code?:string;status?:number;http?:number;message?:string};
  const status=e.http??e.status??500;
  return Response.json({ok:false,error:{code:e.code??'STORAGE_UNAVAILABLE',message:e.code?e.message:'保存服务暂不可用，请重试。',retriable:status>=500&&e.code!=='AI_NOT_CONFIGURED'}},{status,headers:{'Cache-Control':'no-store'}});
}
