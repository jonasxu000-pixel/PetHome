import test from 'node:test';
import assert from 'node:assert/strict';
import { parseObservation, ProviderError,runVision } from './ai/provider.ts';
test('missing confidence stays null, not zero',()=>{
  assert.equal(parseObservation('{"behavior":"sleeping","hasPet":true,"reasonCode":"none"}').confidence,null);
});
test('no pet and insufficient evidence become unknown',()=>{
  assert.equal(parseObservation('{"behavior":"sleeping","confidence":0.99,"hasPet":false,"reasonCode":"no_pet"}').behavior,'unknown');
  assert.equal(parseObservation('{"behavior":"walking","confidence":0.4,"hasPet":true,"reasonCode":"none"}').behavior,'unknown');
});
test('invalid enums and string confidence fail rather than masquerading as valid inference',()=>{
  assert.throws(()=>parseObservation('{"behavior":"happy","confidence":0.9,"hasPet":true,"reasonCode":"none"}'),ProviderError);
  assert.throws(()=>parseObservation('{"behavior":"sleeping","confidence":"0.9","hasPet":true,"reasonCode":"none"}'),ProviderError);
  assert.throws(()=>parseObservation('maybe sleeping'),ProviderError);
});
test('whole fenced JSON and provider snake case are parsed, without extracting guesses',()=>{
  const parsed=parseObservation('```json\n{"behavior":"unknown","confidence":null,"has_pet":false,"reason_code":"no_pet"}\n```');
  assert.equal(parsed.reasonCode,'no_pet');assert.equal(parsed.hasPet,false);
});
test('free model route never silently invokes Gemini as fallback',async()=>{
  const previous={provider:process.env.AI_PROVIDER,zhipu:process.env.ZHIPU_API_KEY,gemini:process.env.GEMINI_API_KEY,fetch:globalThis.fetch};
  process.env.AI_PROVIDER='zhipu';process.env.ZHIPU_API_KEY='fixture-only';process.env.GEMINI_API_KEY='fixture-only';
  const urls:string[]=[];
  globalThis.fetch=async(input)=>{urls.push(String(input));return new Response(null,{status:503});};
  try {await assert.rejects(()=>runVision('data:image/jpeg;base64,abcd','test',()=>({})),ProviderError);assert.equal(urls.length,1);assert.ok(urls[0].startsWith('https://open.bigmodel.cn/'));}
  finally {globalThis.fetch=previous.fetch;for(const [name,value]of [['AI_PROVIDER',previous.provider],['ZHIPU_API_KEY',previous.zhipu],['GEMINI_API_KEY',previous.gemini]])if(value===undefined)delete process.env[name!];else process.env[name!]=value;}
});
