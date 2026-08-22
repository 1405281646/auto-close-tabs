const $ = (id) => document.getElementById(id);

let state = { enabled: true, defaultDelay: 20, rules: [], exclusions: [] };

async function load() {
  const stored = await chrome.storage.sync.get(['enabled', 'defaultDelay', 'rules', 'exclusions']);
  state.enabled = stored.enabled !== undefined ? stored.enabled : true;
  state.defaultDelay = stored.defaultDelay || 20;
  state.rules = stored.rules || [];
  state.exclusions = stored.exclusions || [];
  render();
}

function save() {
  chrome.storage.sync.set({
    enabled: state.enabled,
    defaultDelay: state.defaultDelay,
    rules: state.rules,
    exclusions: state.exclusions,
  });
}

function render() {
  $('enabled').checked = state.enabled;
  $('defaultDelay').value = state.defaultDelay;

  const list = $('ruleList');
  list.innerHTML = '';
  $('emptyHint').style.display = state.rules.length ? 'none' : 'block';

  state.rules.forEach((rule, i) => {
    const li = document.createElement('li');
    li.className = 'rule-item';

    const info = document.createElement('div');
    info.className = 'rule-info';

    const domain = document.createElement('span');
    domain.className = 'rule-domain';
    domain.textContent = rule.domain + (rule.pathPrefix || '');

    const delay = document.createElement('span');
    delay.className = 'rule-delay';
    delay.textContent = rule.delay ? rule.delay + ' 秒' : '默认';

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      state.rules.splice(i, 1);
      save();
      render();
    });

    info.append(domain, delay);
    li.append(info, del);
    list.append(li);
  });

  const exList = $('exclusionList');
  exList.innerHTML = '';
  $('exclusionEmptyHint').style.display = state.exclusions.length ? 'none' : 'block';

  state.exclusions.forEach((ex, i) => {
    const li = document.createElement('li');
    li.className = 'rule-item';

    const info = document.createElement('div');
    info.className = 'rule-info';

    const domain = document.createElement('span');
    domain.className = 'rule-domain';
    domain.textContent = ex.domain + (ex.pathPrefix || '');

    const tag = document.createElement('span');
    tag.className = 'rule-tag';
    tag.textContent = '排除';

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      state.exclusions.splice(i, 1);
      save();
      render();
    });

    info.append(domain, tag);
    li.append(info, del);
    exList.append(li);
  });
}

$('enabled').addEventListener('change', (e) => {
  state.enabled = e.target.checked;
  save();
});

$('defaultDelay').addEventListener('change', (e) => {
  const v = parseInt(e.target.value, 10);
  if (v > 0) {
    state.defaultDelay = v;
    save();
  }
});

$('addBtn').addEventListener('click', () => {
  const rawDomain = $('newDomain').value.trim().toLowerCase();
  const path = $('newPath').value.trim();
  const delay = parseInt($('newDelay').value, 10);

  // 归一化：去掉协议、路径、端口
  const domain = rawDomain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\./, '');

  if (!domain) {
    $('newDomain').focus();
    return;
  }

  state.rules.push({
    id: crypto.randomUUID(),
    domain,
    pathPrefix: path || null,
    delay: delay > 0 ? delay : null,
  });
  save();

  $('newDomain').value = '';
  $('newPath').value = '';
  $('newDelay').value = '';
  render();
});

$('excludeBtn').addEventListener('click', () => {
  const rawDomain = $('exNewDomain').value.trim().toLowerCase();
  const path = $('exNewPath').value.trim();

  const domain = rawDomain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\./, '');

  if (!domain) {
    $('exNewDomain').focus();
    return;
  }

  state.exclusions.push({
    id: crypto.randomUUID(),
    domain,
    pathPrefix: path || null,
  });
  save();

  $('exNewDomain').value = '';
  $('exNewPath').value = '';
  render();
});

load();
