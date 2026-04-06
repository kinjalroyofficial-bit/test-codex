#!/bin/bash
set -e

cd /home/react-app

echo "===== DEPLOY START =====" >> deploy.log

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> deploy.log
}

restart_api() {
  log "Attempting API restart"

  if systemctl list-unit-files | grep -q "^react-app-api.service"; then
    systemctl restart react-app-api >> deploy.log 2>&1
    log "API restarted via systemd: react-app-api.service"
    return
  fi

  if command -v pm2 >/dev/null 2>&1; then
    if [ -f ecosystem.config.js ]; then
      pm2 startOrReload ecosystem.config.js --only react-app-api >> deploy.log 2>&1
      log "API restarted via PM2 ecosystem"
      return
    fi

    pm2 describe react-app-api >/dev/null 2>&1 \
      && pm2 restart react-app-api >> deploy.log 2>&1 \
      || pm2 start npm --name react-app-api -- run api >> deploy.log 2>&1
    log "API restarted via PM2 named process"
    return
  fi

  pkill -f "node server/src/server.js" >> deploy.log 2>&1 || true
  nohup npm run api >> deploy.log 2>&1 &
  log "API restarted via nohup fallback"
}

git fetch origin main >> deploy.log 2>&1
git reset --hard origin/main >> deploy.log 2>&1

npm install >> deploy.log 2>&1
npm run build >> deploy.log 2>&1
restart_api

systemctl restart nginx >> deploy.log 2>&1

echo "===== DEPLOY END =====" >> deploy.log


BOT_TOKEN="8529655539:AAGOIbipfyUuVmA_nQKOu-EpLFHO7pQv-mY"
CHAT_ID="8629852323"
TRIGGER_LABEL="$(git log -1 --pretty=%s | awk '{for (i=1; i<=NF && i<=8; i++) printf "%s%s", $i, (i<NF && i<8 ? " " : "")}')"

curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
-d chat_id=$CHAT_ID \
-d text="Deployment SUCCESS - ${TRIGGER_LABEL:-main update}"
