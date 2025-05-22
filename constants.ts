
// Gemini API Models
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';

// OpenAI API Models
// Changed to 'gpt-4o-latest' as per user's request.
// Ensure your API key has access to this model.
export const OPENAI_TEXT_MODEL = 'chatgpt-4o-latest'; 

export const DEFAULT_API_PROVIDER = 'gemini' as const; // or 'openai'

export const MAX_KEYWORDS_SUGGESTION = 5;
export const DEFAULT_NUM_PAPERS_TO_RETRIEVE = 10;
export const DEFAULT_NUM_SECTIONS = 3;

export const APP_TITLE = "Related Work Co-pilot";
export const STEPS_CONFIG = [
  { id: 1, name: "Topic & Keywords" },
  { id: 2, name: "Paper Selection" },
  { id: 3, name: "Categorization" },
  { id: 4, name: "Drafting & Export" },
];

// Removed MOCK_AUTHORS as it's no longer used for fallback data.
// export const MOCK_AUTHORS = ["Innovator, A.", "Researcher, B.", "Scientist, C.", "Developer, D."];
