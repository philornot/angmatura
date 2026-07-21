<script lang="ts">
	import '../app.css';
	import {initTheme} from '$lib/theme.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import {page} from '$app/state';
	import {getDeviceId, syncDeviceIdCookie} from '$lib/deviceId';

	let { children } = $props();

	// $effect only ever runs in the browser (never during SSR), so this is a
	// safe place to touch localStorage/matchMedia/document without an
	// explicit browser guard.
	$effect(() => {
		initTheme();
		syncDeviceIdCookie(getDeviceId());
	});
</script>

<div class="shell">
	<header class="masthead">
		<a href="/" class="wordmark">
			<span class="wordmark-main">angmatura</span>
		</a>
		<nav class="nav">
			<a aria-current={page.url.pathname === '/my-sets' ? 'page' : undefined} class="nav-link" href="/my-sets">
				Moje zestawy
			</a>
		</nav>
		<ThemeToggle/>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.masthead {
		padding: 14px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.wordmark {
		display: inline-flex;
		align-items: baseline;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 20px;
		letter-spacing: 0.01em;
		color: var(--ink);
		text-decoration: none;
	}

	.nav {
		flex: 1;
		display: flex;
		justify-content: flex-end;
	}

	.nav-link {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink-soft);
		text-decoration: none;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
	}

	.nav-link:hover {
		background: var(--accent-soft);
		color: var(--accent-ink);
	}

	.nav-link[aria-current='page'] {
		color: var(--accent-ink);
		background: var(--accent-soft);
	}

	main {
		flex: 1;
		padding-bottom: 48px;
	}
</style>
