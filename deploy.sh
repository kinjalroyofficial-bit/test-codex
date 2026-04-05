#!/bin/bash

cd /home/react-app

echo "===== DEPLOY START =====" >> deploy.log

git pull origin main >> deploy.log 2>&1

npm install >> deploy.log 2>&1
npm run build >> deploy.log 2>&1

systemctl restart nginx

echo "===== DEPLOY END =====" >> deploy.log
