import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMachine, receiveResult, advanceMachine } from './machine.ts';
import type { RecognitionResult } from './types.ts';
const frame=(behavior:RecognitionResult['behavior'],status:RecognitionResult['status']='ok'):RecognitionResult=>({petId:'test',behavior,status,confidence:null,hasPet:true,reasonCode:'none',source:'upload',timestamp:'2026-11-07T01:00:00Z',model:'test-fixture',provider:'gemini'});
test('requires two matching results, then enforces minimum hold',()=>{
  let s=receiveResult(initialMachine(),frame('sleeping'),1000);
  assert.equal(s.reality.behavior,'unknown');
  s=receiveResult(s,frame('sleeping'),2000);assert.equal(s.reality.behavior,'sleeping');
  s=receiveResult(s,frame('walking'),3000);s=receiveResult(s,frame('walking'),4000);
  assert.equal(s.reality.behavior,'sleeping');assert.equal(advanceMachine(s,8000).reality.behavior,'walking');
});
test('failures cancel pending changes and never overwrite known behavior',()=>{
  let s=receiveResult(receiveResult(initialMachine(),frame('sleeping'),1000),frame('sleeping'),2000);
  s=receiveResult(receiveResult(s,frame('walking'),3000),frame('walking'),4000);
  s=receiveResult(s,frame('unknown','failed'),5000);
  assert.equal(advanceMachine(s,10000).reality.behavior,'sleeping');assert.equal(s.reality.syncStatus,'stale');
  assert.equal(advanceMachine(s,20001).reality.syncStatus,'offline');
});
test('unknown remains a valid business outcome and confidence stays null',()=>{
  const s=receiveResult(initialMachine(),frame('unknown'),1000);
  assert.equal(s.reality.syncStatus,'ok');assert.equal(s.reality.confidence,null);
});
test('deferred transition uses the confirmed candidate confidence',()=>{
  let s=receiveResult(receiveResult(initialMachine(),{...frame('sleeping'),confidence:0.95},1000),{...frame('sleeping'),confidence:0.95},2000);
  s=receiveResult(receiveResult(s,{...frame('walking'),confidence:0.8},3000),{...frame('walking'),confidence:0.8},4000);
  assert.equal(advanceMachine(s,8000).reality.confidence,0.8);
});
test('offline recovery immediately adopts a new valid result (TC-ST-06)',()=>{
  let s=receiveResult(receiveResult(initialMachine(),frame('sleeping'),1000),frame('sleeping'),2000);
  s=advanceMachine(s,18000);s=receiveResult(s,frame('walking'),19000);
  assert.equal(s.reality.behavior,'walking');assert.equal(s.reality.syncStatus,'ok');
});
test('unknown changes label but preserves last known animation (TC-ST-03)',()=>{
  let s=receiveResult(receiveResult(initialMachine(),frame('sleeping'),1000),frame('sleeping'),2000);
  s=receiveResult(s,frame('unknown'),3000);
  assert.equal(s.reality.behavior,'unknown');assert.equal(s.displayBehavior,'sleeping');
});
test('failure after offline cannot clear the immediate recovery rule',()=>{
  let s=receiveResult(receiveResult(initialMachine(),frame('sleeping'),1000),frame('sleeping'),2000);
  s=advanceMachine(s,18000);s=receiveResult(s,frame('unknown','timeout'),18500);
  assert.equal(s.reality.syncStatus,'offline');
  s=receiveResult(s,frame('walking'),19000);assert.equal(s.reality.behavior,'walking');
});
