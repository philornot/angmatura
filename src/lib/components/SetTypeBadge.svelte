<script lang="ts">
	import type { SetType } from '$lib/types';

	let { type }: { type: SetType } = $props();

	const LABELS: Record<SetType, string> = {
		kwt: 'KWT',
		grammar: 'Gramatykalizacja',
		translation: 'Tłumaczenia'
	};
</script>

<span class="badge" data-type={type}>{LABELS[type]}</span>

<style>
	.badge {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		padding: 4px 9px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-ink);
	}

	.badge[data-type='grammar'] {
		background: #eef3e3;
		color: #4a6b1f;
	}

	.badge[data-type='translation'] {
		background: #f6e9df;
		color: #8a4a1f;
	}
</style>
