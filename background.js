// Ends focus blocks even when no new-tab page is open.
const todayKey = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'focus') return;
  const { focus, focusLog = {} } = await chrome.storage.local.get(['focus', 'focusLog']);
  if (!focus || focus.paused) return;
  const k = todayKey();
  focusLog[k] = (focusLog[k] || 0) + focus.duration;
  await chrome.storage.local.set({ focus: null, focusLog });
  chrome.notifications.create('focus-done-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Focus block complete',
    message: `${focus.duration} minutes done. Stand up, stretch, take five.`,
    priority: 2,
  });
});
