import React, { useState, useRef, useEffect } from 'react';
import { UserInfo } from '../types';

interface OnboardingProps {
  onComplete: (userInfo: UserInfo) => void;
}

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [aiName, setAiName] = useState('Avi');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1 || step === 3) {
      inputRef.current?.focus();
    }
  }, [step]);

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      setError('Please enter your name!');
      return;
    }
    if (step === 2 && !gender) {
      setError('Please select an option!');
      return;
    }
    if (step === 3 && !aiName.trim()) {
      setError('Please give your friend a name!');
      return;
    }
    setError('');
    if (step === 3) {
      onComplete({ name, gender, aiName });
    } else {
      setStep(step + 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <h2 className="text-2xl font-bold text-strong mb-2">Welcome!</h2>
            <p className="text-subtle mb-6">Let's get to know each other. What's your name?</p>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 bg-input text-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 transition-all duration-200"
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </>
        );
      case 2:
        return (
          <>
            <h2 className="text-2xl font-bold text-strong mb-2">Nice to meet you, {name}!</h2>
            <p className="text-subtle mb-6">How do you identify?</p>
            <div className="grid grid-cols-2 gap-3">
              {GENDERS.map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${gender === g ? 'bg-primary-600 text-white scale-105' : 'bg-input text-strong hover:bg-slate-200'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h2 className="text-2xl font-bold text-strong mb-2">Got it. One last thing!</h2>
            <p className="text-subtle mb-6">I need a name. What would you like to call me?</p>
            <input
              ref={inputRef}
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="e.g., Avi, Sparky, Finn"
              className="w-full px-4 py-3 bg-input text-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 transition-all duration-200"
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md bg-main rounded-2xl shadow-2xl p-8 m-4 text-center">
      <div className="w-24 h-24 rounded-full mx-auto mb-6 bg-primary-600/20 flex items-center justify-center">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="min-h-[150px]">
        {renderStep()}
      </div>
       {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      <button
        onClick={handleNext}
        className="w-full mt-6 px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-slate-400 transition-all duration-200 transform hover:scale-105 active:scale-95"
      >
        {step === 3 ? "Let's Chat!" : 'Continue'}
      </button>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-6">
        <div className="bg-primary-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
      </div>
    </div>
  );
};