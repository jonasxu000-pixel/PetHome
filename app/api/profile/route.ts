import { readJsonLimited,sameOrigin,jsonError } from '@/lib/server/http';
import { PROFILE_COOKIE,profileKey,readProfile,writeProfile,validatePet } from '@/lib/server/profile-store';
import { verifiedAvatar } from '@/lib/server/avatar-proof';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {const key=profileKey(request.headers.get('cookie'));return Response.json({ok:true,data:key?await readProfile(key):null},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return jsonError(error);}
}
export async function PUT(request:Request) {
  if(!sameOrigin(request))return Response.json({ok:false,error:{code:'FORBIDDEN',message:'请求来源不被允许。',retriable:false}},{status:403});
  try {
    const pet=validatePet(await readJsonLimited(request,760000));
    if(!pet)throw Object.assign(new Error('档案内容无效，请检查名称、照片和分身外观。'),{status:400,code:'INVALID_PROFILE'});
    if(pet.avatar&&!await verifiedAvatar(pet.avatar))throw Object.assign(new Error('AI 分身的验证已失效，请重新生成或手动确认外观。'),{status:422,code:'UNVERIFIED_AVATAR'});
    const key=await writeProfile(pet,profileKey(request.headers.get('cookie')));
    const secure=request.headers.get('x-forwarded-proto')==='https'||new URL(request.url).protocol==='https:';
    return Response.json({ok:true,data:{saved:true}},{headers:{'Cache-Control':'no-store','Set-Cookie':`${PROFILE_COOKIE}=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7776000${secure?'; Secure':''}`}});
  } catch(error){return jsonError(error);}
}
