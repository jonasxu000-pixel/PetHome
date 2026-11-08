import * as THREE from 'three';
import type { AvatarProfile } from '../types';
import type { PetModelPreset } from './catalog';

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** Recolour only verified pigment regions in Vuena's atlas, preserving eyes,
 * muzzle, pink nose/ears, highlights, UVs, normals and the ORM texture.
 * The centre blaze is a deliberately limited preset, not arbitrary photo baking.
 */
function recolorAtlas(original: THREE.Texture, avatar: AvatarProfile, preset: PetModelPreset): THREE.Texture | null {
  const image = original.image as CanvasImageSource & { width: number; height: number };
  if (!image?.width || !image.height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const coat = rgb(avatar.coatColor), patch = rgb(avatar.patchColor), eyes = rgb(avatar.eyeColor);
  const facePigment=coat.reduce((a,b)=>a+b,0)<patch.reduce((a,b)=>a+b,0)?coat:patch;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    const u = (i / 4 % canvas.width) / canvas.width;
    const v = Math.floor(i / 4 / canvas.width) / canvas.height;
    if (preset.customization.textureMode === 'sloyd-cavapoo') {
      // Keep dark eyes/nose, neutral highlights and pink areas intact. Only
      // warm fur pigment is shifted; the existing fur shading is retained.
      if (r > 95 && g > 70 && r > g * 1.035 && g > b * 1.08) {
        const shade = .48 + (.3 * r + .59 * g + .11 * b) / 255 * .52;
        for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, Math.round(coat[c] * shade));
      }
    } else if (r > g * 1.1 && g > b * 1.25 && r - b > 45 && g > 65) {
      const stripe = g < 135;
      let color = stripe ? patch : coat;
      let shade = stripe ? .93 : Math.min(1.1, .83 + g / 800);
      if (preset.pattern === 'bicolor' && v < .5) color = facePigment;
      if (preset.pattern === 'bicolor' && v > .13 && v < .45 && Math.abs(u - .5) < .012 + Math.max(0, (.42 - v) / .29) * .045) {
        color = [249, 246, 238]; shade = 1;
      }
      for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, Math.round(color[c] * shade));
    } else if (g > r * 1.22 && g > b * .95 && g > 45 && r < 130) {
      const shade = Math.min(1.15, .65 + g / 255);
      for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, Math.round(eyes[c] * shade));
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = original.clone();
  map.image = canvas; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
  return map;
}

/** A reversible, material-whitelisted update. Call cleanup before reapplying. */
export function applyPetAppearance(root: THREE.Object3D, preset: PetModelPreset, avatar: AvatarProfile): () => void {
  const originals: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> = [];
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  root.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    const before = mesh.material;
    const updated = (Array.isArray(before) ? before : [before]).map(original => {
      const known = materials.get(original); if (known) return known;
      const coat = preset.customization.coatMaterialNames.includes(original.name);
      const patch = preset.customization.patchMaterialNames?.includes(original.name);
      const eye = preset.customization.eyeMaterialNames?.includes(original.name);
      if (!coat && !patch && !eye) return original;
      const mat = original.clone() as THREE.MeshStandardMaterial;
      if (preset.customization.textureMode && mat.map) {
        const source = mat.map;
        let texture = textures.get(source);
        if (!texture) { texture = recolorAtlas(source, avatar, preset) ?? undefined; if (texture) textures.set(source, texture); }
        if (texture) { mat.map = texture; mat.color.set('#FFFFFF'); }
      } else if (mat.color && !mat.map) {
        // Solid-material assets only. Textured assets require an explicit mask.
        mat.color.set(coat ? avatar.coatColor : eye ? avatar.eyeColor : avatar.patchColor);
      }
      mat.needsUpdate = true; materials.set(original, mat); return mat;
    });
    originals.push({ mesh, material: before });
    mesh.material = Array.isArray(before) ? updated : updated[0];
  });
  return () => {
    for (const { mesh, material } of originals) mesh.material = material;
    for (const material of materials.values()) material.dispose();
    for (const texture of textures.values()) texture.dispose();
  };
}
