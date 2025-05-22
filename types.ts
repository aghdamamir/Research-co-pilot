
export interface Paper {
  id: string; // For arXiv, this could be the arXiv ID
  title: string;
  authors: string[];
  abstract: string;
  year?: number;
  doi?: string; // arXiv papers might have DOIs, or this can be null
  bibtex?: string;
  arxivId?: string; // e.g., "2303.18223v1"
  pdfLink?: string; // Direct link to arXiv PDF
}

export interface Section {
  id: string;
  name: string;
  description: string;
  paperIds: string[]; // Store IDs of papers assigned to this section
}

export enum AppStep {
  TOPIC_INPUT = 1,
  PAPER_SELECTION = 2,
  CATEGORIZATION = 3,
  DRAFTING = 4,
}

export interface UserInputs {
  topic: string;
  keywords: string[];
  numPapersToRetrieve: number;
  initialRelatedPapers: string; // Raw text input
}

export type DraftFormat = 'text' | 'latex';

export type ApiProvider = 'gemini' | 'openai';