# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Defensive config/state recovery — all JSON.parse calls wrapped in try/catch with fallback defaults
- Error boundary around profile loading — shows user-visible toast on API failure instead of blank sidebar
- Blacklist null safety — prevents TypeError on fresh Tabby installs without profileBlacklist
- Fixed memory leak in resize event listeners — uses stable method references instead of per-mousedown closures
- Keyboard focus index now resets on profile refresh, filter change, and tag filter change (prevents wrong profile launch)
- Context menu viewport clamping — menu no longer renders off-screen near edges
- Debounced config saves (500ms) — prevents write flooding on rapid pin/unpin/tag operations

### Added
- Shared utility module (`utils.ts`) with `formatTimeAgo()` and `matchesProfileFilter()` functions
- Sidebar resizability — drag the edge to resize between 180px and 600px, width persisted to config
- Right-side positioning — set `position: 'right'` in plugin config to place sidebar on the right
- Keyboard navigation — Arrow Up/Down to move between profiles, Enter to connect, `/` to focus search, Escape to dismiss
- Enhanced search — now matches group name, username, host, and port (not just profile name)
- Connection statistics — tracks last-connected time and connection count per profile, persisted across restarts; "Recent" sort uses persistent stats as fallback; hover tooltip shows last connected time
- Profile tags — assign tags via context menu (type new or pick from existing), filter sidebar by tag with pill-style filter buttons; tags persisted to plugin config
- User-facing toast notifications for all context menu actions (duplicate, copy SSH command, delete, hide/show from selector)
- Error feedback when profile edit auto-navigation fails (instead of silent console warnings)
- Test suite (34 tests) covering sorting, filtering, grouping, favorites, SSH command generation, blacklist, and connection count logic

### Changed
- Consolidated all layout CSS into a single injected stylesheet in the service (eliminated duplicate inline style manipulation on `.content` elements)
- Reduced `!important` overrides from 7 to 1 (only used where strictly necessary to override Tabby's inline `width: 100vw`)
- Moved sidebar wrapper styles from inline `cssText` to the injected stylesheet
- Removed redundant CSS selectors targeting `.content` (4 selectors → 1)
- Decomposed monolithic `sshSidebar.component.ts` (1,095 lines) into focused sub-components:
  - `contextMenu.component.ts` — right-click context menu with all profile actions
  - `profileItem.component.ts` — individual profile display with icon, description, and badges
  - `profileGroup.component.ts` — collapsible group header with profile list
  - `sshSidebar.component.ts` — orchestrator component (header, search, sort, state management)
- Active connection tracking now uses a pre-computed `activeProfileIds` array instead of per-render tab checks

## [0.3.2] - 2026-03-17

### Added
- Auto-refresh when profiles are modified (no restart needed)

## [0.3.0] - 2026-03-17

### Added
- Initial release
- Persistent sidebar with SSH connection list
- Search/filter, sort by name/host/recent
- Favorites pinning
- Context menu (launch, edit, duplicate, copy SSH command, delete)
- Group collapse/expand with state persistence
- Active connection indicators
