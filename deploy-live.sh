#!/usr/bin/env bash
set -Eeuo pipefail

# ===== Config =====
REPO_SSH="git@github.com:BoozedBunny/bbtown.git"
BRANCH="main"
DEPLOY_DIR="/root/bbtown"
MEDIA_SOURCE="/root/bbTownMedia/media"
MEDIA_TARGET_REL="apps/web/public/media"

PM2_BIN="${PM2_BIN:-}"
WEB_PM2_NAME="bbtown"
CMS_PM2_NAME="bbtown-cms"

echo "🚀 Starting monorepo deployment..."

# 1) Repo aktualisieren/klonen
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "📥 Updating repository in $DEPLOY_DIR..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
  git clean -fd
else
  echo "📦 Cloning repository to $DEPLOY_DIR..."
  mkdir -p "$(dirname "$DEPLOY_DIR")"
  git clone --depth=1 --branch "$BRANCH" "$REPO_SSH" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# 2) DB per Docker Compose hochfahren (Strapi läuft auf diesem Server via PM2, nicht via Docker-Image)
echo "🐳 Ensuring postgres container is up..."
docker compose up -d postgres
# optional warten bis DB healthcheck grün ist
for i in {1..30}; do
  if docker compose ps postgres | grep -q "healthy"; then
    break
  fi
  echo "⏳ waiting for postgres healthcheck... ($i/30)"
  sleep 2
done

# 3) Workspace dependencies + Builds
echo "⚙️ Installing dependencies (workspaces) ..."
npm ci

echo "🏗️ Building web workspace ..."
npm run build:web

echo "🏗️ Building cms workspace ..."
rm -rf "$DEPLOY_DIR/apps/cms/.cache" "$DEPLOY_DIR/apps/cms/build"
npm run build --workspace cms

# 4) Media Symlink (Monorepo-Pfad!)
echo "🔗 Updating media symlink ..."
mkdir -p "$DEPLOY_DIR/apps/web/public"
ln -sfn "$MEDIA_SOURCE" "$DEPLOY_DIR/$MEDIA_TARGET_REL"
chmod -R 755 "$MEDIA_SOURCE"

# 5) PM2 Bin auflösen (live: meist einfach "pm2" im PATH)
if [ -n "$PM2_BIN" ] && [ -x "$PM2_BIN" ]; then
  :
elif command -v pm2 >/dev/null 2>&1; then
  PM2_BIN="$(command -v pm2)"
elif [ -x "/root/.hermes/node/bin/pm2" ]; then
  PM2_BIN="/root/.hermes/node/bin/pm2"
else
  echo "❌ PM2 not found (neither in PATH nor /root/.hermes/node/bin/pm2)"
  exit 1
fi

echo "ℹ️ Using PM2 binary: $PM2_BIN"

echo "🔄 Recreating web app via PM2 ($WEB_PM2_NAME)..."
if "$PM2_BIN" describe "$WEB_PM2_NAME" >/dev/null 2>&1; then
  "$PM2_BIN" delete "$WEB_PM2_NAME" || true
fi
"$PM2_BIN" start "npm run start --workspace web" --name "$WEB_PM2_NAME" --cwd "$DEPLOY_DIR"

# 6) CMS via PM2 aus Workspace starten (kein Docker-Image-Run)
echo "🔄 Recreating CMS app via PM2 ($CMS_PM2_NAME)..."
if "$PM2_BIN" describe "$CMS_PM2_NAME" >/dev/null 2>&1; then
  "$PM2_BIN" delete "$CMS_PM2_NAME" || true
fi
"$PM2_BIN" start "npm run start --workspace cms" --name "$CMS_PM2_NAME" --cwd "$DEPLOY_DIR"

# 7) Kurz-Healthchecks
sleep 2
"$PM2_BIN" list
curl -fsSI http://127.0.0.1:3000 >/dev/null
curl -fsSI http://127.0.0.1:1337/admin >/dev/null

"$PM2_BIN" save || true

echo "✅ Deployment finished successfully."
echo "   Repo: $DEPLOY_DIR"
echo "   Branch: $BRANCH"
echo "   Web PM2: $WEB_PM2_NAME"
echo "   CMS PM2: $CMS_PM2_NAME"
echo "   Postgres container: bbtown-postgres"
