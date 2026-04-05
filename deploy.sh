#!/bin/bash
set -e

cd /home/react-app

echo "===== DEPLOY START =====" >> deploy.log

git fetch origin main >> deploy.log 2>&1
git reset --hard origin/main >> deploy.log 2>&1

npm install >> deploy.log 2>&1
npm run build >> deploy.log 2>&1

systemctl restart nginx >> deploy.log 2>&1

echo "===== DEPLOY END =====" >> deploy.log


BOT_TOKEN="8529655539:AAGOIbipfyUuVmA_nQKOu-EpLFHO7pQv-mY"
CHAT_ID="8629852323"
TRIGGER_LABEL="$(git log -1 --pretty=%s | awk '{for (i=1; i<=NF && i<=8; i++) printf "%s%s", $i, (i<NF && i<8 ? " " : "")}')"

curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
-d chat_id=$CHAT_ID \
-d text="Deployment SUCCESS - ${TRIGGER_LABEL:-main update}"
