import { providerConfig } from '@/lib/ai/provider';
export const dynamic='force-dynamic';
export async function GET() {
  const {selected,available}=providerConfig();
  return Response.json({ok:true,data:{service:'PetHome',configured:available.gemini||available.zhipu,provider:selected,available,storage:'indexeddb',timestamp:new Date().toISOString()}},{headers:{'Cache-Control':'no-store'}});
}
