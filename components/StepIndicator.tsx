
import React from 'react';
import { AppStep } from '../types';
import { STEPS_CONFIG } from '../constants';


interface StepIndicatorProps {
  currentStep: AppStep;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="flex items-center justify-center space-x-2 sm:space-x-4">
        {STEPS_CONFIG.map((step, index) => (
          <li key={step.name} className="flex-1">
            {currentStep > step.id ? (
              <div className="group flex w-full flex-col border-l-4 border-primary-600 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-primary-600 transition-colors ">{`0${step.id}`}</span>
                <span className="text-sm font-medium text-secondary-700">{step.name}</span>
              </div>
            ) : currentStep === step.id ? (
              <div
                className="flex w-full flex-col border-l-4 border-primary-600 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4"
                aria-current="step"
              >
                <span className="text-sm font-medium text-primary-600">{`0${step.id}`}</span>
                <span className="text-sm font-medium text-secondary-900">{step.name}</span>
              </div>
            ) : (
              <div className="group flex w-full flex-col border-l-4 border-secondary-200 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-secondary-500 transition-colors">{`0${step.id}`}</span>
                <span className="text-sm font-medium text-secondary-500">{step.name}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StepIndicator;
