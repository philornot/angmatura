<script lang="ts">
	import SetTypeBadge from '$lib/components/SetTypeBadge.svelte';
	import FloatingCreateButton from '$lib/components/FloatingCreateButton.svelte';
	import SectionQuickNav from '$lib/components/SectionQuickNav.svelte';
	import type {SetType} from '$lib/types';
	import {ArrowRight, Star} from '@lucide/svelte';
	import {getDeviceId} from '$lib/deviceId';
	import {czekaForm, pytanieForm} from '$lib/polishPlural';

	let { data } = $props();

	const SECTION_TITLES: Record<SetType, string> = {
		kwt: 'Key Word Transformations',
		grammar: 'Gramatykalizacja',
		translation: 'Tłumaczenia'
	};

	const ORDER: SetType[] = ['kwt', 'grammar', 'translation'];

	// Feeds the desktop quick-nav — only the section types that actually have
	// sets right now, in page order. The nav itself only renders once there
	// are 2+ of these (see SectionQuickNav / the template below): with a
	// single section there's nothing to jump *between*.
	let visibleSections = $derived(
			ORDER.filter((t) => data.groups[t].length > 0).map((t) => ({type: t, label: SECTION_TITLES[t]}))
	);

	// deviceId lives only in localStorage, so we can't know the due count
	// during SSR — fetch it client-side and keep the banner hidden until we
	// actually know there's something to review (spec: no due items = no banner).
	let dueCount = $state(0);

	$effect(() => {
		const deviceId = getDeviceId();
		if (!deviceId) return;
		fetch(`/api/review/count?deviceId=${encodeURIComponent(deviceId)}`)
				.then((r) => (r.ok ? r.json() : null))
				.then((result: { count: number } | null) => {
					if (result) dueCount = result.count;
				})
				.catch(() => {
					// Silent failure — banner simply stays hidden, which is the safe default.
				});
	});
</script>

<svelte:head>
	<title>angmatura — ćwiczenia z angielskiego na maturę</title>
</svelte:head>

<div class="container">
	{#if visibleSections.length > 1}
		<SectionQuickNav sections={visibleSections}/>
	{/if}

	{#if dueCount > 0}
		<a href="/review" class="hero card">
			<div class="hero-text">
				<p class="eyebrow mono">powtórki</p>
				<h1>Powtórz to, co Ci nie idzie</h1>
				<p class="hero-sub">
					{czekaForm(dueCount)} {dueCount} {pytanieForm(dueCount)} z Twoich wcześniejszych błędów, dobranych
					automatycznie.
				</p>
			</div>
			<ArrowRight class="hero-arrow" size={28} aria-hidden="true"/>
		</a>
	{/if}

	{#if data.featured.length > 0}
		<section class="section featured-section">
			<div class="section-head">
				<h2 class="with-icon"><Star size={18} fill="currentColor" aria-hidden="true" /> Polecane</h2>
			</div>
			<ul class="set-list">
				{#each data.featured as set (set.id)}
					<li>
						<a href="/set/{set.slug}" class="set-card featured-card card">
							<SetTypeBadge type={set.type} />
							<span class="set-title">{set.title}</span>
							{#if set.sourceLabel}
								<span class="set-source">{set.sourceLabel}</span>
							{/if}
							<span class="set-count mono">{set.questionCount} pytań</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#each ORDER as type (type)}
		{#if data.groups[type].length > 0}
			<section class="section" id="section-{type}" data-section-type={type}>
				<div class="section-head">
					<h2>{SECTION_TITLES[type]}</h2>
				</div>
				<ul class="set-list">
					{#each data.groups[type] as set (set.id)}
						<li>
							<a href="/set/{set.slug}" class="set-card card">
								<span class="set-title">{set.title}</span>
								{#if set.sourceLabel}
									<span class="set-source">{set.sourceLabel}</span>
								{/if}
								<span class="set-count mono">{set.questionCount} pytań</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}

	{#if ORDER.every((t) => data.groups[t].length === 0)}
		<p class="empty">Nie ma jeszcze żadnych publicznych zestawów.</p>
	{/if}

	<footer class="footer">
		<FloatingCreateButton href="/create"/>
	</footer>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		gap: 36px;
		padding-top: 12px;
	}

	.hero {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 26px 22px;
		background: var(--accent);
		color: white;
		text-decoration: none;
		border-left: none;
	}

	/* The solid accent + white-text combo that works in light mode reads as
	   glaring against a dark page — swap to the same softened accent-soft /
	   accent-ink pairing used for lower-emphasis accent surfaces elsewhere
	   (e.g. QuestionCard's hint reveal) instead of a bright solid block. */
	:global([data-theme='dark']) .hero {
		background: var(--accent-soft);
		color: var(--accent-ink);
	}

	:global([data-theme='dark']) .hero h1 {
		color: var(--accent-ink);
	}

	.hero-text {
		flex: 1;
	}

	.eyebrow {
		font-size: 12px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.8;
		margin-bottom: 6px;
	}

	.hero h1 {
		color: white;
		font-size: 26px;
	}

	.hero-sub {
		margin-top: 8px;
		opacity: 0.88;
		font-size: 14px;
		max-width: 46ch;
	}

	:global(.hero-arrow) {
		flex-shrink: 0;
	}

	.with-icon {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		scroll-margin-top: 20px;
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.set-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.set-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 18px;
		text-decoration: none;
		color: var(--ink);
		border-left: 4px solid var(--rule);
	}

	.set-card:hover {
		border-left-color: var(--accent);
	}

	.featured-card {
		border-left-color: var(--accent);
		background: var(--accent-soft);
	}

	.set-title {
		flex: 1;
		font-weight: 600;
	}

	.set-source {
		font-size: 13px;
		color: var(--muted);
	}

	.set-count {
		font-size: 12px;
		color: var(--muted);
		white-space: nowrap;
	}

	.empty {
		color: var(--muted);
		text-align: center;
		padding: 40px 0;
	}

	.footer {
		display: flex;
		justify-content: center;
		padding-top: 8px;
	}
</style>
