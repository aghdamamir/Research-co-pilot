import React, { useState, useEffect, useCallback } from 'react';
import { Paper, Section, AppStep, DraftFormat, ApiProvider } from '../types';
import * as geminiService from '../services/geminiService';
import * as openaiService from '../services/openaiService';
import LoadingSpinner from './LoadingSpinner';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import CopyIcon from './icons/CopyIcon';
import DownloadIcon from './icons/DownloadIcon';

interface DraftingStepProps {
  sections: Section[];
  selectedPapers: Paper[];
  onBack: () => void;
  onRestart: () => void;
  apiProvider: ApiProvider;
}

const DraftingStep: React.FC<DraftingStepProps> = ({ sections, selectedPapers, onBack, onRestart, apiProvider }) => {
  const [draft, setDraft] = useState<string>('');
  const [draftHistory, setDraftHistory] = useState<string[]>([]);
  const [bibtex, setBibtex] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [refinementQuery, setRefinementQuery] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [draftFormat, setDraftFormat] = useState<DraftFormat>('text');
  const [copySuccess, setCopySuccess] = useState('');


  const generateNewDraft = useCallback(async (format: DraftFormat) => {
    setIsLoading(true);
    setError('');
    setDraftHistory([]); 
    try {
      const sectionsWithPapers = sections.filter(sec => sec.paperIds.length > 0);
      if (sectionsWithPapers.length === 0) {
        setError("No sections have papers assigned. Please go back and assign papers to sections.");
        setDraft("");
        setIsLoading(false);
        return;
      }
      
      const papersToIncludeInDraft = selectedPapers.filter(p => 
        sectionsWithPapers.some(sec => sec.paperIds.includes(p.id))
      );

      if (papersToIncludeInDraft.length === 0) {
        setError("No papers are assigned to any active section. Cannot generate draft.");
        setDraft("");
        setIsLoading(false);
        return;
      }

      let generatedDraft = "";
      if (apiProvider === 'gemini') {
        generatedDraft = await geminiService.draftRelatedWork(sectionsWithPapers, papersToIncludeInDraft, format);
      } else {
        generatedDraft = await openaiService.draftRelatedWorkOpenAI(sectionsWithPapers, papersToIncludeInDraft, format);
      }
      setDraft(generatedDraft);
    } catch (err) {
      console.error(err);
      setError(`Failed to generate draft using ${apiProvider}. Please try again or check API key.`);
      setDraft('');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, selectedPapers, apiProvider]); // Added apiProvider

  useEffect(() => {
    if (sections.length > 0 && selectedPapers.length > 0) {
        generateNewDraft(draftFormat);
    } else {
        setDraft("");
        setDraftHistory([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFormat, sections, selectedPapers, generateNewDraft, apiProvider]); // Added apiProvider to deps of outer effect. generateNewDraft also has it.

  useEffect(() => {
    const bibtexEntries = selectedPapers
      .map(p => p.bibtex || `@misc{${p.id.replace(/[^a-zA-Z0-9]/g, '')}, title={${p.title}}, author={${p.authors.join(' and ')}}, year={${p.year || 'unknown'}}}`)
      .join('\n\n');
    setBibtex(bibtexEntries);
  }, [selectedPapers]);

  const handleRefineDraft = async () => {
    if (!refinementQuery.trim() || !draft) return;
    setIsRefining(true);
    setError('');
    try {
      setDraftHistory(prev => [...prev, draft]);
      let refined = "";
      if (apiProvider === 'gemini') {
        refined = await geminiService.refineDraft(draft, refinementQuery, draftFormat);
      } else {
        refined = await openaiService.refineDraftOpenAI(draft, refinementQuery, draftFormat);
      }
      setDraft(refined);
      setRefinementQuery('');
    } catch (err) {
      console.error(err);
      setError(`Failed to refine draft using ${apiProvider}. Please try again or restore.`);
    } finally {
      setIsRefining(false);
    }
  };

  const handleRestorePreviousDraft = () => {
    if (draftHistory.length > 0) {
      const previousDraft = draftHistory[draftHistory.length - 1];
      setDraft(previousDraft);
      setDraftHistory(prev => prev.slice(0, -1));
      setError('');
    }
  };

  const handleCopyToClipboard = (textToCopy: string, type: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(`${type} copied to clipboard!`);
      setTimeout(() => setCopySuccess(''), 2000);
    }).catch(err => {
      console.error(`Failed to copy ${type}: `, err);
      setCopySuccess(`Failed to copy ${type}. Try manual copy.`);
      setTimeout(() => setCopySuccess(''), 3000);
    });
  };

  const handleDownload = (content: string, filename: string, mimeType: string) => {
    if (!content) {
        setError(`Cannot download empty ${filename.includes('draft') ? 'draft' : 'BibTeX'}.`);
        setTimeout(() => setError(''), 3000);
        return;
    }
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };


  return (
    <div className="p-4 md:p-6 bg-white shadow-lg rounded-xl border border-secondary-200">
      <h2 className="text-2xl font-semibold text-primary-700 mb-4">Draft Related Work & Refine</h2>
      {copySuccess && <div className="mb-4 p-2 text-sm bg-green-100 text-green-700 rounded-md text-center transition-opacity duration-300" role="alert">{copySuccess}</div>}
      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md mb-4" role="alert">{error}</div>}

      {isLoading ? (
        <LoadingSpinner text={`Generating draft via ${apiProvider}...`} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-secondary-800">Generated Draft</h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => handleCopyToClipboard(draft, 'Draft')}
                        className="p-1.5 text-xs sm:p-2 sm:text-sm bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-md flex items-center gap-1"
                        title="Copy Draft"
                        disabled={!draft}
                    >
                        <CopyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Copy</span>
                    </button>
                    <button
                        onClick={() => handleDownload(draft, `related_work_draft_${apiProvider}.${draftFormat === 'latex' ? 'tex' : 'txt'}`, draftFormat === 'latex' ? 'application/x-tex' : 'text/plain')}
                        className="p-1.5 text-xs sm:p-2 sm:text-sm bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-md flex items-center gap-1"
                        title="Download Draft"
                        disabled={!draft}
                    >
                        <DownloadIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Download</span>
                    </button>
                    <div className="flex rounded-md shadow-sm">
                        <button
                        onClick={() => setDraftFormat('text')}
                        aria-pressed={draftFormat === 'text'}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-l-md text-xs sm:text-sm font-medium focus:z-10 focus:outline-none transition-colors
                                    ${draftFormat === 'text' ? 'bg-primary-600 text-white' : 'bg-white text-secondary-700 hover:bg-secondary-50 border border-secondary-300'}`}
                        >
                        Text
                        </button>
                        <button
                        onClick={() => setDraftFormat('latex')}
                        aria-pressed={draftFormat === 'latex'}
                        className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-r-md text-xs sm:text-sm font-medium focus:z-10 focus:outline-none transition-colors
                                    ${draftFormat === 'latex' ? 'bg-primary-600 text-white' : 'bg-white text-secondary-700 hover:bg-secondary-50 border border-secondary-300 border-l-0'}`}
                        >
                        LaTeX
                        </button>
                    </div>
                </div>
            </div>
            <pre className="w-full p-4 border border-secondary-300 rounded-md bg-secondary-50 text-sm whitespace-pre-wrap overflow-x-auto h-96" aria-live="polite">
              {draft || "Draft will appear here once generated..."}
            </pre>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-secondary-800 mb-2">Refine Draft</h3>
            <textarea
              value={refinementQuery}
              onChange={(e) => setRefinementQuery(e.target.value)}
              rows={3}
              className="w-full p-3 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="e.g., Make the tone more critical for section X. Elaborate on paper Y. Shorten the introduction."
              disabled={!draft || isLoading}
              aria-label="Refinement query for the draft"
            />
            <div className="mt-2 flex items-center gap-3">
                <button
                onClick={handleRefineDraft}
                disabled={isRefining || !refinementQuery.trim() || !draft || isLoading}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                {isRefining ? <LoadingSpinner size="sm" /> : 'Refine'}
                </button>
                <button
                onClick={handleRestorePreviousDraft}
                disabled={isRefining || draftHistory.length === 0 || isLoading}
                className="px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 transition-colors disabled:opacity-60"
                >
                Restore Previous
                </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-secondary-800">BibTeX Entries</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleCopyToClipboard(bibtex, 'BibTeX')}
                        className="p-1.5 text-xs sm:p-2 sm:text-sm bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-md flex items-center gap-1"
                        title="Copy BibTeX"
                        disabled={!bibtex}
                    >
                         <CopyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Copy</span>
                    </button>
                     <button
                        onClick={() => handleDownload(bibtex, 'references.bib', 'application/x-bibtex')}
                        className="p-1.5 text-xs sm:p-2 sm:text-sm bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-md flex items-center gap-1"
                        title="Download BibTeX"
                        disabled={!bibtex}
                    >
                        <DownloadIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Download</span>
                    </button>
                </div>
            </div>
            <pre className="w-full p-4 border border-secondary-300 rounded-md bg-secondary-50 text-sm whitespace-pre-wrap overflow-x-auto h-60" aria-live="polite">
              {bibtex || "BibTeX entries for selected papers will appear here..."}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
            onClick={onBack}
            className="px-6 py-3 bg-secondary-200 text-secondary-800 font-semibold rounded-md hover:bg-secondary-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back to Categorization
        </button>
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors w-full sm:w-auto justify-center"
        >
          Start New Draft
        </button>
      </div>
    </div>
  );
};

export default DraftingStep;