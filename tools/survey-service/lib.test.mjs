import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, buildIntakeKey, flattenAnswers } from './lib.mjs';

test('slugify транслитерирует кириллицу и чистит', () => {
  assert.equal(slugify('Лакмода'), 'lakmoda');
  assert.equal(slugify('Beauty Culture'), 'beauty-culture');
  assert.equal(slugify('  Кафе «Уют» 24/7 '), 'kafe-uyut-24-7');
  assert.equal(slugify(''), 'client');
  assert.equal(slugify(null), 'client');
});

test('slugify ограничивает длину', () => {
  assert.ok(slugify('а'.repeat(100)).length <= 40);
});

test('buildIntakeKey собирает датированный ключ', () => {
  const key = buildIntakeKey('smm/intake/', 'Лакмода', new Date('2026-06-20T10:00:00Z'), 'ab12cd');
  assert.equal(key, 'smm/intake/2026-06-20-lakmoda-ab12cd.json');
});

test('buildIntakeKey добавляет слэш к префиксу без него', () => {
  const key = buildIntakeKey('smm/intake', 'X', new Date('2026-06-20T00:00:00Z'), 'zz');
  assert.equal(key, 'smm/intake/2026-06-20-x-zz.json');
});

test('flattenAnswers даёт пары вопрос→ответ, пропускает пустое и служебное', () => {
  const def = { pages: [
    { elements: [{ name: 'q1', title: 'Бренд' }, { name: 'q19', title: 'Соцсети' }] },
    { elements: [{ name: 'q3', title: 'География' }] },
  ] };
  const data = { q1: 'Лакмода', q19: ['VK', 'Telegram'], q3: '', _hp: 'bot', q99: 'без тайтла' };
  const out = flattenAnswers(def, data);
  assert.deepEqual(out, [
    { name: 'q1', title: 'Бренд', answer: 'Лакмода' },
    { name: 'q19', title: 'Соцсети', answer: 'VK, Telegram' },
    { name: 'q99', title: 'q99', answer: 'без тайтла' },
  ]);
});
