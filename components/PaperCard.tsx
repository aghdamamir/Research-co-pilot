
import React, { useState } from 'react';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  isSelected: boolean;
  onToggleSelect: (paperId: string) => void;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, isSelected, onToggleSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`p-4 border rounded-lg shadow-sm transition-all duration-300 ${isSelected ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-200' : 'bg-white border-secondary-200 hover:shadow-md'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 mr-2">
          <h3 className="text-md font-semibold text-primary-700">{paper.title}</h3>
          <p className="text-xs text-secondary-500 mb-1">
            {paper.authors.join(', ')} ({paper.year || 'N/A'})
          </p>
          <div className="text-xs text-primary-600 space-x-2">
            {paper.arxivId && (
              <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                arXiv:{paper.arxivId}
              </a>
            )}
            {paper.pdfLink && (
              <a href={paper.pdfLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                (PDF)
              </a>
            )}
            {paper.doi && (
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                DOI:{paper.doi}
              </a>
            )}
          </div>
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(paper.id)} // Use paper.id which should be arxivId now
          className="form-checkbox h-5 w-5 text-primary-600 border-secondary-300 rounded focus:ring-primary-500 ml-2 mt-1 flex-shrink-0"
          aria-label={`Select paper ${paper.title}`}
        />
      </div>
      {paper.abstract && (
        <div className="mt-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="text-xs text-primary-600 hover:text-primary-800"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Hide Abstract' : 'Show Abstract'}
          </button>
          {isExpanded && (
            <p className="mt-1 text-sm text-secondary-600 bg-secondary-50 p-2 rounded">
              {paper.abstract}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PaperCard;