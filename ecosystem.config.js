module.exports = {
  apps: [
    {
      name: "react-app-api",
      script: "npm",
      args: "run api",
      cwd: "/home/react-app",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
