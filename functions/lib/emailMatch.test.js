'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalEmail, isEmailOnList, isSafeProjectId } = require('./emailMatch');

test('canonical Gmail ignores dots and plus tags', () => {
  assert.equal(canonicalEmail('Lalit.Sahni+job@Gmail.com'), 'lalitsahni@gmail.com');
});

test('invite list match uses canonical variants', () => {
  assert.equal(isEmailOnList(['books@outlook.com'], 'Books@outlook.com'), true);
  assert.equal(isEmailOnList(['a.b@gmail.com'], 'ab@gmail.com'), true);
  assert.equal(isEmailOnList(['owner@opalss.com.au'], 'other@opalss.com.au'), false);
});

test('project ids are simple Firestore ids', () => {
  assert.equal(isSafeProjectId('gurner-st'), true);
  assert.equal(isSafeProjectId('../secrets'), false);
  assert.equal(isSafeProjectId('a/b'), false);
  assert.equal(isSafeProjectId(''), false);
});
