import { providerConfig } from '@/lib/ai/provider';
export const dynamic='force-dynamic';
export async function GET() {
  const {selected,available}=providerConfig();
  return Response.json({ok:true,data:{service:'PetHome',configured:available[selected]||(selected==='gemini'&&available.zhipu),provider:selected,available,storage:'indexeddb+private-server-profile',timestamp:new Date().toISOString()}},{headers:{'Cache-Control':'no-store'}});
}
