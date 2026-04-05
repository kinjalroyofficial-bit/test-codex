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

curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
-d chat_id=$CHAT_ID \
-d text="Deployment SUCCESS"