module.exports = {
  apps: [{
    name: 'ticketwise',
    script: 'npm',
    args: 'run start:prod:vite',
    env: {
      NODE_ENV: 'production',
      PORT: 5173
    },
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
} 