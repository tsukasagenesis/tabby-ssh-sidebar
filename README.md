# Tabby SSH Sidebar

A Tabby Terminal plugin that adds a persistent sidebar panel showing all your SSH connections, with quick access via toolbar button.

> ⚠️ **Disclaimer**: This plugin was made by a monkey who vibes code. Expect it to break and not work as intended. Use at your own risk!

## Screenshots

### Sidebar Overview
![Sidebar with grouped connections and favorites](https://raw.githubusercontent.com/tsukasagenesis/tabby-ssh-sidebar/main/screenshots/sidebar-overview.png)

### Context Menu
![Right-click context menu with connection options](https://raw.githubusercontent.com/tsukasagenesis/tabby-ssh-sidebar/main/screenshots/context-menu.png)

## Features

### Persistent Sidebar Panel
- **Always-Visible Panel**: Fixed sidebar on the left side showing all SSH connections
- **Live Connection Status**: Visual indicators show which connections are currently active
- **Search Functionality**: Built-in search box to filter connections by name, host, or user
- **Collapsible Groups**: Organize connections by groups with collapsible headers
- **Favorites Support**: Pin your most-used connections to a dedicated "Favorites" group at the top
- **Auto-Initialize**: Restores your previous sidebar state on startup

### Connection Management
- **Right-Click Context Menu**: Access additional options for each connection
  - Connect to SSH server
  - Edit connection settings (opens directly to profile editor)
  - Pin/Unpin from Favorites
  - Delete connection
- **Profile Sorting**: Connections sorted alphabetically within groups
- **Group Organization**: Maintains your existing Tabby profile groups

### Toolbar Integration
- **Toggle Button**: Click to show/hide the sidebar panel
- **Dual Access**: Use sidebar for persistent access, or toolbar for quick toggle

## Installation

### Via Tabby Plugin Manager (Recommended)

1. Open Tabby Terminal
2. Go to Settings → Plugins
3. Type `tabby-ssh-sidebar` in the search box
4. Click Install
5. Restart Tabby

### Manual Installation from NPM

```bash
cd ~/.config/tabby/plugins
npm install tabby-ssh-sidebar
```

Then restart Tabby.

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Install using the script:
   ```bash
   ./install.sh
   ```

5. Restart Tabby

## Usage

### Using the Sidebar Panel

1. After installation, restart Tabby - the sidebar will appear on the left side
2. **Browse Connections**: Scroll through your SSH profiles organized by groups
3. **Search**: Use the search box to filter connections by name, host, or user
4. **Connect**: Left-click any connection to open it in a new tab
5. **Active Indicators**: Green dot shows which connections are currently open
6. **Collapse Groups**: Click group headers to expand/collapse connection lists
7. **Pin Favorites**: Right-click connections and select "Pin to Favorites"
8. **Edit Profiles**: Right-click and select "Edit" to open profile settings directly
9. **Hide Sidebar**: Click the toolbar button to toggle visibility

### Context Menu Options

Right-click any connection in the sidebar to access:
- **Connect**: Open SSH connection in new tab
- **Edit**: Open profile settings (navigates to settings tab and opens profile editor)
- **Pin to Favorites** / **Unpin from Favorites**: Manage favorite connections
- **Delete**: Remove the connection profile

### Managing Favorites

1. Right-click any connection
2. Select "Pin to Favorites"
3. The connection will appear in the "⭐ Favorites" group at the top
4. To unpin, right-click and select "Unpin from Favorites"

### Keyboard-Free Workflow

The sidebar enables a completely mouse-driven workflow - no need to use the command palette or keyboard shortcuts to access your SSH connections.

## Configuration

The plugin stores its configuration in Tabby's settings. Configuration is automatic:

- **Sidebar visibility**: Automatically saved when you toggle the sidebar
- **Pinned favorites**: Automatically saved when you pin/unpin connections
- **Group collapse state**: Automatically saved when you expand/collapse groups

## Requirements

- Tabby Terminal v1.0.197 or later
- Node.js and npm for building

## Development

### Watch mode

For development with auto-rebuild on changes:

```bash
npm run watch
```

### Build

```bash
npm run build
```

## Architecture

This plugin uses several Tabby APIs:

- **ToolbarButtonProvider**: Adds toggle button to main toolbar
- **SSHSidebarService**: Manages sidebar lifecycle and flexbox layout injection
- **ProfilesService**: Retrieves and manages SSH connection profiles
- **ConfigService**: Persists user preferences (favorites, visibility, collapse state)

The sidebar is implemented as a dynamically injected Angular component that modifies the app-root flexbox layout to create a true persistent sidebar panel.

## License

MIT
