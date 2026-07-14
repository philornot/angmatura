// PM2 process config. Run with: pm2 start ecosystem.config.cjs
module.exports = {
	apps: [
		{
			name: 'angmatura',
			script: 'build/index.js',
			cwd: __dirname,
			interpreter: 'node', // swap to 'bun' if you prefer running the built server under Bun
			node_args: '--env-file-if-exists=.env',
			env: {
				NODE_ENV: 'production',
				PORT: process.env.PORT || '3000',
				HOST: '0.0.0.0'
			}
		}
	]
};
