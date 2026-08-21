# ADR-0001: 用 chrome.alarms 而非 setTimeout 实现倒计时

- 状态：已接受
- 日期：2026-08-21

## 背景

扩展需要在标签页打开后（默认 20 秒，规则可覆盖）自动关闭标签页。倒计时的自然实现是 `setTimeout`，但 Manifest V3 的 service worker 会在空闲约 30 秒后被浏览器挂起，挂起期间挂起的定时器回调不保证触发。对于超过 30 秒的规则时长，`setTimeout` 不可靠。

## 决策

倒计时统一使用 `chrome.alarms` 的一次性闹钟实现：

```js
chrome.alarms.create(name, { when: Date.now() + delayMs });
```

- 一次性闹钟的 `when` 字段支持任意延迟（含 20 秒），不受重复闹钟 30 秒最小周期的限制。
- 闹钟触发时浏览器会唤醒 service worker，保证可靠性。
- 取消倒计时用 `chrome.alarms.clear(name)`。

## 备选方案

- **`setTimeout`**：实现简单、无需额外权限，但 service worker 挂起后不保证触发，长时长规则会失效。已否决。
- **重复闹钟 `periodInMinutes`**：最小周期 30 秒，无法表达 20 秒默认时长。已否决。

## 后果

- 需要 `alarms` 权限。
- 每个倒计时占用一个闹钟，需用唯一名称（如 `tab-<tabId>`）管理，并在取消/关闭时清理。
