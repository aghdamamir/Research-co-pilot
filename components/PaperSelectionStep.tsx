
import React, { useState, useEffect, useCallback } from 'react';
import { Paper, UserInputs, AppStep, ApiProvider } from '../types';
import * as arxivService from '../services/arxivService';
import * as geminiService from '../services/geminiService'; // For query generation
import * as openaiService from '../services/openaiService'; // For query generation
import PaperCard from './PaperCard';
import LoadingSpinner from './LoadingSpinner';
import ChevronRightIcon from './icons/ChevronRightIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import SearchIcon from './icons/SearchIcon';

interface PaperSelectionStepProps {
  userInputs: UserInputs;
  initialSelectedPapers: Paper[];
  onNext: (selectedPapers: Paper[]) => void;
  onBack: () => void;
  apiProvider: ApiProvider;
}

const PaperSelectionStep: React.FC<PaperSelectionStepProps> = ({ userInputs, initialSelectedPapers, onNext, onBack, apiProvider }) => {
  const [foundPapers, setFoundPapers] = useState<Paper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(
    new Set(initialSelectedPapers.map(p => p.id))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefiningLoading, setIsRefiningLoading] = useState(false); // Separate loading for refinement AI + arXiv
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentArxivQuery, setCurrentArxivQuery] = useState('');
  const papersPerPage = 5;

  const constructInitialArxivQuery = useCallback((inputs: UserInputs): string => {
    let queryParts: string[] = [];
    if (inputs.topic.trim()) queryParts.push(inputs.topic.trim());
    if (inputs.keywords.length > 0) queryParts.push(...inputs.keywords);
    // arXiv expects simple string queries, often space-separated for AND, or use explicit AND/OR
    // For simplicity, joining with space. Advanced query construction can be added.
    let baseQuery = queryParts.join(' ');
    if (inputs.initialRelatedPapers) {
        // We can't directly feed DOIs/titles into arXiv search query with special meaning easily.
        // So, we'll use them to refine query with LLM later if refining.
        // For now, just add them as keywords if needed.
        baseQuery += ` ${inputs.initialRelatedPapers.split('\n').join(' ')}`;
    }
    return baseQuery.trim();
  }, []);


  const fetchPapersFromArxiv = useCallback(async (query: string, numToFetch: number, isNewSearch: boolean) => {
    if (isNewSearch) setIsLoading(true); else setIsRefiningLoading(true); //setIsRefiningLoading already true if called from handleIterativeSearch
    setError('');
    setCurrentArxivQuery(query);

    try {
      const newlyFetchedPapers = await arxivService.searchArxiv(query, numToFetch);
      
      setFoundPapers(prevFoundPapers => {
        const combinedPapers = isNewSearch ? newlyFetchedPapers : [...prevFoundPapers, ...newlyFetchedPapers];
        const uniquePapersMap = new Map<string, Paper>();
        combinedPapers.forEach(p => {
            // Prefer existing selected version if a duplicate ID is fetched, to keep selection state
            if (selectedPaperIds.has(p.id) && prevFoundPapers.find(fp => fp.id === p.id)) {
                 const existingSelected = prevFoundPapers.find(fp => fp.id === p.id);
                 if (existingSelected) uniquePapersMap.set(p.id, existingSelected);
            } else {
                uniquePapersMap.set(p.id, p);
            }
        });
        return Array.from(uniquePapersMap.values());
      });

      if (newlyFetchedPapers.length === 0) {
        setError(`No new papers found on arXiv for the query: "${query}". Try different terms.`);
      }
       if (isNewSearch) setCurrentPage(1);

    } catch (err) {
      console.error(err);
      setError(`Failed to retrieve papers from arXiv. Error: ${(err as Error).message}`);
    } finally {
      if (isNewSearch) setIsLoading(false); else setIsRefiningLoading(false);
    }
  }, [selectedPaperIds]);


  useEffect(() => {
    // Initial fetch when component mounts or userInputs change
    setFoundPapers([]); 
    setSelectedPaperIds(new Set(initialSelectedPapers.map(p => p.id)));
    const initialQuery = constructInitialArxivQuery(userInputs);
    if (initialQuery) {
        fetchPapersFromArxiv(initialQuery, userInputs.numPapersToRetrieve, true);
    } else {
        setError("Please provide a topic or keywords to search for papers.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputs, constructInitialArxivQuery]); // initialSelectedPapers is for setting IDs, not re-fetching


  const handleToggleSelect = (paperId: string) => {
    setSelectedPaperIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paperId)) {
        newSet.delete(paperId);
      } else {
        newSet.add(paperId);
      }
      return newSet;
    });
  };

  const handleNext = () => {
    const papersToPass = foundPapers.filter(p => selectedPaperIds.has(p.id));
    if (papersToPass.length === 0) {
        setError("Please select at least one paper to proceed.");
        return;
    }
    onNext(papersToPass);
  };

  const handleIterativeSearch = async () => {
    if (selectedPaperIds.size === 0) {
        setError("Please select some papers first to guide the iterative search with AI query refinement.");
        // Optionally, could just re-run original query or do nothing.
        // For now, just show error and return.
        return;
    }
    setError('');
    setIsRefiningLoading(true);

    const papersForRefinement = foundPapers.filter(p => selectedPaperIds.has(p.id));
    const paperSnippets = papersForRefinement.map(p => ({ title: p.title, abstract: p.abstract.substring(0,500) }));
    
    let refinedQuery = '';
    const originalQueryBasis = constructInitialArxivQuery(userInputs);

    try {
      if (apiProvider === 'gemini') {
        refinedQuery = await geminiService.generateArxivQuery(userInputs.topic, userInputs.keywords, paperSnippets);
      } else {
        refinedQuery = await openaiService.generateArxivQueryOpenAI(userInputs.topic, userInputs.keywords, paperSnippets);
      }
      if (!refinedQuery || refinedQuery.trim() === originalQueryBasis.trim()) {
          setError(`AI (${apiProvider}) did not suggest a significantly different query. You might want to refine manually or try with different selections.`);
          // Fallback to just searching with the refined query anyway, or original if empty
          refinedQuery = refinedQuery.trim() || originalQueryBasis; 
      }
    } catch (aiError) {
      console.error(`AI query generation failed for ${apiProvider}:`, aiError);
      setError(`AI query refinement failed. Using original query basis. Error: ${(aiError as Error).message}`);
      refinedQuery = originalQueryBasis;
    }
    
    if (refinedQuery) {
        await fetchPapersFromArxiv(refinedQuery, userInputs.numPapersToRetrieve, false); // false indicates iterative search, appends results
    } else {
        setError("Could not generate a query for refinement.");
        setIsRefiningLoading(false);
    }
  };

  const totalPages = Math.ceil(foundPapers.length / papersPerPage);
  const currentPapers = foundPapers.slice((currentPage - 1) * papersPerPage, currentPage * papersPerPage);
  const generalLoading = isLoading || isRefiningLoading;

  return (
    <div className="p-4 md:p-6 bg-white shadow-lg rounded-xl border border-secondary-200">
      <h2 className="text-2xl font-semibold text-primary-700 mb-2">Select Relevant Papers from arXiv</h2>
      <p className="text-sm text-secondary-600 mb-1">
        Current arXiv Query: <span className="font-medium italic">{currentArxivQuery || "Not set"}</span>
      </p>
      <p className="text-sm text-secondary-600 mb-4">
        User Topic: <span className="font-medium">{userInputs.topic}</span> | Keywords: <span className="font-medium">{userInputs.keywords.join(', ') || 'N/A'}</span>
      </p>

      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md mb-4" role="alert">{error}</div>}
      
      {isLoading && currentPapers.length === 0 ? (
        <LoadingSpinner text={`Searching arXiv for: "${currentArxivQuery}"...`} />
      ) : (
        <>
          {isRefiningLoading && <LoadingSpinner text={`Refining search and querying arXiv with AI (${apiProvider})...`} />}
          {foundPapers.length > 0 ? (
            <div className="space-y-3">
              {currentPapers.map(paper => (
                <PaperCard
                  key={paper.id} 
                  paper={paper}
                  isSelected={selectedPaperIds.has(paper.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          ) : (
            !generalLoading && <p className="text-secondary-600 text-center py-4">No papers found on arXiv for your query. You might want to go back and refine your topic or keywords.</p>
          )}

          {foundPapers.length > papersPerPage && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1 || generalLoading}
                className="p-2 rounded-md border border-secondary-300 hover:bg-secondary-100 disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="text-sm text-secondary-700" aria-live="polite">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages || generalLoading}
                className="p-2 rounded-md border border-secondary-300 hover:bg-secondary-100 disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
      
      <div className="mt-6 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
            onClick={onBack}
            className="px-6 py-3 bg-secondary-200 text-secondary-800 font-semibold rounded-md hover:bg-secondary-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back to Topic
        </button>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            onClick={handleIterativeSearch}
            disabled={generalLoading || selectedPaperIds.size === 0}
            className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-md hover:bg-primary-600 transition-colors flex items-center gap-2 disabled:opacity-60 w-full sm:w-auto justify-center"
            title="Refine arXiv search using AI based on selected papers"
          >
            <SearchIcon className="w-5 h-5" />
            Refine Search (AI Query + arXiv)
          </button>
          <button
            onClick={handleNext}
            disabled={generalLoading || selectedPaperIds.size === 0}
            className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors flex items-center gap-2 disabled:opacity-60 w-full sm:w-auto justify-center"
          >
            Proceed to Categorization ({selectedPaperIds.size})
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperSelectionStep;
