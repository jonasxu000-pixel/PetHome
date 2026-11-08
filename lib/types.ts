export type Behavior = 'sleeping' | 'walking' | 'eating' | 'playing' | 'unknown';
export type DataSource = 'upload' | 'camera' | 'preset';
export type RecognitionStatus = 'ok' | 'low_confidence' | 'failed' | 'timeout' | 'rate_limited';
export type ReasonCode = 'none' | 'no_pet' | 'too_blurry' | 'multi_pet' | 'unclear';
export type Personality = 'lively' | 'clingy' | 'aloof';
export type PetType = 'cat' | 'dog' | 'other';
export interface PetVisualTraits {
  coatLength: 'short' | 'long' | 'unknown';
  bodyShape: 'slim' | 'average' | 'round' | 'unknown';
  facePattern: 'solid' | 'bicolor' | 'tabby' | 'calico' | 'spotted' | 'unknown';
  earShape: 'floppy' | 'pointed' | 'folded' | 'unknown';
  unknownFields: string[];
}
export interface AvatarProfile {
  version: 1;
  species: 'cat' | 'dog';
  coatColor: string;
  patchColor: string;
  muzzleColor: string;
  eyeColor: string;
  collarColor: string;
  earShape: 'floppy' | 'pointed';
  pattern: 'solid' | 'tuxedo' | 'spotted';
  origin: 'starter' | 'photo_palette' | 'ai_vision' | 'manual';
  generatedAt: string;
  model?: string | null;
  verification?: string;
  modelPresetId?: string;
  traits?: PetVisualTraits;
}
export interface RecognitionResult {
  petId: string;
  sessionId?: string | null;
  behavior: Behavior;
  confidence: number | null;
  hasPet: boolean | null;
  reasonCode: ReasonCode;
  source: DataSource;
  timestamp: string;
  status: RecognitionStatus;
  model: string | null;
  provider: 'gemini' | 'zhipu' | null;
  latencyMs?: number;
  cached?: boolean;
  seq?: number;
  capturedAt?: string;
}
export interface RecognizeRequest {
  sessionId: string;
  petId: string;
  image: string;
  imageHash: string;
  source: DataSource;
  seq?: number;
  capturedAt?: string;
}
export interface Pet {
  id: string;
  ownerDeviceId: string;
  name: string;
  type: PetType;
  personality: Personality;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  avatar?: AvatarProfile;
}
export interface BehaviorInterval {
  id: string;
  petId: string;
  sessionId: string | null;
  eventType: 'behavior' | 'interrupted';
  behavior: Behavior | null;
  startAt: string;
  endAt: string;
  durationSec: number;
  source: DataSource;
  avgConfidence: number | null;
  sampleCount: number;
  dayKey: string;
  createdAt: string;
}
export type InteractionKind = 'tap_head' | 'tap_nose' | 'stroke' | 'tap_tail';
export interface InteractionOverlay {
  kind: InteractionKind;
  level: 0 | 1 | 2 | 3;
  startedAt: number;
  expiresAt: number;
  message: string;
}
export interface RealityState {
  behavior: Behavior;
  confidence: number | null;
  source: DataSource | null;
  timestamp: string | null;
  syncStatus: 'idle' | 'ok' | 'stale' | 'offline';
  status: RecognitionStatus | null;
  reasonCode: ReasonCode;
}
export interface CaptureFrame {
  image: string;
  imageHash: string;
  seq: number;
  capturedAt: string;
  offsetSec: number;
}
export interface ApiError { code: string; message: string; retriable: boolean; retryAfterSec?: number }
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };
