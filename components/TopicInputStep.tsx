import React, { useState, useCallback } from 'react';
import { UserInputs, AppStep, ApiProvider } from '../types';
import { DEFAULT_NUM_PAPERS_TO_RETRIEVE, MAX_KEYWORDS_SUGGESTION } from '../constants';
import * as geminiService from '../services/geminiService';
import * as openaiService from '../services/openaiService';
import LightbulbIcon from './icons/LightbulbIcon';
import SearchIcon from './icons/SearchIcon';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';

interface TopicInputStepProps {
  onNext: (inputs: UserInputs) => void;
  initialInputs?: Partial<UserInputs>;
  apiProvider: ApiProvider;
}

const TopicInputStep: React.FC<TopicInputStepProps> = ({ onNext, initialInputs, apiProvider }) => {
  const [topic, setTopic] = useState(initialInputs?.topic || '');
  const [keywords, setKeywords] = useState<string[]>(initialInputs?.keywords || []);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [numPapers, setNumPapers] = useState(initialInputs?.numPapersToRetrieve || DEFAULT_NUM_PAPERS_TO_RETRIEVE);
  const [initialPapers, setInitialPapers] = useState(initialInputs?.initialRelatedPapers || '');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestedKeywordsModalOpen, setSuggestedKeywordsModalOpen] = useState(false);
  const [suggestedKeywordsList, setSuggestedKeywordsList] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleAddKeyword = () => {
    if (currentKeyword.trim() && !keywords.includes(currentKeyword.trim())) {
      setKeywords([...keywords, currentKeyword.trim()]);
      setCurrentKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(kw => kw !== keywordToRemove));
  };

  const handleSuggestKeywords = useCallback(async () => {
    if (!topic.trim()) {
      setError('Please enter a research topic first to get keyword suggestions.');
      return;
    }
    setError('');
    setIsLoadingSuggestions(true);
    try {
      let suggestions: string[] = [];
      if (apiProvider === 'gemini') {
        suggestions = await geminiService.suggestKeywords(topic, keywords);
      } else {
        suggestions = await openaiService.suggestKeywordsOpenAI(topic, keywords);
      }
      setSuggestedKeywordsList(suggestions.filter(s => !keywords.includes(s)).slice(0, MAX_KEYWORDS_SUGGESTION));
      setSuggestedKeywordsModalOpen(true);
    } catch (err) {
      console.error(err);
      setError(`Failed to suggest keywords using ${apiProvider}. Please try again or check API key.`);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [topic, keywords, apiProvider]);

  const handleAddSuggestedKeyword = (keyword: string) => {
    if (!keywords.includes(keyword)) {
      setKeywords([...keywords, keyword]);
    }
    setSuggestedKeywordsList(prev => prev.filter(k => k !== keyword));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Research topic is required.');
      return;
    }
    setError('');
    onNext({
      topic,
      keywords,
      numPapersToRetrieve: numPapers,
      initialRelatedPapers: initialPapers,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 md:p-6 bg-white shadow-lg rounded-xl border border-secondary-200">
      <h2 className="text-2xl font-semibold text-primary-700 mb-6 border-b pb-3">Define Your Research Scope</h2>
      
      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{error}</div>}

      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-secondary-700 mb-1">
          Research Topic <span className="text-red-500">*</span>
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          className="w-full p-3 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="e.g., Advancements in vision-language models for video understanding"
          required
        />
      </div>

      <div>
        <label htmlFor="keywords" className="block text-sm font-medium text-secondary-700 mb-1">
          Keywords
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            id="keywords"
            value={currentKeyword}
            onChange={(e) => setCurrentKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword();}}}
            className="flex-grow p-3 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-colors"
            placeholder="Enter a keyword and press Enter or Add"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-sm"
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleSuggestKeywords}
            disabled={isLoadingSuggestions}
            className="px-4 py-3 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 transition-colors flex items-center gap-2 text-sm"
          >
            {isLoadingSuggestions ? <LoadingSpinner size="sm" /> : <LightbulbIcon className="w-4 h-4" />}
            Suggest
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map(kw => (
              <span key={kw} className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm flex items-center">
                {kw}
                <button type="button" onClick={() => handleRemoveKeyword(kw)} className="ml-2 text-primary-500 hover:text-primary-700">&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>
      
      <Modal isOpen={suggestedKeywordsModalOpen} onClose={() => setSuggestedKeywordsModalOpen(false)} title="Suggested Keywords">
        {suggestedKeywordsList.length > 0 ? (
          <ul className="space-y-2">
            {suggestedKeywordsList.map(kw => (
              <li key={kw} className="flex justify-between items-center p-2 border rounded-md">
                <span>{kw}</span>
                <button onClick={() => handleAddSuggestedKeyword(kw)} className="text-sm bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Add</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary-600">No new keyword suggestions at this time. Try refining your topic.</p>
        )}
        <button onClick={() => setSuggestedKeywordsModalOpen(false)} className="mt-4 w-full px-4 py-2 bg-secondary-200 text-secondary-800 rounded-md hover:bg-secondary-300 transition-colors">
          Close
        </button>
      </Modal>

      <div>
        <label htmlFor="numPapers" className="block text-sm font-medium text-secondary-700 mb-1">
          Number of Papers to Retrieve
        </label>
        <input
          type="number"
          id="numPapers"
          value={numPapers}
          onChange={(e) => setNumPapers(Math.max(1, parseInt(e.target.value, 10)))}
          min="1"
          max="50" // Reasonable max for demo
          className="w-full p-3 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="initialPapers" className="block text-sm font-medium text-secondary-700 mb-1">
          Key Related Papers (Optional - one DOI or title per line)
        </label>
        <textarea
          id="initialPapers"
          value={initialPapers}
          onChange={(e) => setInitialPapers(e.target.value)}
          rows={3}
          className="w-full p-3 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="e.g., 10.1109/CVPR.2021.01234&#10;Learning Transferable Visual Models From Natural Language Supervision"
        />
         <p className="mt-1 text-xs text-secondary-500">Providing these can help find more relevant new papers.</p>
      </div>
      
      <div className="flex justify-end pt-4 border-t mt-6">
        <button
          type="submit"
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors flex items-center gap-2"
        >
          <SearchIcon className="w-5 h-5" />
          Find Papers
        </button>
      </div>
    </form>
  );
};

export default TopicInputStep;