
import OpenAI from 'openai';
import { Paper, Section, UserInputs } from '../types';
import { OPENAI_TEXT_MODEL } from '../constants';

// Fix: Use process.env.API_KEY as per guidelines
const OPENAI_API_KEY_ENV = process.env.API_KEY;
let effectiveOpenAIKey = OPENAI_API_KEY_ENV;
let isKeyProblematic = false;

// Check for common issues with the API key
if (!OPENAI_API_KEY_ENV || 
    OPENAI_API_KEY_ENV === "YOUR_ACTUAL_OPENAI_API_KEY_HERE" || // A common placeholder user might forget to change
    OPENAI_API_KEY_ENV.startsWith("sk-proj-dA0zD")) { // Example prefix of a known compromised key you mentioned

  if (!OPENAI_API_KEY_ENV) {
    // Fix: Updated warning message to refer to API_KEY
    console.error("CRITICAL: OpenAI API key (API_KEY) is missing in your .env file.");
  } else if (OPENAI_API_KEY_ENV === "YOUR_ACTUAL_OPENAI_API_KEY_HERE") {
    // Fix: Updated warning message to refer to API_KEY
    console.error("CRITICAL: OpenAI API key (API_KEY) is still the placeholder string in your .env file.");
  } else if (OPENAI_API_KEY_ENV.startsWith("sk-proj-dA0zD")) {
    // Fix: Updated warning message to refer to API_KEY
    console.error("CRITICAL: OpenAI API key (API_KEY) in your .env file appears to be a publicly compromised key. Please invalidate it immediately in your OpenAI dashboard and set a new, private key.");
  }
  // Fix: Updated warning message to refer to API_KEY
  console.error("OpenAI features will not work correctly. Please ensure API_KEY is set to your valid, private OpenAI API key in your .env file.");
  effectiveOpenAIKey = "MISSING_OR_COMPROMISED_OPENAI_KEY"; // Use a dummy key; API calls will fail
  isKeyProblematic = true;
}

const openai = new OpenAI({
  apiKey: effectiveOpenAIKey,
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

const parseJsonFromTextOpenAI = <T,>(text: string | null | undefined): T | null => {
  if (!text) return null;
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("OpenAI - Failed to parse JSON response:", e, "Original text:", text);
    return null;
  }
};

export const suggestKeywordsOpenAI = async (topic: string, existingKeywords: string[]): Promise<string[]> => {
  if (isKeyProblematic) return [];
  try {
    const promptContent = `Based on the research topic "${topic}" and existing keywords [${existingKeywords.join(', ')}], suggest up to 5 additional relevant keywords.
Return STRICTLY as a JSON object with a single key "keywords" whose value is an array of strings.
Example: { "keywords": ["keyword1", "keyword2"] }.
If no new keywords can be suggested, the value for "keywords" should be an empty JSON array [].`;

    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{ role: "user", content: promptContent }],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const rawJson = response.choices[0].message.content;
    const parsedObject = parseJsonFromTextOpenAI<{keywords: string[]}>(rawJson);
    return parsedObject?.keywords || [];

  } catch (error) {
    console.error("OpenAI - Error suggesting keywords:", error);
    return [];
  }
};

export const generateArxivQueryOpenAI = async (originalTopic: string, originalKeywords: string[], selectedPapersSnippets: {title: string, abstract: string}[]): Promise<string> => {
  if (isKeyProblematic) return `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback
  try {
    let context = `Original research topic: "${originalTopic}"\nOriginal keywords: ${originalKeywords.join(', ')}\n\n`;
    if (selectedPapersSnippets.length > 0) {
      context += `The user has also selected the following papers as relevant. Generate a new arXiv search query string that incorporates insights from these, focusing on finding *more* papers like them, or papers that bridge themes between them and the original topic:\n`;
      selectedPapersSnippets.forEach(p => {
        context += `- Title: ${p.title}\n  Abstract Snippet: ${p.abstract.substring(0, 200)}...\n`;
      });
    } else {
      context += `Generate an improved arXiv search query string based on the original topic and keywords.`;
    }
    
    const promptContent = `${context}\n\nGenerate a concise and effective search query string suitable for the arXiv API (use boolean operators like AND, OR, NOT if helpful, and parentheses for grouping if needed, but often just well-chosen keywords work best).
Return ONLY the raw query string, no explanations, no JSON, just the string.
For example: "quantum entanglement AND (bell test OR non-locality)" OR "deep learning for video action recognition".
The query should be a single line of text.`;

    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{ role: "user", content: promptContent }],
      temperature: 0.6,
    });

    const newQuery = response.choices[0].message.content?.trim().replace(/\n/g, " ");
    return newQuery || `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback
  } catch (error) {
    console.error("OpenAI - Error generating arXiv query:", error);
    return `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback to original query
  }
};


export const suggestSectionsOpenAI = async (selectedPapers: Paper[], numSections: number): Promise<Omit<Section, 'id' | 'paperIds'>[]> => {
  if (isKeyProblematic) return [];
  try {
    const paperInfos = selectedPapers.map(p => `ID: ${p.arxivId || p.id}, Title: ${p.title}; Abstract: ${p.abstract.substring(0, 200)}...`).join('\n');
    const promptContent = `Based on the following selected research papers:\n${paperInfos}\n\nSuggest ${numSections} distinct categories or section names for a 'Related Work' chapter.
Return STRICTLY as a JSON object with a single key "sections" whose value is an array of section objects. Each section object MUST have "name" (string) and "description" (string, 1-2 sentences).
Example: { "sections": [{"name": "Category A", "description": "Covers X."}, {"name": "Category B", "description": "Discusses Y."}] }`;

    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{ role: "user", content: promptContent }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const rawJson = response.choices[0].message.content;
    const parsedObject = parseJsonFromTextOpenAI<{ sections: Omit<Section, 'id' | 'paperIds'>[] }>(rawJson);
    return parsedObject?.sections || [];
  } catch (error) {
    console.error("OpenAI - Error suggesting sections:", error);
    return [];
  }
};

export type SectionPaperAssignments = Record<string, string[]>; // Using string for Section ID key

export const assignPapersToSectionsOpenAI = async (papers: Paper[], sections: Omit<Section, 'paperIds'>[]): Promise<SectionPaperAssignments> => {
    if (isKeyProblematic) return {};
    try {
    const paperDetails = papers.map(p => `Paper ID: ${p.arxivId || p.id}\nTitle: ${p.title}\nAbstract: ${p.abstract.substring(0, 300)}...`).join('\n\n');
    const sectionDetails = sections.map(s => `Section ID: ${s.id}\nName: ${s.name}\nDescription: ${s.description}`).join('\n\n');

    const promptContent = `Given these papers:
${paperDetails}

And these sections:
${sectionDetails}

Assign each paper to the MOST RELEVANT section. A paper should ideally be assigned to only one section.
Return STRICTLY as a JSON object. Keys are Section IDs (use the provided Section IDs exactly), values are arrays of Paper IDs (use the provided Paper IDs, e.g. arXiv IDs).
Example: { "section-id-1": ["paper-arxiv-id-A"], "section-id-2": ["paper-arxiv-id-C", "paper-arxiv-id-D"] }
Ensure all provided Section IDs are keys in the output, even if the array of Paper IDs is empty.`;

    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{ role: "user", content: promptContent }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    const rawJson = response.choices[0].message.content;
    const assignments = parseJsonFromTextOpenAI<SectionPaperAssignments>(rawJson);
    
    if (assignments) {
        sections.forEach(sec => {
            if (!assignments[sec.id]) {
                assignments[sec.id] = [];
            } else if (!Array.isArray(assignments[sec.id])) {
                console.warn(`OpenAI - Assignments for section ${sec.id} was not an array, correcting.`);
                assignments[sec.id] = [];
            }
        });
    }
    return assignments || {};

  } catch (error) {
    console.error("OpenAI - Error assigning papers to sections:", error);
    return {};
  }
};

export const draftRelatedWorkOpenAI = async (sections: Section[], papers: Paper[], format: 'text' | 'latex' = 'text'): Promise<string> => {
  // Fix: Updated warning message to refer to API_KEY
  if (isKeyProblematic) return "OpenAI API key (API_KEY) missing, placeholder, or compromised. Cannot generate draft.";
  try {
    const sectionsWithPapers = sections.filter(sec => sec.paperIds.length > 0);
    if (sectionsWithPapers.length === 0) return "No sections have papers assigned.";
    
    const papersToIncludeInDraft = papers.filter(p => 
        sectionsWithPapers.some(sec => sec.paperIds.includes(p.id))
    );
    if (papersToIncludeInDraft.length === 0) return "No papers are assigned to any active section.";

    const sectionsData = sectionsWithPapers.map(sec => {
      const sectionPapers = papersToIncludeInDraft.filter(p => sec.paperIds.includes(p.id));
      const citationHint = sectionPapers[0]?.arxivId ? `[arXiv:${sectionPapers[0].arxivId}]` : (sectionPapers[0]?.doi ? `[DOI:${sectionPapers[0].doi}]` : `[AuthorYear]`);
      return `Section: ${sec.name}\nDescription: ${sec.description}\nPapers to include in this section (cite them appropriately, e.g. ${citationHint}):\n${sectionPapers.map(p => `- ${p.title} by ${p.authors.join(', ')} (${p.year || 'N/A'}) (arXiv:${p.arxivId || 'N/A'})`).join('\n')}`;
    }).join('\n\n');

    const allPaperDetails = papersToIncludeInDraft.map(p => `Title: ${p.title}\nAuthors: ${p.authors.join(', ')}\nYear: ${p.year}\nAbstract: ${p.abstract}\nDOI: ${p.doi || 'N/A'}\narXiv ID: ${p.arxivId || 'N/A'}`).join('\n---\n');

    const promptContent = `You are an academic writing assistant. Write a 'Related Work' section.
Use this structure and content:
${sectionsData}

Detailed paper info (abstracts are important):
${allPaperDetails}

Output coherent academic text. Smooth transitions. Cite papers naturally using author, year, arXiv ID, or DOI.
Example: "Author et al. (${papersToIncludeInDraft[0]?.year || 'YYYY'}) [arXiv:${papersToIncludeInDraft[0]?.arxivId || 'xxxx.xxxx'}] investigated..."
${format === 'latex' ? "Format as LaTeX: \\section{} for titles, \\cite{arXivID} for citations." : "Format as plain text."}
Do not include a main "Related Work" title, start with the first section.`;
    
    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{role: "user", content: promptContent}],
      temperature: 0.7,
    });

    return response.choices[0].message.content || "OpenAI - Failed to generate draft content.";
  } catch (error) {
    console.error("OpenAI - Error drafting related work:", error);
    // Fix: Updated warning message to refer to API_KEY
    return "OpenAI - Error generating draft. Please try again. Check API_KEY.";
  }
};

export const refineDraftOpenAI = async (currentDraft: string, userQuery: string, format: 'text' | 'latex' = 'text'): Promise<string> => {
  // Fix: Updated warning message to refer to API_KEY
  if (isKeyProblematic) return currentDraft + "\n\n(OpenAI API key (API_KEY) missing, placeholder, or compromised for refinement.)";
  try {
    const promptContent = `Current draft:
--- DRAFT START ---
${currentDraft}
--- DRAFT END ---

User request: "${userQuery}".
Revise the draft. Output the fully revised related work section.
${format === 'latex' ? "Ensure output is valid LaTeX." : "Ensure output is plain text."}`;

    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      messages: [{role: "user", content: promptContent}],
      temperature: 0.5,
    });
    return response.choices[0].message.content || currentDraft;
  } catch (error) {
    console.error("OpenAI - Error refining draft:", error);
    // Fix: Updated warning message to refer to API_KEY
    return currentDraft + `\n\nOpenAI - Error refining draft: ${ (error as Error).message }. Check API_KEY.`;
  }
};