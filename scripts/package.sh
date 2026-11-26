#!/bin/bash
# Builds dist/Handland.app from the Electron runtime plus this project's files.
# (electron-packager exits silently on this Node version, so the bundle is assembled by hand.)
set -euo pipefail
cd "$(dirname "$0")/.."
APP=dist/Handland.app
rm -rf dist && mkdir -p dist build

# App icon, drawn from the game's own cards.
npx electron scripts/icon.mjs
ICONSET=build/icon.iconset; rm -rf "$ICONSET"; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) build/icon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o build/icon.icns

ditto node_modules/electron/dist/Electron.app "$APP"
RES="$APP/Contents/Resources"
rm -rf "$RES/default_app.asar"
mkdir -p "$RES/app"
node -e "const p=require('./package.json');delete p.devDependencies;delete p.scripts;require('fs').writeFileSync('$RES/app/package.json',JSON.stringify(p,null,2))"
ditto src "$RES/app/src"; ditto public "$RES/app/public"; ditto electron "$RES/app/electron"
rm -f "$RES/app/public"/_*   # dev-only helpers (layout audit, art check sheets)
cp RULES.md "$RES/app/"
cp build/icon.icns "$RES/handland.icns" && rm -f "$RES/electron.icns"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/Handland"
PL="$APP/Contents/Info.plist"
pb() { /usr/libexec/PlistBuddy -c "$1" "$PL"; }
V=$(node -p "require('./package.json').version")
pb "Set :CFBundleName Handland"
pb "Set :CFBundleDisplayName Handland"
pb "Set :CFBundleExecutable Handland"
pb "Set :CFBundleIdentifier com.handland.game"
pb "Set :CFBundleIconFile handland.icns"
pb "Set :CFBundleShortVersionString $V"
pb "Set :CFBundleVersion $V"
pb "Delete :ElectronAsarIntegrity" 2>/dev/null || true
pb "Add :LSApplicationCategoryType string public.app-category.card-games" 2>/dev/null || true
pb "Add :NSLocalNetworkUsageDescription string Handland lets friends on your Wi-Fi join your game." 2>/dev/null || true
codesign --force --deep --sign - "$APP" 2>&1 | tail -1
echo "built $APP"
