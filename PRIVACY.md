# Privacy Policy: Dashing New Tab

_Last updated: November 27, 2026_

Dashing New Tab replaces Chrome's new tab page with a personal dashboard. This policy explains what data it uses and what it does with it.

## Summary

**Dashing New Tab does not collect, transmit, sell or share any data.** Everything it reads stays inside your browser. The extension makes no network requests to any server owned by the developer or by third parties, and it contains no analytics, ads or tracking.

## Data the extension reads, and why

| Data | Chrome permission | How it is used |
|---|---|---|
| Browsing history (last 30 days) | `history` | Shows your most used sites, today's page count and a 7-day activity heatmap, and powers search across history. |
| Most visited sites | `topSites` | Suggests tools for your dock on first run. |
| Open tabs (titles and URLs) | `tabs` | Lists open tabs, detects duplicates, and switches to a tool that is already open instead of opening a new copy. |
| Recently closed tabs | `sessions` | Lists recently closed tabs so you can restore them. |
| Site icons | `favicon` | Displays site icons from Chrome's local icon cache. |
| Search text | `search` | Sends searches you type to **your own default search engine**, exactly as the address bar would. |

All of this is processed locally on your device, at the moment the new tab page is open.

## Data the extension stores

Using `chrome.storage.local`, on your device only:

- your dock tools and their order,
- to-do items, scratchpad notes and saved workspaces (lists of tab URLs you chose to save),
- your display name, if you set one,
- focus timer state and minutes focused per day.

This data never leaves your browser. Removing the extension deletes it.

## Notifications and alarms

The `alarms` and `notifications` permissions are used only to end a focus timer you started and show a "Focus block complete" notification.

## Third parties

None. The extension does not include third-party code, fonts loaded from the internet, or remote scripts.

## Changes

If this policy changes, the updated version will be published at this address with a new date.

## Contact

Questions about this policy can be raised as an issue on the project's GitHub repository: https://github.com/Abh1shxkk/dashing-new-tab/issues
