
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { Paper, Section, UserInputs } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

// Fix: Use process.env.API_KEY as per guidelines
const API_KEY = process.env.API_KEY;

// Fix: Adjusted to use process.env.API_KEY for initialization, ensuring consistent API key source.
const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" });

if (!API_KEY) {
  console.warn(
    // Fix: Updated warning message to refer to API_KEY
    "Gemini API key (API_KEY) is missing in your .env file. " +
    "Gemini features (keyword suggestion, sectioning, drafting, query refinement) will not work correctly. " +
    // Fix: Updated warning message to refer to API_KEY
    "Please ensure the API_KEY environment variable is set in your .env file."
  );
}

const parseJsonFromText = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Gemini - Failed to parse JSON response:", e, "Original text:", text);
    return null;
  }
};

export const suggestKeywords = async (topic: string, existingKeywords: string[]): Promise<string[]> => {
  if (!API_KEY) return [];
  try {
    const prompt = `Based on the research topic "${topic}" and existing keywords [${existingKeywords.join(', ')}], suggest up to 5 additional relevant keywords.
Return STRICTLY as a JSON array of strings. For example: ["keyword1", "keyword2"].
If no new keywords can be suggested, return an empty JSON array [].
Do not include any text or markdown outside of the JSON array.`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const suggestions = parseJsonFromText<string[]>(response.text);
    return suggestions || [];
  } catch (error) {
    console.error("Gemini - Error suggesting keywords:", error);
    return [];
  }
};

// findPapers function REMOVED - Replaced by arXiv service

export const generateArxivQuery = async (originalTopic: string, originalKeywords: string[], selectedPapersSnippets: {title: string, abstract: string}[]): Promise<string> => {
  if (!API_KEY) return `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback if API key missing
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
    
    const prompt = `${context}\n\nGenerate a concise and effective search query string suitable for the arXiv API (use boolean operators like AND, OR, NOT if helpful, and parentheses for grouping if needed, but often just well-chosen keywords work best).
Return ONLY the raw query string, no explanations, no JSON, just the string.
For example: "quantum entanglement AND (bell test OR non-locality)" OR "deep learning for video action recognition".
The query should be a single line of text.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    
    // The response should be a plain text query string
    const newQuery = response.text.trim().replace(/\n/g, " "); // Ensure single line
    return newQuery || `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback
  } catch (error) {
    console.error("Gemini - Error generating arXiv query:", error);
    return `${originalTopic} ${originalKeywords.join(' ')}`; // Fallback to original query on error
  }
};


export const suggestSections = async (selectedPapers: Paper[], numSections: number): Promise<Omit<Section, 'id' | 'paperIds'>[]> => {
  if (!API_KEY) return [];
  try {
    const paperInfos = selectedPapers.map(p => `ID: ${p.id}, Title: ${p.title}; Abstract: ${p.abstract.substring(0, 200)}...`).join('\n');
    const prompt = `Based on the following selected research papers:\n${paperInfos}\n\nSuggest ${numSections} distinct categories or section names for a 'Related Work' chapter. For each section, provide a "name" (string) and a brief "description" (string, 1-2 sentences).
Return STRICTLY as a JSON array of objects. Each object MUST have only "name" and "description" fields.
Example: [{"name": "Category A", "description": "Covers papers focusing on X."}, {"name": "Category B", "description": "Discusses approaches related to Y."}]
Do not include any text, comments, or markdown outside of this JSON array structure.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const sections = parseJsonFromText<Omit<Section, 'id' | 'paperIds'>[]>(response.text);
    return sections || [];
  } catch (error) {
    console.error("Gemini - Error suggesting sections:", error);
    return [];
  }
};

export type SectionPaperAssignments = Record<string, string[]>;

export const assignPapersToSections = async (papers: Paper[], sections: Omit<Section, 'paperIds'>[]): Promise<SectionPaperAssignments> => {
  if (!API_KEY) return {};
  try {
    const paperDetails = papers.map(p => `Paper ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${p.abstract.substring(0, 300)}...`).join('\n\n');
    const sectionDetails = sections.map(s => `Section ID: ${s.id}\nName: ${s.name}\nDescription: ${s.description}`).join('\n\n');

    const prompt = `Given the following research papers and defined sections for a related work chapter:

Papers:
${paperDetails}

Sections:
${sectionDetails}

Your task is to assign each paper to the MOST RELEVANT section. A paper should ideally be assigned to only one section.
Return the assignments STRICTLY as a JSON object. The keys of this object should be Section IDs, and the values should be JSON arrays of Paper IDs that belong to that section.
Example:
{
  "section-id-1": ["paper-id-A", "paper-id-B"],
  "section-id-2": ["paper-id-C"],
  "section-id-3": [] 
}
Ensure all provided Section IDs are present as keys in the output, even if no papers are assigned to them (in which case, the value should be an empty array []).
Do not include any text, comments, or markdown outside of this JSON object structure.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const assignments = parseJsonFromText<SectionPaperAssignments>(response.text);
    if (assignments) {
        sections.forEach(sec => {
            if (!assignments[sec.id]) {
                assignments[sec.id] = [];
            } else if (!Array.isArray(assignments[sec.id])) {
                console.warn(`Gemini - Assignments for section ${sec.id} was not an array, correcting.`);
                assignments[sec.id] = [];
            }
        });
    }
    return assignments || {};

  } catch (error) {
    console.error("Gemini - Error assigning papers to sections:", error);
    return {};
  }
};


export const draftRelatedWork = async (sections: Section[], papers: Paper[], format: 'text' | 'latex' = 'text'): Promise<string> => {
  // Fix: Updated warning message to refer to API_KEY
  if (!API_KEY) return "Gemini API key (API_KEY) missing. Cannot generate draft.";
  try {
    const sectionsWithPapers = sections.filter(sec => sec.paperIds.length > 0); 
    if (sectionsWithPapers.length === 0) {
        return "No sections have papers assigned. Cannot generate draft.";
    }
    const papersToIncludeInDraft = papers.filter(p => 
        sectionsWithPapers.some(sec => sec.paperIds.includes(p.id))
    );
    if (papersToIncludeInDraft.length === 0) {
        return "No papers are assigned to any active section. Cannot generate draft.";
    }

    const sectionsData = sectionsWithPapers.map(sec => {
      const sectionPapers = papersToIncludeInDraft.filter(p => sec.paperIds.includes(p.id));
      // For arXiv papers, use arxivId for citation hint if available
      const citationHint = sectionPapers[0]?.arxivId ? `[arXiv:${sectionPapers[0].arxivId}]` : (sectionPapers[0]?.doi ? `[DOI:${sectionPapers[0].doi}]` : `[AuthorYear]`);
      return `Section: ${sec.name}\nDescription: ${sec.description}\nPapers to include in this section (cite them appropriately, e.g. ${citationHint}):\n${sectionPapers.map(p => `- ${p.title} by ${p.authors.join(', ')} (${p.year || 'N/A'}) (arXiv:${p.arxivId || 'N/A'})`).join('\n')}`;
    }).join('\n\n');

    const allPaperDetails = papersToIncludeInDraft.map(p => `Title: ${p.title}\nAuthors: ${p.authors.join(', ')}\nYear: ${p.year}\nAbstract: ${p.abstract}\nDOI: ${p.doi || 'N/A'}\narXiv ID: ${p.arxivId || 'N/A'}`).join('\n---\n');

    const prompt = `You are an academic writing assistant. Write a 'Related Work' section for a research paper.
Use the following structure and content:
${sectionsData}

Here is more detail on all papers to be included (abstracts are important):
${allPaperDetails}

The output should be a coherent academic text. Ensure smooth transitions between papers and sections.
Cite papers naturally within the text using information like author, year, arXiv ID, or DOI. For example, "Author et al. (${papersToIncludeInDraft[0]?.year || 'YYYY'}) [arXiv:${papersToIncludeInDraft[0]?.arxivId || 'xxxx.xxxx'}] investigated..." or "...as shown by (Author, ${papersToIncludeInDraft[0]?.year || 'YYYY'})."
${format === 'latex' ? "Format the entire output as LaTeX, using common academic style. Use \\section{} for section titles and \\cite{} for citations (e.g., \\cite{arXivID}). Ensure paragraphs are well-formed." : "Format the output as plain text."}
Do not include a title like "Related Work" at the very beginning, just start with the first section's content.
`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini - Error drafting related work:", error);
    // Fix: Updated warning message to refer to API_KEY
    return "Error generating draft via Gemini. Please try again. Check if your API_KEY is valid and has quota.";
  }
};

export const refineDraft = async (currentDraft: string, userQuery: string, format: 'text' | 'latex' = 'text'): Promise<string> => {
  // Fix: Updated warning message to refer to API_KEY
  if (!API_KEY) return currentDraft + "\n\n(Gemini API key (API_KEY) missing for refinement.)";
  try {
    const prompt = `Given the current draft of a related work section:
--- DRAFT START ---
${currentDraft}
--- DRAFT END ---

The user wants to refine it with the following request: "${userQuery}".
Revise the draft to incorporate this request. Output the fully revised related work section.
${format === 'latex' ? "Ensure the output remains valid LaTeX." : "Ensure the output is plain text."}
`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
    });
    return response.text;

  } catch (error) {
    console.error("Gemini - Error refining draft:", error);
    // Fix: Updated warning message to refer to API_KEY
    return currentDraft + `\n\nError refining draft via Gemini: ${ (error as Error).message }. Check API_KEY and quota.`;
  }
};