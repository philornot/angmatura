<script lang="ts">
	let { correct, size = 22 }: { correct: boolean; size?: number } = $props();
</script>

{#if correct}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="11" fill="var(--correct-soft)" />
		<path
			d="M7 12.5l3.2 3.2L17 9"
			stroke="var(--correct)"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{:else}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="11" fill="var(--incorrect-soft)" />
		<path
			d="M8.5 8.5l7 7M15.5 8.5l-7 7"
			stroke="var(--incorrect)"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/if}
