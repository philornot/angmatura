import { describe, expect, it } from 'vitest';
import { renderExplanationMarkdown } from './markdownLite';

describe('renderExplanationMarkdown', () => {
	it('wraps plain text in a single paragraph', () => {
		expect(renderExplanationMarkdown('hello world')).toBe('<p>hello world</p>');
	});

	it('renders **bold** as <strong>', () => {
		expect(renderExplanationMarkdown('this is **important**')).toBe(
			'<p>this is <strong>important</strong></p>'
		);
	});

	it('renders *italic* as <em>', () => {
		expect(renderExplanationMarkdown('this is *emphasized*')).toBe(
			'<p>this is <em>emphasized</em></p>'
		);
	});

	it('renders `code` as <code>', () => {
		expect(renderExplanationMarkdown('use `would have`')).toBe(
			'<p>use <code>would have</code></p>'
		);
	});

	it('handles bold and italic together without cross-contamination', () => {
		expect(renderExplanationMarkdown('**bold** and *italic*')).toBe(
			'<p><strong>bold</strong> and <em>italic</em></p>'
		);
	});

	it('splits blank-line-separated text into multiple paragraphs', () => {
		const result = renderExplanationMarkdown('First paragraph.\n\nSecond paragraph.');
		expect(result).toBe('<p>First paragraph.</p><p>Second paragraph.</p>');
	});

	it('escapes HTML so injected tags render as inert text, not markup', () => {
		const result = renderExplanationMarkdown('<script>alert(1)</script>');
		expect(result).not.toContain('<script>');
		expect(result).toContain('&lt;script&gt;');
	});

	it('escapes HTML even alongside legitimate markdown emphasis', () => {
		const result = renderExplanationMarkdown('**bold** <img src=x onerror=alert(1)>');
		expect(result).toContain('<strong>bold</strong>');
		expect(result).not.toContain('<img');
		expect(result).toContain('&lt;img');
	});
});