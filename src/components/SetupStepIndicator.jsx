// src/components/SetupStepIndicator.jsx — HDK Stark indicator
import { useLanguage } from '../utils/i18n.jsx';

export default function SetupStepIndicator({ currentStep, totalSteps }) {
  const { t } = useLanguage();
  const steps = [
    t('step_1'),
    t('step_2'),
    t('step_3'),
    t('step_4'),
  ];

  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done    = stepNum < currentStep;
        const active  = stepNum === currentStep;
        return (
          <div key={stepNum} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 flex items-center justify-center text-sm font-bold hdk-border transition-colors ${
                  done
                    ? 'bg-black text-white'
                    : active
                    ? 'bg-yellow-100 text-black font-bold border-2 border-black'
                    : 'bg-white text-slate-400'
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              <span className={`text-[10px] sm:text-xs mt-1.5 text-center hidden sm:block uppercase tracking-wider font-bold ${active ? 'text-black' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mb-5 transition-colors ${done ? 'bg-black' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
