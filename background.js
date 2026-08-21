const DEFAULT_DELAY = 20;

let config = { enabled: true, defaultDelay: DEFAULT_DELAY, rules: [] };

// ---------- 配置 ----------

async function loadConfig() {
  const stored = await chrome.storage.sync.get(['enabled', 'defaultDelay', 'rules']);
  config = {
    enabled: stored.enabled !== undefined ? stored.enabled : true,
    defaultDelay: stored.defaultDelay || DEFAULT_DELAY,
    rules: stored.rules || [],
  };
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    loadConfig().then(resyncAllTabs);
  }
});

// ---------- 规则匹配 ----------

function matchRule(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  for (const rule of config.rules) {
    const d = rule.domain.toLowerCase().replace(/^\./, '');
    const hostMatch = host === d || host.endsWith('.' + d);
    if (!hostMatch) continue;
    const prefix = rule.pathPrefix || '/';
    if (path.startsWith(prefix)) return rule;
  }
  return null;
}

function delayFor(rule) {
  return rule && rule.delay ? rule.delay : config.defaultDelay;
}

// ---------- 倒计时 ----------

function alarmName(tabId) {
  return 'tab-' + tabId;
}

function startCountdown(tabId, delaySec) {
  chrome.alarms.create(alarmName(tabId), { when: Date.now() + delaySec * 1000 });
}

function cancelCountdown(tabId) {
  chrome.alarms.clear(alarmName(tabId));
}

// ---------- 标签页事件 ----------

chrome.tabs.onCreated.addListener((tab) => {
  if (!config.enabled || !tab.url) return;
  const rule = matchRule(tab.url);
  if (rule) startCountdown(tab.id, delayFor(rule));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!config.enabled || !changeInfo.url) return;
  cancelCountdown(tabId);
  const rule = matchRule(tab.url || changeInfo.url);
  if (rule) startCountdown(tabId, delayFor(rule));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cancelCountdown(tabId);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('tab-')) return;
  const tabId = Number(alarm.name.slice(4));
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // 标签页已不存在
  }
  if (!config.enabled) return;
  if (!matchRule(tab.url)) return; // 防御：当前 URL 已不再匹配
  const tabs = await chrome.tabs.query({ windowId: tab.windowId });
  if (tabs.length <= 1) return; // 窗口最后一个标签页，跳过
  chrome.tabs.remove(tabId);
});

// ---------- 配置变化后重扫所有标签页 ----------

async function resyncAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    cancelCountdown(tab.id);
    if (!config.enabled) continue;
    const rule = matchRule(tab.url);
    if (rule) startCountdown(tab.id, delayFor(rule));
  }
}

// ---------- 右键菜单 ----------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-current-page',
    title: '把当前页面加入自动关闭规则',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'add-current-page' || !tab || !tab.url) return;
  await loadConfig();
  let u;
  try {
    u = new URL(tab.url);
  } catch {
    return;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const rule = {
    id: crypto.randomUUID(),
    domain: u.hostname,
    pathPrefix: u.pathname,
    delay: null,
  };
  config.rules.push(rule);
  await chrome.storage.sync.set({ rules: config.rules });
  if (config.enabled && matchRule(tab.url)) {
    startCountdown(tab.id, delayFor(rule));
  }
});

loadConfig().then(resyncAllTabs);
