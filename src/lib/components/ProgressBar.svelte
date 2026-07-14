<script lang="ts">
	let { current, total }: { current: number; total: number } = $props();

	let pct = $derived(total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0);
</script>

<div class="wrap">
	<div class="track" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
		<div class="fill" style="width: {pct}%"></div>
	</div>
	<span class="count mono">{current} / {total}</span>
</div>

<style>
	.wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.track {
		flex: 1;
		height: 6px;
		border-radius: 999px;
		background: var(--rule);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.3s ease;
	}

	.count {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
	}
</style>
