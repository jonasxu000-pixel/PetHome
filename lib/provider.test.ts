import test from 'node:test';
import assert from 'node:assert/strict';
import { parseObservation, ProviderError } from './ai/provider.ts';
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
