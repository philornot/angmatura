<script lang="ts">
	import '../app.css';
	import {initTheme} from '$lib/theme.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();

	// $effect only ever runs in the browser (never during SSR), so this is a
	// safe place to touch localStorage/matchMedia/document without an
	// explicit browser guard.
	$effect(() => {
		initTheme();
	});
</script>

<div class="shell">
	<header class="masthead">
		<a href="/" class="wordmark">
			<span class="wordmark-main">angmatura</span>
		</a>
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

	main {
		flex: 1;
		padding-bottom: 48px;
	}
</style>
