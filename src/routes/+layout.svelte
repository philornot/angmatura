<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="shell">
	<header class="masthead">
		<a href="/" class="wordmark">
			<span class="wordmark-main">angmatura</span>
		</a>
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

	.wordmark-dot {
		color: var(--accent);
	}

	main {
		flex: 1;
		padding-bottom: 48px;
	}
</style>
