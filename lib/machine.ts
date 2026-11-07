import type { Behavior, RealityState, RecognitionResult } from './types.ts';
export interface MachineState {
  reality: RealityState;
  pending: Behavior | null;
  matches: number;
  changedAt: number;
  receivedAt: number;
  misses: number;
  candidate: RecognitionResult | null;
  displayBehavior: Behavior;
}
export function initialMachine(): MachineState {
  return { reality: { behavior:'unknown', confidence:null, source:null, timestamp:null, syncStatus:'idle', status:null, reasonCode:'none' }, pending:null, matches:0, changedAt:0, receivedAt:0, misses:0, candidate:null, displayBehavior:'unknown' };
}
export function receiveResult(state: MachineState, result: RecognitionResult, now: number): MachineState {
  if (result.status !== 'ok' && result.status !== 'low_confidence') {
    return { ...state, pending:null, matches:0, candidate:null, misses:state.misses+1,
      reality: { ...state.reality, status:result.status, syncStatus:state.reality.syncStatus==='offline'||state.misses >= 2 ? 'offline' : 'stale' } };
  }
  const recovering=state.reality.syncStatus==='offline'||(state.receivedAt>0&&now-state.receivedAt>15000);
  const previous=state.reality;
  const changedAt=recovering?0:state.changedAt;
  const matches = state.pending === result.behavior ? state.matches + 1 : 1;
  const canChange = recovering || result.behavior === 'unknown' || (matches >= 2 && (changedAt === 0 || now - changedAt >= 6000));
  return { ...state, pending:result.behavior, candidate:result, matches, misses:0, receivedAt:now,
    displayBehavior:canChange&&result.behavior!=='unknown'?result.behavior:state.displayBehavior,
    changedAt:canChange && result.behavior !== previous.behavior ? now : changedAt,
    reality: { behavior:canChange ? result.behavior : previous.behavior,
      confidence:canChange || result.behavior === previous.behavior ? result.confidence : previous.confidence,
      source:result.source, timestamp:result.timestamp, status:result.status, reasonCode:result.reasonCode, syncStatus:'ok' } };
}
export function advanceMachine(state: MachineState, now: number): MachineState {
  if (state.receivedAt && now - state.receivedAt > 15000) {
    if(state.reality.syncStatus==='offline'&&state.pending===null)return state;
    return { ...state, pending:null, matches:0, candidate:null, reality:{ ...state.reality, syncStatus:'offline' } };
  }
  if (state.matches >= 2 && state.pending && state.pending !== state.reality.behavior && now - state.changedAt >= 6000 && state.reality.syncStatus === 'ok') {
    return { ...state, changedAt:now, displayBehavior:state.pending==='unknown'?state.displayBehavior:state.pending, reality:{...state.reality,behavior:state.pending,confidence:state.candidate?.confidence??null} };
  }
  return state;
}
