import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node produces a plain Node server, which is what we run under
			// PM2 on the Raspberry Pi (see scripts/deploy.sh + ecosystem.config.cjs).
			adapter: adapter({
				out: 'build'
			})
		})
	],
	server: {
		// Convenient for testing on a phone on the same LAN during development.
		host: true
	},
	ssr: {
		// Without this, Vite's dev SSR tries to load @lucide/svelte's .svelte
		// files as plain Node modules and fails with ERR_UNKNOWN_FILE_EXTENSION.
		noExternal: ['@lucide/svelte']
	}
});
