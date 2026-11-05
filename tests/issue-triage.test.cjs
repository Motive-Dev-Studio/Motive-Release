'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {HEADINGS, parse, validate, textLength, formatTitle, findSimilar, run} =
  require('../.github/scripts/issue-triage.cjs');
const fields = ['Bug', 'Minecraft 26.3 + Motive 1.0.0', '26.3.0.76',
  'Opening the machine screen stops the game after inserting an item.',
  'The screen should remain responsive.', '', ''];
const body = values => values.map((value, i) => `### ${HEADINGS[i]}\n\n${value}`).join('\n\n');

test('titles are formatted once and refreshed from edited fields', () => {
  const expected = '[Bug][Minecraft 26.3 + Motive 1.0.0]: Test bug';
  assert.equal(formatTitle('Test bug', fields), expected);
  assert.equal(formatTitle(expected, fields), expected);
  const edited = [...fields];
  edited[0] = 'Suggestion';
  edited[1] = 'Minecraft 26.3 + Motive 1.0.1';
  assert.equal(formatTitle(expected, edited),
      '[Suggestion][Minecraft 26.3 + Motive 1.0.1]: Test bug');
  assert.equal(formatTitle('[Custom] Test bug', fields),
      '[Bug][Minecraft 26.3 + Motive 1.0.0]: [Custom] Test bug');
  assert.equal(formatTitle('Test bug', Array(7).fill('')), 'Test bug');
  assert.equal(Array.from(formatTitle('😀'.repeat(300), fields)).length, 256);
});

test('required and optional fields, Unicode limits, images and attachments', () => {
  assert.deepEqual(validate(parse(body(fields))), []);
  const changed = [...fields];
  changed[1] = '😀'.repeat(50);
  assert.deepEqual(validate(changed), []);
  changed[1] += 'a';
  assert.equal(validate(changed).length, 1);
  assert.equal(textLength('![caption](https://example.com/a.png)'), 7);
  changed[1] = fields[1];
  changed[6] = Array.from({length: 10}, (_, i) => `https://example.com/${i}`).join('\n');
  assert.deepEqual(validate(changed), []);
  changed[6] += '\nhttps://example.com/10';
  assert.equal(validate(changed).length, 1);
  assert.equal(validate(Array(7).fill('')).length, 5);
});

test('similarity excludes PRs and later issues', () => {
  const issue = {number: 8, title: 'Machine screen freezes', body: body(fields)};
  assert.deepEqual(findSimilar(issue, [
    {...issue, number: 7}, {...issue, number: 6, pull_request: {}}, {...issue, number: 9},
  ]), [7]);
});

test('editing preserves unrelated labels and updates one reminder without closing', async () => {
  const calls = [];
  const api = {
    get: async () => ({data: {number: 8, title: 'A report', body: body(fields), state: 'open',
      labels: [{name: 'Suggestion'}, {name: 'Needs Information'}, {name: 'Maintainer'}]}}),
    listLabelsForRepo: 'labels', listComments: 'comments',
    update: async value => {
      assert.deepEqual(Object.keys(value).sort(), ['issue_number', 'owner', 'repo', 'title']);
      calls.push(['title', value.title]);
    },
    removeLabel: async value => calls.push(['remove', value.name]),
    addLabels: async value => calls.push(['add', value.labels]),
    listForRepo: async () => ({data: []}),
    updateComment: async value => calls.push(['comment', value.comment_id]),
  };
  const github = {rest: {issues: api}, paginate: async method => method === 'labels' ?
    [{name: 'Bug'}] : [{id: 42, user: {login: 'github-actions[bot]'},
      body: '<!-- motive-issue-triage --> old'}]};
  await run({github, context: {repo: {owner: 'Motive-Dev-Studio', repo: 'Motive-Release'},
    issue: {number: 8}, payload: {action: 'edited'}}});
  assert.deepEqual(calls, [['title', '[Bug][Minecraft 26.3 + Motive 1.0.0]: A report'],
    ['remove', 'Suggestion'], ['remove', 'Needs Information'],
    ['add', ['Bug']], ['comment', 42]]);
});
