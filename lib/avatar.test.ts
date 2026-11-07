import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAvatar,validateAvatar} from './avatar/profile.ts';
import {parseAvatarObservation} from './avatar/vision.ts';
import {profileKey,validatePet} from './server/profile-store.ts';
test('avatar defaults remain explicitly starter, not AI',()=>{
  const avatar=defaultAvatar('cat');assert.equal(avatar.species,'cat');assert.equal(avatar.origin,'starter');assert.equal(avatar.model,null);assert.ok(validateAvatar(avatar));
});
test('unsafe colors and unsupported shapes are rejected',()=>{
  assert.equal(validateAvatar({...defaultAvatar(),coatColor:'url(javascript:alert(1))'}),null);
  assert.equal(validateAvatar({...defaultAvatar(),earShape:'anything'}),null);
});
test('AI origin requires a real model identifier; palette origin cannot impersonate one',()=>{
  assert.equal(validateAvatar({...defaultAvatar(),origin:'ai_vision'}),null);
  assert.equal(validateAvatar({...defaultAvatar(),origin:'photo_palette',model:'fake'}),null);
});
test('appearance parser does not invent a pet or silently fill model omissions',()=>{
  assert.throws(()=>parseAvatarObservation('{"hasPet":false,"species":"unknown"}'),/没能看清/);
  assert.throws(()=>parseAvatarObservation('{"hasPet":true,"species":"dog"}'),/未完整/);
  const input={...defaultAvatar('dog'),hasPet:true};const result=parseAvatarObservation(JSON.stringify(input));assert.equal(result.coatColor,input.coatColor);
});
test('private profile keys cannot become arbitrary filesystem paths',()=>{
  assert.equal(profileKey('pethome_profile=../../private'),null);
  assert.equal(profileKey('pethome_profile='+'a'.repeat(64)),'a'.repeat(64));
});
test('profile validation retains a valid avatar and rejects injected fields',()=>{
  const pet={id:'12345678-1234-4234-8234-123456789012',ownerDeviceId:'test-device',name:'豆豆',type:'dog',personality:'clingy',photoUrl:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),avatar:defaultAvatar()};
  assert.ok(validatePet(pet));assert.equal(validatePet({...pet,avatar:{...pet.avatar,coatColor:'red; background:url(x)'}}),null);
});
