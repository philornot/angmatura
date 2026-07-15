export type SetType = 'kwt' | 'grammar' | 'translation';

/** A worksheet (zestaw) — a collection of questions of one exercise type. */
export interface SetSummary {
	id: number;
	slug: string;
	customSlug: string | null;
	title: string;
	sourceLabel: string | null;
	type: SetType;
	isPublic: boolean;
	isFeatured: boolean;
	parentSlug: string | null;
	createdAt: string;
	questionCount: number;
}

/** A single question, with JSON columns already parsed. */
export interface Question {
	id: number;
	setId: number;
	position: number;
	sentence1: string;
	sentence2WithGap: string;
	keyword: string;
	correctAnswer: string;
	alternativeAnswers: string[];
	exampleWrongAnswers: string[];
	explanation: string | null;
	grammarTags: string[];
	minWords: number;
	maxWords: number;
}

/** A question as it should be sent to the client BEFORE it has been answered —
 *  never include the answer key here. */
export type QuestionPrompt = Pick<
	Question,
	'id' | 'setId' | 'position' | 'sentence1' | 'sentence2WithGap' | 'keyword' | 'grammarTags' | 'minWords' | 'maxWords'
>;

export interface CheckResult {
	isCorrect: boolean;
	given: string;
	correctAnswer: string;
	alternativeAnswers: string[];
	explanation: string | null;
}

export interface Attempt {
	id: number;
	setId: number;
	slug: string;
	score: number;
	total: number;
	createdAt: string;
}

export interface AnswerRow {
	id: number;
	attemptId: number;
	questionId: number;
	given: string | null;
	isCorrect: boolean;
}

export interface QuestionProgress {
	deviceId: string;
	questionId: number;
	box: number;
	nextDueAt: string | null;
	lastResult: number | null;
	attempts: number;
	updatedAt: string;
}

/** Shape produced by the Gemini bulk-import call, and consumed by the review editor. */
export interface AiGeneratedQuestion {
	sentence1?: string;
	sentence2WithGap: string;
	keyword?: string;
	correctAnswer: string;
	alternativeAnswers?: string[];
	maxWords?: number;
	minWords?: number;
}

export interface AiGeneratedSet {
	type: SetType;
	suggestedTitle?: string;
	questions: AiGeneratedQuestion[];
}
