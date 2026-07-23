<script lang="ts">
	import {page} from '$app/state';
	import {goto} from '$app/navigation';
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';

	let { data } = $props();
	let set = $derived(data.set);

	let shareUrl = $derived(`${page.url.origin}/set/${set.slug}`);
	let showShareBanner = $derived(page.url.searchParams.get('created') === '1' && !set.isPublic);
	let copied = $state(false);

	// The device id no longer needs to travel in the URL — the root layout
	// mirrors it into a cookie on every page load (`syncDeviceIdCookie`), and
	// the server reads it from there to recognize "this browser created this
	// set" and open the original for editing instead of forking a copy (the
	// "quiet account" system). This is just a plain navigation now.
	function goToEdit() {
		goto(`/edit/${set.slug}`);
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard API unavailable (e.g. insecure context) — the link is still
			// visible in the banner for the user to select and copy manually.
		}
	}
</script>

<svelte:head>
	<title>{set.title} — angmatura</title>
</svelte:head>

<div class="container page">
	{#if showShareBanner}
		<div class="share-banner">
			<p>
				Ten zestaw jest prywatny — nie pojawi się na stronie głównej. Zapisz ten link, żeby móc
				do niego wrócić:
			</p>
			<div class="share-row">
				<input class="share-input mono" type="text" readonly value={shareUrl} onclick={(e) => e.currentTarget.select()} />
				<button type="button" class="btn btn-secondary" onclick={copyLink}>
					{copied ? 'Skopiowano!' : 'Skopiuj link'}
				</button>
			</div>
		</div>
	{/if}

	<div class="head">
		<SetTypeBadge type={set.type} />
		<h1>{set.title}</h1>
		{#if set.sourceLabel}
			<p class="source">{set.sourceLabel}</p>
		{/if}
		<p class="count mono">{set.questionCount} pytań</p>
	</div>

	<div class="modes">
		<a href="/set/{set.slug}/study" class="mode-card card">
			<h2>Nauka</h2>
			<p>Jedno pytanie na raz, z natychmiastową informacją zwrotną i podpowiedziami.</p>
		</a>
		<a href="/set/{set.slug}/exam" class="mode-card card">
			<h2>Egzamin</h2>
			<p>Cały zestaw na raz, jak na maturze. Wynik na końcu, bez podpowiedzi po drodze.</p>
		</a>
	</div>

	<button class="edit-link" onclick={goToEdit} type="button">Edytuj / skopiuj ten zestaw</button>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding-top: 8px;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.head h1 {
		font-size: 24px;
	}

	.source,
	.count {
		font-size: 13px;
		color: var(--muted);
	}

	.modes {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.mode-card {
		display: block;
		padding: 20px;
		text-decoration: none;
		color: var(--ink);
		border-left: 4px solid var(--accent);
	}

	.mode-card h2 {
		font-size: 18px;
		margin-bottom: 6px;
	}

	.mode-card p {
		font-size: 14px;
		color: var(--ink-soft);
	}

	.edit-link {
		align-self: center;
		font: inherit;
		font-size: 13px;
		color: var(--muted);
		text-decoration: underline;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.share-banner {
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--accent-soft);
		color: var(--accent-ink);
		padding: 14px;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.share-row {
		display: flex;
		gap: 8px;
	}

	.share-input {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--accent);
		background: var(--paper-raised);
		color: var(--ink);
		font-size: 13px;
	}
</style>
