module.exports = {
    apps: [
        {
            name: 'treasure-hunt-server',
            script: 'server.js',
            cwd: '/root/Treasure_Hunt/server',
            instances: 2,                    // Use both vCPUs (cluster mode)
            exec_mode: 'cluster',           // Cluster mode for load balancing
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            // Restart policies
            max_memory_restart: '500M',      // Restart if memory exceeds 500MB per process
            min_uptime: '10s',               // Consider started after 10s
            max_restarts: 10,                // Max 10 restarts in a row before stopping
            restart_delay: 5000,             // Wait 5s between restarts

            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: '/root/Treasure_Hunt/server/logs/error.log',
            out_file: '/root/Treasure_Hunt/server/logs/output.log',
            merge_logs: true,

            // Watch (disabled in production — use git pull + pm2 restart instead)
            watch: false,

            // Graceful shutdown
            kill_timeout: 10000,             // Match your server's 10s graceful shutdown timeout
            listen_timeout: 10000,
            shutdown_with_message: true
        }
    ]
};
