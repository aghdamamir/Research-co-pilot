
import React, { useState, useEffect } from 'react';
import { Section, Paper } from '../types';

interface SectionCardProps {
  section: Omit<Section, 'paperIds'> & { paperIds?: string[] }; // paperIds is optional for initial suggestion
  allSelectedPapers: Paper[];
  assignedPaperIds: string[];
  onUpdateSectionName: (id: string, name: string) => void;
  onUpdateSectionDescription: (id: string, description: string) => void;
  onAssignPaper: (sectionId: string, paperId: string) => void;
  onUnassignPaper: (sectionId: string, paperId: string) => void;
  onRemoveSection?: (id:string) => void; // Optional, if sections can be removed
  isEditing: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  allSelectedPapers,
  assignedPaperIds,
  onUpdateSectionName,
  onUpdateSectionDescription,
  onAssignPaper,
  onUnassignPaper,
  onRemoveSection,
  isEditing,
}) => {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description);

  useEffect(() => {
    setName(section.name);
    setDescription(section.description);
  }, [section.name, section.description]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleNameBlur = () => {
    if (name.trim() !== section.name) {
      onUpdateSectionName(section.id, name.trim());
    }
  };
  
  const handleDescriptionBlur = () => {
    if (description.trim() !== section.description) {
      onUpdateSectionDescription(section.id, description.trim());
    }
  };

  const availablePapersForAssignment = allSelectedPapers.filter(
    p => !assignedPaperIds.includes(p.id)
  );

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white border-secondary-200 space-y-3">
      <div className="flex justify-between items-center">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            className="text-lg font-semibold text-primary-700 border-b-2 border-primary-300 focus:border-primary-500 outline-none w-full"
            placeholder="Section Name"
          />
        ) : (
          <h3 className="text-lg font-semibold text-primary-700">{section.name}</h3>
        )}
        {isEditing && onRemoveSection && (
            <button 
                onClick={() => onRemoveSection(section.id)}
                className="ml-2 text-red-500 hover:text-red-700 text-xs p-1"
                title="Remove section"
            >
                &times; Remove
            </button>
        )}
      </div>
      
      {isEditing ? (
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          onBlur={handleDescriptionBlur}
          rows={2}
          className="w-full text-sm text-secondary-600 border border-secondary-300 rounded-md p-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Section description"
        />
      ) : (
        <p className="text-sm text-secondary-600">{section.description}</p>
      )}

      {isEditing && (
        <div>
          <label className="block text-xs font-medium text-secondary-500 mb-1">Assign Papers:</label>
          {availablePapersForAssignment.length > 0 ? (
            <select 
                onChange={(e) => e.target.value && onAssignPaper(section.id, e.target.value)}
                value=""
                className="w-full p-2 border border-secondary-300 rounded-md text-sm"
            >
                <option value="" disabled>Select a paper to assign...</option>
                {availablePapersForAssignment.map(p => (
                    <option key={p.id} value={p.id}>{p.title.substring(0,50)}{p.title.length > 50 ? '...' : ''}</option>
                ))}
            </select>
          ) : (
            <p className="text-xs text-secondary-400 italic">All selected papers are assigned to this section or others.</p>
          )}
        </div>
      )}
      
      <div>
        <h4 className="text-xs font-medium text-secondary-500 mb-1">
          {isEditing ? 'Assigned Papers:' : 'Papers in this section:'}
        </h4>
        {assignedPaperIds.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {assignedPaperIds.map(paperId => {
              const paper = allSelectedPapers.find(p => p.id === paperId);
              return paper ? (
                <li key={paper.id} className="flex justify-between items-center bg-primary-50 p-1.5 rounded text-xs">
                  <span>{paper.title.substring(0,60)}{paper.title.length > 60 ? '...' : ''}</span>
                  {isEditing && (
                    <button onClick={() => onUnassignPaper(section.id, paper.id)} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
                  )}
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="text-xs text-secondary-400 italic">No papers assigned to this section yet.</p>
        )}
      </div>
    </div>
  );
};

export default SectionCard;
