/**
 * Deliberately minimal markdown renderer for AI-generated explanation text
 * (see generateExplanation in $lib/server/gemini). This is NOT a general
 * markdown parser — Gemini's explanations are a couple of prose paragraphs
 * with occasional bold/italic/code emphasis, so that's all this needs to
 * cover. Anything fancier (tables, headers, nested lists) is intentionally
 * left as literal text rather than guessed at.
 *
 * HTML is escaped BEFORE any markdown substitution, so even if a malicious
 * screenshot tried to prompt-inject Gemini into emitting `<script>` or
 * similar, it renders as inert literal text rather than being interpreted.
 */

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Renders a small subset of markdown to safe HTML: **bold**, *italic*, `code`, paragraphs. */
export function renderExplanationMarkdown(raw: string): string {
	const escaped = escapeHtml(raw);

	const paragraphs = escaped
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	// Fall back to treating the whole thing as one paragraph if there were no
	// blank-line breaks (the common case for a short explanation).
	const blocks = paragraphs.length > 0 ? paragraphs : [escaped.trim()];

	return blocks
		.map((block) => {
			const inline = block
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/`([^`]+)`/g, '<code>$1</code>')
				// Single-asterisk italics — run after **bold** so "**x**" isn't
				// half-matched as italic first. Avoids matching an already-replaced
				// <strong> tag's asterisks (there are none left at this point).
				.replace(/\*([^*]+)\*/g, '<em>$1</em>')
				.replace(/\n/g, '<br />');
			return `<p>${inline}</p>`;
		})
		.join('');
}