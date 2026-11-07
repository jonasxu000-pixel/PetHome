import { describeAvatar } from '@/lib/avatar/vision';
import { readJsonLimited,sameOrigin,jsonError } from '@/lib/server/http';
import { signAvatar } from '@/lib/server/avatar-proof';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const quota=new Map<string,{time:number;count:number}>();
export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({ok:false,error:{code:'FORBIDDEN',message:'请求来源不被允许。',retriable:false}},{status:403});
  try {
    const body=await readJsonLimited(request,750000) as {image?:unknown;petType?:unknown};
    if(!body||!['cat','dog'].includes(String(body.petType)))throw Object.assign(new Error('当前分身支持猫和狗，请先选择类型。'),{status:400,code:'INVALID_TYPE'});
    if(typeof body.image!=='string'||body.image.length>700000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image))throw Object.assign(new Error('请选择压缩后的有效 JPEG 照片。'),{status:400,code:'INVALID_IMAGE'});
    const bytes=Buffer.from(body.image.split(',')[1],'base64');
    if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Object.assign(new Error('照片格式损坏，请重新上传。'),{status:400,code:'INVALID_IMAGE'});
    const now=Date.now(),key=request.headers.get('x-forwarded-for')?.split(',')[0]??'local',current=quota.get(key);
    if(current&&now-current.time<60000&&current.count>=6)throw Object.assign(new Error('创建过于频繁，请稍后重试。'),{status:429,code:'RATE_LIMITED'});
    quota.set(key,!current||now-current.time>=60000?{time:now,count:1}:{...current,count:current.count+1});
    if(quota.size>1024)for(const [id,value] of quota)if(now-value.time>=60000)quota.delete(id);
    const avatar=await signAvatar(await describeAvatar(body.image,request.signal));
    return Response.json({ok:true,data:avatar},{headers:{'Cache-Control':'no-store'}});
  } catch(error){return jsonError(error);}
}
