import React, { useState, useEffect, useCallback } from 'react';
import { Paper, Section, AppStep, ApiProvider } from '../types';
import { DEFAULT_NUM_SECTIONS } from '../constants';
import * as geminiService from '../services/geminiService';
import * as openaiService from '../services/openaiService';
import SectionCard from './SectionCard';
import LoadingSpinner from './LoadingSpinner';
import ChevronRightIcon from './icons/ChevronRightIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import LightbulbIcon from './icons/LightbulbIcon';

interface CategorizationStepProps {
  selectedPapers: Paper[];
  onNext: (sections: Section[]) => void;
  onBack: () => void;
  apiProvider: ApiProvider;
}

const CategorizationStep: React.FC<CategorizationStepProps> = ({ selectedPapers, onNext, onBack, apiProvider }) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [numSections, setNumSections] = useState(DEFAULT_NUM_SECTIONS);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(true);

  const generateInitialSectionsAndAssignments = useCallback(async (count: number) => {
    setIsLoadingSuggestions(true);
    setIsLoadingAssignments(false);
    setError('');
    setSections([]); 

    try {
      let suggestedSectionDefinitions: Omit<Section, 'id' | 'paperIds'>[] = [];
      if (apiProvider === 'gemini') {
        suggestedSectionDefinitions = await geminiService.suggestSections(selectedPapers, count);
      } else {
        suggestedSectionDefinitions = await openaiService.suggestSectionsOpenAI(selectedPapers, count);
      }

      if (!suggestedSectionDefinitions || suggestedSectionDefinitions.length === 0) {
        setError(`Could not suggest sections via ${apiProvider}. Try a different number or check paper relevance.`);
        setIsLoadingSuggestions(false);
        return;
      }
      
      const newSectionsWithoutAssignments: Omit<Section, 'paperIds'>[] = suggestedSectionDefinitions.map((s, i) => ({
        ...s,
        id: `section-${Date.now()}-${i}`, // Ensure ID is present for OpenAI service
      }));
      
      setIsLoadingSuggestions(false);
      
      if (newSectionsWithoutAssignments.length > 0 && selectedPapers.length > 0) {
        setIsLoadingAssignments(true);
        let paperAssignments: geminiService.SectionPaperAssignments = {}; // Use type from geminiService, structure is same
        if (apiProvider === 'gemini') {
          paperAssignments = await geminiService.assignPapersToSections(selectedPapers, newSectionsWithoutAssignments);
        } else {
          // Pass full Omit<Section, 'paperIds'>[] to openaiService as it expects 'id' to be there for mapping.
          paperAssignments = await openaiService.assignPapersToSectionsOpenAI(selectedPapers, newSectionsWithoutAssignments);
        }
        
        const finalSections: Section[] = newSectionsWithoutAssignments.map(secDef => ({
            ...secDef,
            paperIds: paperAssignments[secDef.id] || []
        }));
        setSections(finalSections);
        setIsLoadingAssignments(false);
      } else {
        setSections(newSectionsWithoutAssignments.map(s => ({...s, paperIds: []})));
      }

    } catch (err) {
      console.error("Error in categorization step:", err);
      setError(`Failed to suggest sections or assign papers via ${apiProvider}. Please try again or check API key.`);
      setIsLoadingSuggestions(false);
      setIsLoadingAssignments(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPapers, apiProvider]); // Added apiProvider

  useEffect(() => {
    if (selectedPapers.length > 0 && sections.length === 0 && !isLoadingSuggestions && !isLoadingAssignments) {
        generateInitialSectionsAndAssignments(numSections);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPapers, generateInitialSectionsAndAssignments, apiProvider, numSections]); // Re-run if apiProvider or numSections changes.

  const handleUpdateSectionName = (id: string, name: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };
  
  const handleUpdateSectionDescription = (id: string, description: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, description } : s));
  };

  const handleAssignPaper = (sectionId: string, paperId: string) => {
    setSections(prevSections => {
      const updatedSections = prevSections.map(sec => ({
        ...sec,
        paperIds: sec.paperIds.filter(pid => pid !== paperId)
      }));
      return updatedSections.map(sec => 
        sec.id === sectionId ? { ...sec, paperIds: [...sec.paperIds, paperId] } : sec
      );
    });
  };

  const handleUnassignPaper = (sectionId: string, paperId: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, paperIds: s.paperIds.filter(pid => pid !== paperId) } : s
    ));
  };
  
  const handleAddSection = () => {
    const newSectionId = `section-${Date.now()}-${sections.length}`;
    setSections(prev => [...prev, { 
        id: newSectionId, 
        name: `New Section ${sections.length + 1}`, 
        description: 'Briefly describe this section.', 
        paperIds: [] 
    }]);
  };

  const handleRemoveSection = (idToRemove: string) => {
    setSections(prev => prev.filter(s => s.id !== idToRemove));
  };

  const handleFinalizeSections = () => {
    const unassignedPapersCount = selectedPapers.filter(p => !sections.some(s => s.paperIds.includes(p.id))).length;
    if (unassignedPapersCount > 0) {
        if (!window.confirm(`There are ${unassignedPapersCount} unassigned papers. Do you want to proceed anyway? These papers won't be included in the draft.`)) {
            return;
        }
    }
    const validSections = sections.filter(s => s.name.trim() !== "" && s.description.trim() !== "");
    if (validSections.length === 0) {
        setError("Please define at least one valid section.");
        return;
    }
    setError('');
    onNext(validSections);
  };
  
  const handleRegenerateSuggestions = () => {
      if (selectedPapers.length > 0) {
          generateInitialSectionsAndAssignments(numSections);
      } else {
          setError("Cannot suggest sections without selected papers.");
      }
  };

  const unassignedPapers = selectedPapers.filter(p => !sections.some(s => s.paperIds.includes(p.id)));
  const totalLoading = isLoadingSuggestions || isLoadingAssignments;

  return (
    <div className="p-4 md:p-6 bg-white shadow-lg rounded-xl border border-secondary-200">
      <h2 className="text-2xl font-semibold text-primary-700 mb-4">Categorize Papers into Sections</h2>
      <p className="text-sm text-secondary-600 mb-1">Selected Papers: {selectedPapers.length}</p>

      {error && <div className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md mb-4">{error}</div>}

      <div className="mb-6 p-4 border border-secondary-200 rounded-lg bg-secondary-50">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-2">
            <label htmlFor="numSections" className="text-sm font-medium text-secondary-700">
            Number of Sections:
            </label>
            <input
            type="number"
            id="numSections"
            value={numSections}
            onChange={(e) => setNumSections(Math.max(1, parseInt(e.target.value, 10)))}
            min="1"
            max="10"
            className="p-2 border border-secondary-300 rounded-md shadow-sm w-20 text-center"
            disabled={totalLoading}
            />
            <button
            onClick={handleRegenerateSuggestions}
            disabled={totalLoading || selectedPapers.length === 0}
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors flex items-center gap-1 text-sm disabled:opacity-60"
            >
            {totalLoading ? <LoadingSpinner size="sm"/> : <LightbulbIcon className="w-4 h-4" />}
            {isLoadingSuggestions ? 'Suggesting...' : isLoadingAssignments ? 'Assigning...' : 'Suggest & Assign'}
            </button>
        </div>
        <p className="text-xs text-secondary-500">Adjust the number and click "Suggest & Assign" for new AI-powered section suggestions (via {apiProvider}) and automatic paper assignments. You can then edit names, descriptions, and fine-tune paper assignments.</p>
      </div>
      
      {totalLoading && sections.length === 0 ? (
         <LoadingSpinner text={isLoadingSuggestions ? `Suggesting sections via ${apiProvider}...` : `Assigning papers to sections via ${apiProvider}...`} />
      ) : (
        <>
          {isLoadingAssignments && sections.length > 0 && <LoadingSpinner text={`Updating paper assignments via ${apiProvider}...`} />}
          {sections.length > 0 ? (
            <div className="space-y-4 mb-6">
              {sections.map(section => (
                <SectionCard
                  key={section.id}
                  section={section}
                  allSelectedPapers={selectedPapers}
                  assignedPaperIds={section.paperIds}
                  onUpdateSectionName={handleUpdateSectionName}
                  onUpdateSectionDescription={handleUpdateSectionDescription}
                  onAssignPaper={handleAssignPaper}
                  onUnassignPaper={handleUnassignPaper}
                  onRemoveSection={isEditing ? handleRemoveSection : undefined}
                  isEditing={isEditing}
                />
              ))}
            </div>
          ) : (
             !totalLoading && <p className="text-secondary-600 text-center py-4">No sections defined yet. Try suggesting sections above.</p>
          )}

          {isEditing && (
            <button 
                onClick={handleAddSection}
                disabled={totalLoading}
                className="mb-6 px-4 py-2 border border-dashed border-primary-400 text-primary-600 rounded-md hover:bg-primary-50 transition-colors text-sm disabled:opacity-60"
            >
                + Add Custom Section
            </button>
          )}

          {unassignedPapers.length > 0 && isEditing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="text-sm font-semibold text-yellow-700">Unassigned Papers ({unassignedPapers.length}):</h4>
                <ul className="list-disc list-inside text-xs text-yellow-600 mt-1">
                    {unassignedPapers.map(p => <li key={p.id}>{p.title.substring(0,70)}{p.title.length > 70 ? '...' : ''}</li>)}
                </ul>
                <p className="text-xs text-yellow-500 mt-1">Assign these to sections above or they won't be included in the draft.</p>
            </div>
          )}
        </>
      )}

      <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
            onClick={onBack}
            className="px-6 py-3 bg-secondary-200 text-secondary-800 font-semibold rounded-md hover:bg-secondary-300 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back to Paper Selection
        </button>
        <button
          onClick={handleFinalizeSections}
          disabled={totalLoading || sections.length === 0}
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors flex items-center gap-2 disabled:opacity-60 w-full sm:w-auto justify-center"
        >
          Draft Related Work
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default CategorizationStep;