import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFrames,toShanghaiDayKey } from './db/merge.ts';
import type { RecognitionResult } from './types.ts';
const frame=(seq:number,behavior:RecognitionResult['behavior']='sleeping',status:RecognitionResult['status']='ok',source:RecognitionResult['source']='upload'):RecognitionResult=>({petId:'test-pet',sessionId:source==='preset'?null:'test-session',seq,capturedAt:new Date(Date.parse('2026-11-06T17:30:00Z')+seq*4000).toISOString(),timestamp:'2026-11-07T01:00:00Z',behavior,status,confidence:null,hasPet:null,source,reasonCode:'none',model:source==='preset'?null:'test-fixture',provider:source==='preset'?null:'gemini'});
test('merges sampled sequence using media time, preserving null confidence',()=>{
  const merged=mergeFrames([frame(2),frame(0),frame(1)]);
  assert.equal(merged.length,1);assert.equal(merged[0].durationSec,8);assert.equal(merged[0].avgConfidence,null);assert.equal(merged[0].dayKey,'2026-11-07');
});
test('interruption splits behavior intervals and never becomes a behavior',()=>{
  const merged=mergeFrames([frame(0),frame(1,'unknown','failed'),frame(2,'unknown','timeout'),frame(3)]);
  assert.deepEqual(merged.map(x=>x.eventType),['behavior','interrupted','behavior']);
  assert.equal(merged[1].behavior,null);assert.equal(merged[1].avgConfidence,null);
});
test('unknown is recorded normally, with isolated preset source',()=>{
  const merged=mergeFrames([frame(0,'unknown'),frame(0,'sleeping','ok','preset')]);
  assert.equal(merged.length,2);assert.equal(merged.filter(x=>x.source==='preset').length,1);
  assert.equal(merged.find(x=>x.source==='upload')?.behavior,'unknown');
});
test('Shanghai day boundary and repeated merge IDs remain stable',()=>{
  assert.equal(toShanghaiDayKey('2026-11-06T16:00:00Z'),'2026-11-07');
  assert.equal(mergeFrames([frame(0)])[0].id,mergeFrames([frame(0)])[0].id);
});
