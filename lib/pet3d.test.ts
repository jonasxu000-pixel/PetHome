import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAvatar, validateAvatar } from './avatar/profile.ts';
import { parseAvatarObservation } from './avatar/vision.ts';
import { getPetModel, matchPetModel } from './pet3d/catalog.ts';

test('photo observations match actual colour and pattern variants, not the starter preset id', () => {
  const a={...defaultAvatar('cat'),coatColor:'#989A9D',traits:{coatLength:'short',bodyShape:'round',facePattern:'bicolor',earShape:'pointed',unknownFields:[]} as const};
  assert.equal(matchPetModel({...a,traits:{...a.traits,unknownFields:[]}}).preset?.id,'vuena-cat-gray-white');
});

test('preset lookup cannot use a cat selection for a dog or load an arbitrary URL', () => {
  const resolved=getPetModel({...defaultAvatar('dog'),modelPresetId:'vuena-cat-cream'});
  assert.notEqual(resolved?.species,'cat');
  assert.equal(validateAvatar({...defaultAvatar('cat'),modelPresetId:'https://untrusted.example/cat.glb'}),null);
});

test('a tan dog does not acquire black-and-white spots just to match short hair', () => {
  const avatar={...defaultAvatar('dog'),coatColor:'#E8B27F',traits:{coatLength:'short',bodyShape:'average',facePattern:'bicolor',earShape:'pointed',unknownFields:[]} as const};
  assert.equal(matchPetModel({...avatar,traits:{...avatar.traits,unknownFields:[]}}).preset?.id,'sloyd-cavapoo-honey');
});

test('explicit unknown traits and colour remain marked unknown rather than invented AI observations', () => {
  const a=parseAvatarObservation(JSON.stringify({...defaultAvatar('cat'),hasPet:true,eyeColor:null,coatLength:'unknown',bodyShape:'unknown',facePattern:'bicolor',earFeature:'pointed'}));
  assert.ok(a.traits?.unknownFields.includes('eyeColor'));
  assert.equal(a.traits?.coatLength,'unknown');
  assert.ok(validateAvatar({...a,model:'actual-model'}));
});

test('the model bicolor synonym stays truthful while remaining compatible with v1 profiles', () => {
  const a=parseAvatarObservation(JSON.stringify({...defaultAvatar('cat'),hasPet:true,pattern:'bicolor',facePattern:'bicolor',coatColor:'#F5E6D3',patchColor:'#C0B0A9',coatLength:'long',bodyShape:'round',earFeature:'pointed'}));
  assert.equal(a.pattern,'tuxedo');
  assert.equal(a.traits?.facePattern,'bicolor');
  assert.equal(matchPetModel({...a,model:'actual-model'}).preset?.id,'vuena-cat-gray-white');
});

test('3D selection and structured traits survive the persisted avatar validator', () => {
  const a={...defaultAvatar('cat'),modelPresetId:'vuena-cat-black-white',traits:{coatLength:'long',bodyShape:'round',facePattern:'bicolor',earShape:'pointed',unknownFields:['eyeColor']}};
  const safe=validateAvatar(a);
  assert.equal(safe?.modelPresetId,'vuena-cat-black-white');
  assert.deepEqual(safe?.traits,a.traits);
});
