import test from 'node:test';
import assert from 'node:assert/strict';
import { usePetStore } from './store.ts';
import type { RecognitionResult } from './types.ts';
const frame:RecognitionResult={petId:'test',sessionId:'fixture',source:'upload',behavior:'sleeping',confidence:null,hasPet:true,reasonCode:'none',timestamp:new Date().toISOString(),status:'ok',provider:'gemini',model:'test-fixture'};
test('sleeping touch is clamped and never rewrites reality',()=>{
  const store=usePetStore.getState();store.beginAnalysis();store.ingestRecognition(frame);store.ingestRecognition(frame);
  const before={...usePetStore.getState().realityState};
  for(let i=0;i<10;i++)store.setOverlay({kind:'tap_head',level:3,startedAt:Date.now(),expiresAt:Date.now()+1500,message:'test-fixture'});
  assert.deepEqual(usePetStore.getState().realityState,before);
  assert.equal(usePetStore.getState().overlay?.level,1);
});
test('cancel resets pending transition and marks displayed result stale',()=>{
  usePetStore.getState().interruptAnalysis();
  assert.equal(usePetStore.getState().machine.pending,null);
  assert.equal(usePetStore.getState().realityState.syncStatus,'stale');
  assert.equal(usePetStore.getState().overlay,null);
});
test('new analysis failure retains the last known behavior (TC-ST-04)',()=>{
  const store=usePetStore.getState();store.beginAnalysis();store.ingestRecognition(frame);store.ingestRecognition(frame);
  store.beginAnalysis();store.ingestRecognition({...frame,behavior:'unknown',status:'failed'});
  assert.equal(usePetStore.getState().realityState.behavior,'sleeping');
  // An already offline result must stay offline across a failure, so recovery
  // still accepts its first valid result. The error status marks it non-current.
  assert.equal(usePetStore.getState().realityState.syncStatus,'offline');
  assert.equal(usePetStore.getState().realityState.status,'failed');
});
