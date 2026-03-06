module.exports = {
    apps: [{
        name: 'blockrevoke-indexer',
        script: 'dist/main.js',
        node_args: '--max-old-space-size=2048',
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        max_restarts: 50,
        restart_delay: 5000,
        watch: false,
        max_memory_restart: '3G',
        env: {
            NODE_ENV: 'production',
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: '/var/log/blockrevoke/error.log',
        out_file: '/var/log/blockrevoke/out.log',
        merge_logs: true,
    }],
};
