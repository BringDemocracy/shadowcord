#!/bin/bash

# Shadowcord Build Script
# Generates installers for Windows and Linux

echo "🚀 Starting Shadowcord Build Process..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist out

# 3. Compile TypeScript & Vite (Renderer, Main, Preload)
echo "🔨 Compiling source code..."
npm run build

# 4. Build Electron Installers
echo "💿 Building Electron Installers..."

# Check OS to decide what to build first or only
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Building for Linux (AppImage, Deb)..."
    npm run build:linux
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "🪟 Building for Windows (Exe)..."
    npm run build:win
else
    # Fallback or build both if possible/configured (usually cross-compile requires setup)
    # For this script, we assume we are on Linux building for Linux primarily, 
    # but we can try to build for Windows via Wine if installed (electron-builder supports it).
    echo "🐧 Building for Linux..."
    npm run build:linux
    
    # Uncomment to attempt Windows build from Linux (requires Wine)
    # echo "🪟 Attempting Windows build (requires Wine)..."
    # npm run build:win
fi

echo "✅ Build Complete!"
echo "📂 Installers are located in the 'dist/' directory."

