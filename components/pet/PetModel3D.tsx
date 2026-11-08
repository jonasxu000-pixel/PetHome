'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { defaultAvatar } from '@/lib/avatar/profile';
import { getPetModel } from '@/lib/pet3d/catalog';
import { applyPetAppearance } from '@/lib/pet3d/appearance';
import type { AvatarProfile, Behavior, InteractionKind, InteractionOverlay, PetType } from '@/lib/types';
import type { PetRegion } from '@/lib/interaction/regions';

interface Props {
  avatar?: AvatarProfile;
  fallbackType?: PetType;
  behavior?: Behavior;
  displayAnimation?: string;
  overlay?: InteractionOverlay | null;
  interactive?: boolean;
  nightMode?: boolean;
  onPartPointerDown?: (part: PetRegion, event: React.PointerEvent<Element>) => void;
  onInteract?: (kind: InteractionKind) => void;
}

// Runtime-only light retune for the night lamp mood: colors/intensities change,
// nothing about the loaded GLB, mixer or bone pose is touched or reloaded.
function applyNightLighting(lights: { hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; fill: THREE.DirectionalLight; renderer: THREE.WebGLRenderer }, night: boolean) {
  lights.hemi.color.setHex(night ? 0x8893c2 : 0xffffff);
  lights.hemi.groundColor.setHex(night ? 0x14172a : 0xb19c84);
  lights.hemi.intensity = night ? 0.55 : 2;
  lights.key.color.setHex(night ? 0xffb37a : 0xfff5eb);
  lights.key.intensity = night ? 1.1 : 2.8;
  lights.fill.color.setHex(night ? 0x2a3350 : 0xe3edff);
  lights.fill.intensity = night ? 0.16 : 0.7;
  lights.renderer.toneMappingExposure = night ? 0.74 : 1;
}

function disposeObject(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(mat);
  });
  for (const mat of materials) for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export function PetModel3D({ avatar, fallbackType = 'cat', behavior = 'unknown', displayAnimation, overlay = null, interactive = false, nightMode = false, onPartPointerDown, onInteract }: Props) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ behavior, displayAnimation, overlay });
  latest.current = { behavior, displayAnimation, overlay };
  const nightRef = useRef(nightMode);
  nightRef.current = nightMode;
  const preset = getPetModel(avatar, fallbackType);
  const appearance = avatar ?? defaultAvatar(fallbackType);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [animation, setAnimation] = useState('loading');
  const [loaded, setLoaded] = useState<THREE.Object3D | null>(null);
  const engine = useRef<{ renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; turn: THREE.Group; pickables: THREE.Object3D[]; hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; fill: THREE.DirectionalLight } | null>(null);
  const targetYaw = useRef(.15);

  useEffect(() => {
    const node = canvas.current, wrapper = host.current;
    if (!node || !wrapper || !preset) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: node, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true }); }
    catch { setStatus('error'); setError('当前浏览器无法启动 3D，请启用硬件加速或换用浏览器。'); return; }
    setStatus('loading'); setLoaded(null); setError(''); setAnimation('loading');
    let active = true, ready = false, frame = 0, previous = 0, currentAction: THREE.AnimationAction | undefined;
    let mixer: THREE.AnimationMixer | undefined, model: THREE.Object3D | undefined;
    const actions: Record<string, THREE.AnimationAction> = {};
    const scene = new THREE.Scene();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(32, 1, .01, 40);
    camera.position.set(0, 1.05, 4.8); camera.lookAt(0, 1.05, 0);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb19c84, 2); scene.add(hemi);
    const light = new THREE.DirectionalLight(0xfff5eb, 2.8);
    light.position.set(2.5, 4, 5); light.castShadow = true;
    light.shadow.mapSize.set(512, 512); light.shadow.camera.left = -2; light.shadow.camera.right = 2;
    light.shadow.camera.top = 3; light.shadow.camera.bottom = -1; light.shadow.normalBias = .03;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xe3edff, .7); fill.position.set(-3, 2, -2); scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .18 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.012; floor.receiveShadow = true; scene.add(floor);
    const turn = new THREE.Group(); scene.add(turn);
    const pickables: THREE.Object3D[] = [];
    engine.current = { renderer, camera, turn, pickables, hemi, key: light, fill };
    applyNightLighting(engine.current, nightRef.current);
    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix();
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(wrapper);
    let inView = true;
    const visibility = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; }); visibility.observe(wrapper);
    const bones: Record<string, THREE.Bone> = {}, restoreBones = new Map<THREE.Bone, THREE.Quaternion>();
    let lastClip = '__unset__', lastOverlay = 0, audited = false;
    const timer = window.setTimeout(() => {
      if (active && !ready) { setStatus('error'); setError('3D 模型加载超时，请重试。'); }
    }, 15000);
    new GLTFLoader().load(preset.src, gltf => {
      if (!active) { disposeObject(gltf.scene); return; }
      window.clearTimeout(timer); model = gltf.scene;
      if (preset.rotation) model.rotation.set(...preset.rotation);
      model.traverse(object => {
        if ((object as THREE.Bone).isBone) bones[object.name] = object as THREE.Bone;
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        // GLB ships both LODs as ordinary meshes; displaying both causes z fighting.
        if (/lod1/i.test(mesh.name)) { mesh.visible = false; return; }
        mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
        pickables.push(mesh);
      });
      // SkinnedMesh bounds before the first render need up-to-date bone matrices.
      // Otherwise the bind pose gives a wrong size and the head gets cropped.
      model.updateMatrixWorld(true);
      model.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) (object as THREE.SkinnedMesh).skeleton.update(); });
      const box = new THREE.Box3().setFromObject(model, true), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) { setStatus('error'); setError('模型尺寸无效，无法显示。'); return; }
      model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
      const normalized = new THREE.Group(); normalized.scale.setScalar(2 / size.y); normalized.add(model); turn.add(normalized);
      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
      node.dataset.clips = gltf.animations.map(clip => clip.name).join(',');
      node.dataset.meshCount = String(pickables.length);
      ready = true; setLoaded(model); setStatus('ready');
    }, undefined, () => {
      window.clearTimeout(timer);
      if (active) { setStatus('error'); setError('3D 模型未能加载，请检查连接后重试。'); }
    });
    function render(now: number) {
      frame = requestAnimationFrame(render);
      if (now - previous < 1000 / 30 || !inView || document.hidden) return;
      const delta = previous ? Math.min((now - previous) / 1000, .06) : 0; previous = now;
      if (ready && mixer) {
        for (const [bone, quaternion] of restoreBones) bone.quaternion.copy(quaternion);
        restoreBones.clear();
        const state = latest.current;
        const pose = state.displayAnimation ?? state.behavior;
        const sleeping = pose === 'sleeping' || pose === 'sleeping_twitch';
        const touching = state.overlay && state.overlay.expiresAt > Date.now();
        const eatingClip = actions.eat ? 'eat' : preset!.animations.interact;
        const playingClip = actions.jump ? 'jump' : preset!.animations.interact;
        const configured = sleeping ? preset!.animations.sleep
          : touching && state.overlay!.level > 1 ? preset!.animations.interact
          : pose === 'walking' ? preset!.animations.walk
          : pose === 'eating' ? eatingClip
          : pose === 'playing' ? playingClip
          : preset!.animations.idle;
        const clip = configured && actions[configured] ? configured : preset!.animations.idle;
        const action = clip ? actions[clip] : undefined;
        if ((clip ?? '') !== lastClip || (touching && state.overlay!.startedAt !== lastOverlay && clip === preset!.animations.interact && !sleeping)) {
          if (action) {
            if (currentAction !== action) currentAction?.fadeOut(.18);
            action.reset().setEffectiveWeight(1).fadeIn(.18).play(); currentAction = action;
          }
          lastClip = clip ?? ''; lastOverlay = state.overlay?.startedAt ?? 0;
          setAnimation(action ? clip! : sleeping ? 'sleep-pose' : 'idle-static');
        }
        mixer.update(delta);
        turn.rotation.y += (targetYaw.current - turn.rotation.y) * Math.min(1, delta * 8);
        if (!action) {
          turn.position.y = Math.sin(now / 1000 * 1.8) * .005;
          turn.rotation.z = sleeping ? -.06 : 0;
        } else { turn.position.y = 0; turn.rotation.z = 0; }
        if (touching) {
          const o = state.overlay!, progress = Math.max(0, Math.min(1, (Date.now() - o.startedAt) / Math.max(1, o.expiresAt - o.startedAt)));
          const pulse = Math.sin(progress * Math.PI), strength = sleeping || o.level <= 1 ? .15 : 1;
          const name = o.kind === 'tap_tail' ? 'Tail_1' : o.kind === 'stroke' ? 'Spine' : 'Head';
          const bone = bones[name];
          if (bone) {
            restoreBones.set(bone, bone.quaternion.clone());
            if (o.kind === 'tap_tail') bone.rotateZ(pulse * .2 * strength);
            else bone.rotateX(pulse * (o.kind === 'tap_nose' ? -.10 : .09) * strength);
          } else turn.rotation.z += Math.sin(progress * Math.PI * 2) * .025 * strength;
        }
      }
      renderer.render(scene, camera);
      if (ready && model && !audited) {
        audited = true;
        const actual = new THREE.Box3().setFromObject(model, true);
        if (node) node.dataset.bounds = JSON.stringify({ min: actual.min.toArray(), max: actual.max.toArray(), camera: camera.position.toArray(), aspect: camera.aspect });
      }
    }
    frame = requestAnimationFrame(render);
    return () => {
      active = false; cancelAnimationFrame(frame); window.clearTimeout(timer); observer.disconnect(); visibility.disconnect();
      mixer?.stopAllAction(); if (model) mixer?.uncacheRoot(model);
      disposeObject(scene); renderer.dispose();
      // StrictMode reuses the canvas immediately: losing its context here would
      // make the second setup fail. Only release the context after real removal.
      queueMicrotask(() => { if (!node.isConnected) renderer.forceContextLoss(); });
      engine.current = null;
    };
  }, [preset?.src, attempt]);

  // Lamp-mood retune only: runs on its own when nightMode flips, independent of
  // the GLB load effect above, so toggling day/night never reloads the model.
  useEffect(() => {
    if (engine.current) applyNightLighting(engine.current, nightMode);
  }, [nightMode]);

  useEffect(() => {
    if (!loaded || !preset) return;
    return applyPetAppearance(loaded, preset, appearance);
  }, [loaded, preset?.id, appearance.coatColor, appearance.patchColor, appearance.eyeColor]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if ((!interactive && !onPartPointerDown) || !engine.current || status !== 'ready') return;
    const e = engine.current, rect = event.currentTarget.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), e.camera);
    const hit = ray.intersectObjects(e.pickables, false)[0]; if (!hit) { event.currentTarget.dataset.lastHit = 'none'; event.stopPropagation(); return; }
    const point = e.turn.worldToLocal(hit.point.clone());
    const noseHit = Math.abs(point.x) < .20 && point.y > .86 && point.y < 1.12 && point.z > .8;
    const part: PetRegion = point.z < -.55 ? 'tail' : noseHit ? 'nose' : point.y > 1.02 ? 'head' : 'body';
    event.currentTarget.dataset.lastHit = JSON.stringify({ part, point: point.toArray() });
    if (onPartPointerDown) onPartPointerDown(part, event);
    else if (onInteract) onInteract(part === 'head' ? 'tap_head' : part === 'nose' ? 'tap_nose' : part === 'tail' ? 'tap_tail' : 'stroke');
  };

  if (!preset) return <div className="flex h-full items-center justify-center rounded-xl bg-surface-2 p-4 text-center text-[12px] text-ink-500">当前类型暂无可用的 3D 分身，请先选择猫咪。</div>;
  return <div ref={host} className="relative h-full w-full" data-model-id={preset.id} data-model-status={status} data-animation={animation} data-animation-kind={Object.keys(preset.animations).length ? 'skeletal' : 'whole-model'}>
    <canvas ref={canvas} aria-label={`${preset.label} 3D 数字分身`} onPointerDown={handlePointerDown}
      className="block h-full w-full touch-pan-y" style={{ pointerEvents: interactive || onPartPointerDown ? 'auto' : 'none' }} />
    {status === 'loading' && <div role="status" className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-500 pointer-events-none">正在迎接你的 3D 分身…</div>}
    {status === 'error' && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-1/95 p-4 text-center text-[12px] text-ink-700 pointer-events-auto">
      <span>{error}</span><button type="button" className="btn-secondary !min-h-[32px] !px-3 !py-1 !text-[12px]" onClick={e => { e.stopPropagation(); setAttempt(v => v + 1); }}>重新加载 3D</button>
    </div>}
    {status === 'ready' && !Object.keys(preset.animations).length && <span className="absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-surface-0/80 px-2 py-0.5 text-[9px] text-ink-500 pointer-events-none">静态角色 · 整体轻互动</span>}
    {status === 'ready' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
      {[['向左看', -.55], ['正面', 0], ['向右看', .55]].map(([label, yaw]) => <button key={label} type="button" aria-label={`3D 分身${label}`} onClick={() => { targetYaw.current = Number(yaw); }} className="rounded-pill border border-line-200 bg-surface-0/85 px-2 py-0.5 text-[10px] text-ink-500 backdrop-blur-sm hover:bg-brand-50">{label}</button>)}
    </div>}
  </div>;
}
