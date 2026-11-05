'use strict';

const CATEGORIES = ['Bug', 'Suggestion', 'Loading Blocker', 'Compatibility Error',
  'Compatibility Suggestion', 'Other'];
const HEADINGS = ['1. Category', '2. Minecraft and Motive versions', '3. NeoForge version',
  '4. Problem and screenshots', '5. Expected result', '6. Additional information',
  '7. Logs and error reports'];
const MARKER = '<!-- motive-issue-triage -->';

function parse(body = '') {
  const fields = Array(7).fill('');
  let index = -1;
  for (const line of (body || '').split(/\r?\n/)) {
    const next = line.startsWith('### ') ? HEADINGS.indexOf(line.slice(4).trim()) : -1;
    if (next >= 0) {
      index = next;
    } else if (index >= 0) {
      fields[index] += `${line}\n`;
    }
  }
  return fields.map(value => value.trim().replace(/^_No response_$/, ''));
}

function textLength(value) {
  return Array.from(value.replace(/!\[([^\]]*)\]\([^\n]*?\)/g, '$1')
      .replace(/<img\b[^>]*>/gi, '').trim()).length;
}

function validate(fields) {
  const errors = [];
  for (let i = 0; i < 5; i++) {
    if (!fields[i]) {
      errors.push(`Field ${i + 1} is required.`);
    }
  }
  if (fields[0] && !CATEGORIES.includes(fields[0])) {
    errors.push('Select one category from the form.');
  }
  for (const [index, limit] of [[1, 50], [2, 50], [3, 500], [4, 200]]) {
    if (textLength(fields[index]) > limit) {
      errors.push(`Field ${index + 1} exceeds ${limit} characters.`);
    }
  }
  const files = new Set(fields[6].match(/https?:\/\/[^\s<>"\)\]]+/g) || []);
  if (files.size > 10) {
    errors.push('Field 7 exceeds 10 attachment links.');
  }
  return errors;
}

function normalize(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function bigrams(value) {
  const chars = Array.from(normalize(value));
  return new Set(chars.slice(1).map((char, i) => chars[i] + char));
}

/** Similarity is advisory only; no automatic issue closure. */
function findSimilar(issue, candidates) {
  const fields = parse(issue.body);
  const terms = bigrams(fields[3]);
  return candidates.filter(candidate => {
    if (candidate.pull_request || candidate.number >= issue.number) {
      return false;
    }
    const title = normalize(issue.title);
    if (title.length >= 12 && title === normalize(candidate.title)) {
      return true;
    }
    const otherFields = parse(candidate.body);
    if (fields[0] !== otherFields[0] || terms.size < 20) {
      return false;
    }
    const other = bigrams(otherFields[3]);
    const overlap = [...terms].filter(term => other.has(term)).length;
    return overlap / (terms.size + other.size - overlap) >= 0.8;
  }).slice(0, 3).map(candidate => candidate.number);
}

async function run({github, context}) {
  if (`${context.repo.owner}/${context.repo.repo}` !== 'Motive-Dev-Studio/Motive-Release') {
    return;
  }
  const api = github.rest.issues;
  const target = {...context.repo, issue_number: context.issue.number};
  const {data: issue} = await api.get(target);
  if (issue.pull_request || issue.state !== 'open') {
    return;
  }
  const fields = parse(issue.body);
  const errors = validate(fields);
  const current = issue.labels.map(label => typeof label === 'string' ? label : label.name);
  const desired = CATEGORIES.includes(fields[0]) ? [fields[0]] : [];
  if (errors.length) {
    desired.push('Needs Information');
  }
  if (['opened', 'reopened'].includes(context.payload.action)) {
    desired.push('Pending');
  }
  const known = await github.paginate(api.listLabelsForRepo, {...context.repo, per_page: 100});
  for (const name of desired) {
    if (!known.some(label => label.name === name)) {
      try {
        await api.createLabel({...context.repo, name, color: '1d76db'});
      } catch (error) {
        if (error.status !== 422) {
          throw error;
        }
        // Confirm another concurrent run created the same label.
        await api.getLabel({...context.repo, name});
      }
    }
  }
  for (const name of current) {
    if ((CATEGORIES.includes(name) || name === 'Needs Information') && !desired.includes(name)) {
      await api.removeLabel({...target, name});
    }
  }
  const missing = desired.filter(name => !current.includes(name));
  if (missing.length) {
    await api.addLabels({...target, labels: missing});
  }
  const candidates = [];
  for (let page = 1; page <= 2; page++) {
    const {data} = await api.listForRepo({
      ...context.repo, state: 'all', sort: 'created', direction: 'desc', per_page: 100, page,
    });
    candidates.push(...data);
    if (data.length < 100) {
      break;
    }
  }
  const similar = findSimilar(issue, candidates);
  const comments = await github.paginate(api.listComments, {...target, per_page: 100});
  const previous = comments.find(comment => comment.user?.login === 'github-actions[bot]' &&
    comment.body?.startsWith(MARKER));
  if (!errors.length && !similar.length && !previous) {
    return;
  }
  const parts = [MARKER, '**Automated form review**'];
  parts.push(errors.length ? 'Please edit this issue:\n' + errors.map(e => `- ${e}`).join('\n') :
    'Required fields and configured length limits pass the automated check.');
  if (similar.length) {
    parts.push(`Possibly related: ${similar.map(number => `#${number}`).join(', ')}.`,
        'This is a similarity reminder, not a duplicate verdict. No issue has been closed.');
  }
  const body = parts.join('\n\n');
  if (previous) {
    if (previous.body !== body) {
      await api.updateComment({...context.repo, comment_id: previous.id, body});
    }
  } else {
    await api.createComment({...target, body});
  }
}

module.exports = {HEADINGS, parse, textLength, validate, findSimilar, run};
