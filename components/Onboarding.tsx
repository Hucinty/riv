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
          <div key={1} className="animate-subtle-fade-in">
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
          </div>
        );
      case 2:
        return (
          <div key={2} className="animate-subtle-fade-in">
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
          </div>
        );
      case 3:
        return (
          <div key={3} className="animate-subtle-fade-in">
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
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md bg-main rounded-2xl shadow-2xl p-8 m-4 text-center">
      <div className="w-24 h-24 rounded-2xl mx-auto mb-6 bg-primary-600/20 flex items-center justify-center">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Head */}
            <rect x="5" y="8" width="14" height="10" rx="4" />
            {/* Eyes */}
            <line x1="9.5" y1="11.5" x2="9.5" y2="13.5" />
            <line x1="14.5" y1="11.5" x2="14.5" y2="13.5" />
            {/* Smile */}
            <path d="M9 15.5 Q 12 17 15 15.5" />
            {/* Antenna */}
            <line x1="12" y1="8" x2="12" y2="5" />
            <circle cx="12" cy="4" r="1" fill="currentColor" />
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