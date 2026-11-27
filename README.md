# Dashing New Tab

A Chrome extension that replaces the new tab page with a one-screen bento dashboard built from your own browsing: the tools you use most, your open tabs, a focus timer and a few quiet productivity helpers. Everything is read from local Chrome APIs. Nothing is sent anywhere.

## Features

- **Floating dock** of your tools with macOS-style magnification. A dot under an icon means the tool is already open; clicking it switches to that tab instead of opening a duplicate.
- **Daily brief** (the notch at the top): one question at a time, such as closing duplicate tabs, closing tabs untouched for two days, saving a crowded window, or starting a focus block.
- **Search** across your tools, open tabs, 30 days of history and actions. `Ctrl+K` opens a command palette; type `todo: …` to add a task.
- **Focus timer** (25/50/90/5 min) that keeps running after the tab closes and sends a desktop notification when it ends.
- **Time** card with a day-progress bar and UTC, London and New York clocks.
- **Tabs** card with duplicate detection, plus recently closed tabs.
- **Most used** sites over 30 days, a **7-day activity heatmap**, **Today** stats, **To-do**, **Scratchpad** and **Workspaces** (save a window of tabs and reopen it later).
- Cards expand into a larger view and minimize into the dock with a genie effect. Light and dark themes.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Open a new tab and choose **Keep it** when Chrome asks.

To hide Chrome's own footer bar under the page, open **Customize Chrome** and turn off **Show footer on New tab page**.

## Permissions

| Permission | Used for |
|---|---|
| `topSites`, `history` | Building your tool list, Most used, Today stats and the heatmap |
| `tabs`, `sessions` | Open tabs, switching to an open tool, recently closed, workspaces |
| `storage` | Your tools, to-dos, notes, workspaces and settings |
| `alarms`, `notifications` | Ending focus blocks with a notification |
| `favicon` | Site icons |
| `search` | Sending searches to your default search engine |

## Files

- `manifest.json`: extension settings (Manifest V3)
- `newtab.html`, `styles.css`, `app.js`: the new tab page
- `background.js`: finishes focus blocks when no page is open
- `icon*.png`, `icon.svg`: icons
