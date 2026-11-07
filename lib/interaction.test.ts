import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackOverlay } from './interaction/feedback.ts';
import { takeVisionSlot } from './server/vision-limits.ts';
test('all four body interactions stay mild during real sleeping',()=>{
  const kinds=['tap_head','tap_nose','stroke','tap_tail'] as const;
  for(const kind of kinds){const feedback=createFeedbackOverlay(kind,'sleeping',1000);assert.equal(feedback.kind,kind);assert.ok(feedback.level<=1);assert.ok(feedback.expiresAt-feedback.startedAt<=800);}
  assert.equal(new Set(kinds.map(kind=>createFeedbackOverlay(kind,'unknown',1000).message)).size,4);
});
test('process-wide vision ceiling does not depend on request headers',()=>{
  const start=10_000_000;
  for(let i=0;i<30;i++)assert.equal(takeVisionSlot(start),true);
  assert.equal(takeVisionSlot(start),false);assert.equal(takeVisionSlot(start+60001),true);
});
