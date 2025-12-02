#!/bin/bash

# Tabby SSH Sidebar - Installation Script

set -e

echo "=== Tabby SSH Sidebar Installer ==="
echo

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Build the plugin
echo "Building plugin..."
npm run build

# Find Tabby plugins directory
TABBY_PLUGINS_DIR="$HOME/.config/tabby/plugins"

if [ ! -d "$TABBY_PLUGINS_DIR" ]; then
    echo "Creating Tabby plugins directory: $TABBY_PLUGINS_DIR"
    mkdir -p "$TABBY_PLUGINS_DIR"
fi

# Install the plugin
PLUGIN_DIR="$TABBY_PLUGINS_DIR/node_modules/tabby-ssh-sidebar"
echo "Installing to: $PLUGIN_DIR"

rm -rf "$PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"
cp -r dist package.json "$PLUGIN_DIR/"

echo
echo "=== Installation complete! ==="
echo
echo "Please restart Tabby to load the plugin."
echo
echo "Usage:"
echo "  1. Look for the 'SSH Connections' button in the Tabby toolbar"
echo "  2. Click it to see all your saved SSH connections"
echo "  3. Select a connection to open it in a new tab"
echo
