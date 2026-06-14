import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClientProps, buildPlanProps } from './notion.mjs';

test('buildClientProps: полный набор полей', () => {
  const p = buildClientProps({
    name: 'Beauty Culture', projectId: 'BeautyCulture',
    platforms: ['VK', 'Telegram'], operator: 'Настя',
    focus: 'запуск', status: 'active',
  });
  assert.equal(p['Name'].title[0].text.content, 'Beauty Culture');
  assert.equal(p['Local project ID'].rich_text[0].text.content, 'BeautyCulture');
  assert.equal(p['Статус'].select.name, 'active');
  assert.deepEqual(p['Платформы'].multi_select.map(o => o.name), ['VK', 'Telegram']);
  assert.equal(p['Оператор'].rich_text[0].text.content, 'Настя');
  assert.equal(p['Текущий фокус'].rich_text[0].text.content, 'запуск');
});

test('buildClientProps: частичный набор — только заданные ключи', () => {
  const p = buildClientProps({ status: 'paused' });
  assert.deepEqual(Object.keys(p), ['Статус']);
  assert.equal(p['Статус'].select.name, 'paused');
});

test('buildPlanProps: связь с клиентом + дефолтный статус', () => {
  const p = buildPlanProps({ name: 'BC — июнь', clientPageId: 'pageid-1' });
  assert.equal(p['Name'].title[0].text.content, 'BC — июнь');
  assert.equal(p['Статус'].select.name, 'черновик');
  assert.equal(p['Клиент'].relation[0].id, 'pageid-1');
});
