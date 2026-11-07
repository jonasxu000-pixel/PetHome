'use client';
import { create } from 'zustand';
import type { InteractionOverlay, Pet, RecognitionResult, BehaviorInterval, RealityState } from './types';
import { initialMachine, receiveResult, advanceMachine, type MachineState } from './machine.ts';
interface PetStore {
  pet: Pet | null;
  hydrated: boolean;
  realityState: RealityState;
  machine: MachineState;
  overlay: InteractionOverlay | null;
  busy: boolean;
  progress: { current:number; total:number };
  error: string | null;
  videoName: string | null;
  setPet: (pet:Pet | null) => void;
  restore: (pet:Pet | null, latest?:BehaviorInterval | null) => void;
  setOverlay: (overlay:InteractionOverlay | null) => void;
  ingestRecognition: (result:RecognitionResult) => void;
  tick: () => void;
  setBusy: (busy:boolean) => void;
  setProgress: (current:number,total:number) => void;
  setError: (error:string | null) => void;
  setVideoName: (name:string | null) => void;
  beginAnalysis: () => void;
  interruptAnalysis: () => void;
  getDisplayAnimation: () => string;
}
export const usePetStore = create<PetStore>((set,get) => ({
  pet:null, hydrated:false, machine:initialMachine(), realityState:initialMachine().reality,
  overlay:null,busy:false,progress:{current:0,total:0},error:null,videoName:null,
  setPet:pet=>set({pet}),
  restore:(pet,latest)=> {
    const machine=initialMachine();
    if(latest) machine.reality={...machine.reality,behavior:latest.behavior??'unknown',confidence:latest.avgConfidence,source:latest.source,timestamp:latest.createdAt,syncStatus:'offline',status:latest.eventType==='interrupted'?'failed':'ok'};
    if(latest)machine.displayBehavior=latest.behavior??'unknown';
    set({pet,hydrated:true,machine,realityState:machine.reality});
  },
  setOverlay:overlay=> {
    const {realityState,overlay:current}=get();
    if(overlay && current && current.expiresAt > Date.now()) return;
    set({overlay:overlay && realityState.behavior==='sleeping' ? {...overlay,level:Math.min(1,overlay.level) as 0|1,expiresAt:Math.min(overlay.expiresAt,Date.now()+800)} : overlay});
  },
  ingestRecognition:result=> {
    const machine=receiveResult(get().machine,result,Date.now());
    set({machine,realityState:machine.reality});
  },
  tick:()=> {
    const now=Date.now(), machine=advanceMachine(get().machine,now),overlay=get().overlay;
    if(machine!==get().machine || (overlay && now>=overlay.expiresAt)) set({machine,realityState:machine.reality,overlay:overlay && now<overlay.expiresAt?overlay:null});
  },
  setBusy:busy=>set({busy}), setProgress:(current,total)=>set({progress:{current,total}}),
  setError:error=>set({error}),setVideoName:videoName=>set({videoName}),
  beginAnalysis:()=>{const previous=get(),machine=initialMachine();if(previous.realityState.timestamp){machine.reality={...previous.realityState,syncStatus:'offline'};machine.displayBehavior=previous.machine.displayBehavior;}set({machine,realityState:machine.reality,overlay:null});},
  interruptAnalysis:()=>{const machine={...get().machine,pending:null,matches:0,candidate:null,reality:{...get().realityState,syncStatus:'stale' as const,status:'failed' as const}};set({machine,realityState:machine.reality,overlay:null});},
  getDisplayAnimation:()=>{const {realityState:r,overlay,machine}=get();return r.syncStatus==='offline'?'idle_static':overlay&&overlay.level>0?r.behavior==='sleeping'?'sleeping_twitch':overlay.kind:machine.displayBehavior==='unknown'?'idle':machine.displayBehavior;}
}));
