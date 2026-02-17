const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWorkoutText } = require('../src/parser');

test('parses run duration and tags', () => {
  const parsed = parseWorkoutText('Ran 5k outdoors, 32 minutes #easy');
  assert.equal(parsed.activity_type, 'run');
  assert.equal(parsed.duration_minutes, 32);
  assert.deepEqual(parsed.tags, ['easy']);
  assert.equal(parsed.indicator_letter, 'R');
});

test('parses hours and category', () => {
  const parsed = parseWorkoutText('Gym chest + triceps 1 hour 15 min');
  assert.equal(parsed.activity_type, 'gym');
  assert.equal(parsed.duration_minutes, 75);
  assert.match(parsed.category, /chest/);
});

test('keeps null values when unknown', () => {
  const parsed = parseWorkoutText('Moved around a bit');
  assert.equal(parsed.activity_type, null);
  assert.equal(parsed.duration_minutes, null);
  assert.equal(parsed.category, null);
});
