<script lang="ts">
	import '../app.css';
	import {initTheme} from '$lib/theme.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import SecretAdminAccess from '$lib/components/SecretAdminAccess.svelte';
	import {page} from '$app/state';
	import {goto} from '$app/navigation';
	import {getDeviceId, syncDeviceIdCookie} from '$lib/deviceId';

	let { children } = $props();

	// $effect only ever runs in the browser (never during SSR), so this is a
	// safe place to touch localStorage/matchMedia/document without an
	// explicit browser guard.
	$effect(() => {
		initTheme();
		syncDeviceIdCookie(getDeviceId());
	});

	// Hidden admin-panel entry point, mobile-friendly half: clicking the
	// wordmark logo this many times in a row jumps to /admin. Works
	// identically on touch and mouse, so it's the one method available on
	// every device (the corner-hover reveal in SecretAdminAccess is a
	// desktop-only shortcut on top of this).
	const LOGO_CLICKS_TO_UNLOCK = 7;
	// Clicks more than this far apart don't count towards the streak —
	// someone idly clicking the logo once an hour over a week shouldn't
	// eventually trip this by accident.
	const LOGO_CLICK_RESET_MS = 1500;

	let logoClickCount = 0;
	let logoLastClickAt = 0;

	function handleLogoClick(event: MouseEvent) {
		const now = Date.now();
		logoClickCount = now - logoLastClickAt > LOGO_CLICK_RESET_MS ? 1 : logoClickCount + 1;
		logoLastClickAt = now;

		if (logoClickCount >= LOGO_CLICKS_TO_UNLOCK) {
			logoClickCount = 0;
			// The logo is a normal link to "/" — once the counter trips we
			// want to go to /admin instead, not follow that link.
			event.preventDefault();
			void goto('/admin');
		}
	}
</script>

<div class="shell">
	<header class="masthead">
		<a class="wordmark" href="/" onclick={handleLogoClick}>
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

<SecretAdminAccess/>

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
