
import React, { useState, useCallback } from 'react';
import { AppStep, UserInputs, Paper, Section, ApiProvider } from './types';
import { APP_TITLE, STEPS_CONFIG, DEFAULT_API_PROVIDER } from './constants';
import StepIndicator from './components/StepIndicator';
import TopicInputStep from './components/TopicInputStep';
import PaperSelectionStep from './components/PaperSelectionStep';
import CategorizationStep from './components/CategorizationStep';
import DraftingStep from './components/DraftingStep';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.TOPIC_INPUT);
  const [userInputs, setUserInputs] = useState<UserInputs | null>(null);
  const [selectedPapers, setSelectedPapers] = useState<Paper[]>([]);
  const [finalSections, setFinalSections] = useState<Section[]>([]);
  const [apiProvider, setApiProvider] = useState<ApiProvider>(DEFAULT_API_PROVIDER);

  const handleTopicInputNext = useCallback((inputs: UserInputs) => {
    setUserInputs(inputs);
    setSelectedPapers([]);
    setFinalSections([]);
    setCurrentStep(AppStep.PAPER_SELECTION);
  }, []);

  const handlePaperSelectionNext = useCallback((papers: Paper[]) => {
    setSelectedPapers(papers);
    setFinalSections([]);
    setCurrentStep(AppStep.CATEGORIZATION);
  }, []);

  const handleCategorizationNext = useCallback((sections: Section[]) => {
    setFinalSections(sections);
    setCurrentStep(AppStep.DRAFTING);
  }, []);

  const handleBack = useCallback(() => {
    if (currentStep === AppStep.PAPER_SELECTION) {
      setCurrentStep(AppStep.TOPIC_INPUT);
    } else if (currentStep === AppStep.CATEGORIZATION) {
      setCurrentStep(AppStep.PAPER_SELECTION);
    } else if (currentStep === AppStep.DRAFTING) {
      setCurrentStep(AppStep.CATEGORIZATION);
    }
  }, [currentStep]);

  const handleRestart = useCallback(() => {
    setUserInputs(null);
    setSelectedPapers([]);
    setFinalSections([]);
    setCurrentStep(AppStep.TOPIC_INPUT);
    // Optionally reset API provider to default:
    // setApiProvider(DEFAULT_API_PROVIDER);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case AppStep.TOPIC_INPUT:
        return <TopicInputStep 
                  onNext={handleTopicInputNext} 
                  initialInputs={userInputs || undefined} 
                  apiProvider={apiProvider} 
                />;
      case AppStep.PAPER_SELECTION:
        if (!userInputs) return <p>Error: User inputs not available.</p>;
        return <PaperSelectionStep 
                  userInputs={userInputs} 
                  initialSelectedPapers={selectedPapers} 
                  onNext={handlePaperSelectionNext} 
                  onBack={handleBack} 
                  apiProvider={apiProvider}
                />;
      case AppStep.CATEGORIZATION:
        if (selectedPapers.length === 0) return <p>Error: No papers selected.</p>;
        return <CategorizationStep 
                  selectedPapers={selectedPapers} 
                  onNext={handleCategorizationNext} 
                  onBack={handleBack} 
                  apiProvider={apiProvider}
                />;
      case AppStep.DRAFTING:
        if (finalSections.length === 0 || selectedPapers.length === 0) return <p>Error: Sections or papers not finalized.</p>;
        return <DraftingStep 
                  sections={finalSections} 
                  selectedPapers={selectedPapers} 
                  onBack={handleBack} 
                  onRestart={handleRestart}
                  apiProvider={apiProvider}
                />;
      default:
        return <p>Unknown step.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-100 via-primary-50 to-secondary-100 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <header className="mb-6 text-center w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-primary-700 sm:text-5xl">
          {APP_TITLE}
        </h1>
        <p className="mt-3 text-lg text-secondary-600 max-w-2xl mx-auto">
          Streamline your research writing with AI-powered assistance for discovering, organizing, and drafting your related work.
        </p>
        <div className="mt-6 flex justify-center items-center gap-4">
          <label htmlFor="apiProviderSelect" className="text-sm font-medium text-secondary-700">AI Provider:</label>
          <select
            id="apiProviderSelect"
            value={apiProvider}
            onChange={(e) => setApiProvider(e.target.value as ApiProvider)}
            className="px-3 py-1.5 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </header>
      
      <main className="w-full max-w-4xl mx-auto">
        <StepIndicator currentStep={currentStep} />
        <div className="mt-8">
          {renderStepContent()}
        </div>
      </main>

      <footer className="mt-16 text-center text-sm text-secondary-500">
        <p>&copy; {new Date().getFullYear()} {APP_TITLE}.</p>
      </footer>
    </div>
  );
};

export default App;
