
import { Paper } from '../types';

// Helper to safely get text content from an XML element
const getText = (element: Element | null | undefined, tagName: string): string => {
  if (!element) return '';
  const node = element.getElementsByTagName(tagName)[0];
  return node?.textContent?.trim() || '';
};

// Helper to get multiple elements' text content (like authors)
const getMultipleTexts = (element: Element, tagName: string, childTagName?: string): string[] => {
  const nodes = Array.from(element.getElementsByTagName(tagName));
  if (childTagName) {
    return nodes.map(node => node.getElementsByTagName(childTagName)[0]?.textContent?.trim() || '').filter(Boolean);
  }
  return nodes.map(node => node.textContent?.trim() || '').filter(Boolean);
};


const parseArxivXml = (xmlText: string): Paper[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const entries = xmlDoc.getElementsByTagName("entry");
  const papers: Paper[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const arxivIdFull = getText(entry, "id").split('/').pop() || `arxiv-${Date.now()}-${i}`;
    const title = getText(entry, "title").replace(/\s+/g, ' ');
    const abstract = getText(entry, "summary").replace(/\s+/g, ' ');
    const publishedDate = getText(entry, "published");
    const year = publishedDate ? new Date(publishedDate).getFullYear() : undefined;
    
    const authors = Array.from(entry.getElementsByTagName("author")).map(author => getText(author, "name"));
    
    const pdfLinkEntry = Array.from(entry.getElementsByTagName("link")).find(link => link.getAttribute("title") === "pdf");
    const pdfLink = pdfLinkEntry ? pdfLinkEntry.getAttribute("href") || undefined : undefined;
    
    const doiLinkEntry = Array.from(entry.getElementsByTagName("link")).find(link => link.getAttribute("title") === "doi");
    const doi = doiLinkEntry ? doiLinkEntry.getAttribute("href")?.replace('http://dx.doi.org/', '') : undefined;

    const paper: Paper = {
      id: arxivIdFull,
      arxivId: arxivIdFull,
      title,
      authors,
      abstract,
      year,
      pdfLink,
      doi,
      bibtex: `@misc{${arxivIdFull.replace(/[^a-zA-Z0-9]/g, '')},
  title={${title.replace(/{/g, "\\{").replace(/}/g, "\\}")}},
  author={${authors.join(' and ')}},
  year={${year || 'N/A'}},
  eprint={${arxivIdFull}},
  archivePrefix={arXiv},
  ${pdfLink ? `url={${pdfLink}},` : ''}
  ${doi ? `doi={${doi}},` : ''}
}`
    };
    papers.push(paper);
  }
  return papers;
};

export const searchArxiv = async (query: string, maxResults: number = 10): Promise<Paper[]> => {
  // Basic query sanitization and construction
  const searchTerm = query.trim().split(/\s+/).join('+');
  if (!searchTerm) {
    console.warn("arXiv search query is empty.");
    return [];
  }
  
  // arXiv API endpoint
  // Using sortOrder=relevance and sortBy=relevance (though API docs say submittedDate, lastUpdatedDate, relevance are options for sortBy)
  // Defaulting to relevance for now.
  const url = `https://export.arxiv.org/api/query?search_query=all:${searchTerm}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`arXiv API error (${response.status}): ${errorText}`);
      throw new Error(`arXiv API request failed with status ${response.status}`);
    }
    const xmlText = await response.text();
    const papers = parseArxivXml(xmlText);
    if (papers.length === 0) {
        console.log("arXiv search returned no results for query:", query);
    }
    return papers;
  } catch (error) {
    console.error("Error fetching or parsing arXiv data:", error);
    // In case of error, return an empty array or rethrow, depending on desired error handling
    return [];
  }
};
