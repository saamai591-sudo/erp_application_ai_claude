import { ReactNode } from "react";

export interface WizardStepDef {
  key: string;
  label: string;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WizardSteps({ steps, activeStep }: { steps: WizardStepDef[]; activeStep: number }) {
  return (
    <div className="wizard-steps">
      {steps.map((s, i) => (
        <div key={s.key} className={`wizard-step ${i === activeStep ? "active" : ""} ${i < activeStep ? "done" : ""}`}>
          <div className="wizard-step-circle">{i < activeStep ? <CheckIcon /> : i + 1}</div>
          <span className="wizard-step-label">{s.label}</span>
          {i < steps.length - 1 && <div className="wizard-step-line" />}
        </div>
      ))}
    </div>
  );
}

export function Wizard({
  steps,
  activeStep,
  onNext,
  onBack,
  onCancel,
  onFinish,
  canProceed = true,
  finishLabel = "ذخیره",
  nextLabel = "بعدی",
  loading,
  children,
}: {
  steps: WizardStepDef[];
  activeStep: number;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onFinish?: () => void;
  canProceed?: boolean;
  finishLabel?: string;
  nextLabel?: string;
  loading?: boolean;
  children: ReactNode;
}) {
  const isLast = activeStep === steps.length - 1;
  return (
    <div className="wizard">
      <WizardSteps steps={steps} activeStep={activeStep} />
      <div className="wizard-body">{children}</div>
      <div className="wizard-footer">
        <button type="button" className="btn secondary" onClick={onCancel}>انصراف</button>
        <span style={{ flex: 1 }} />
        {activeStep > 0 && (
          <button type="button" className="btn secondary" onClick={onBack} disabled={loading}>قبلی</button>
        )}
        {!isLast && (
          <button type="button" className="btn" onClick={onNext} disabled={!canProceed || loading}>{nextLabel}</button>
        )}
        {isLast && onFinish && (
          <button type="button" className="btn" onClick={onFinish} disabled={!canProceed || loading}>{finishLabel}</button>
        )}
      </div>
    </div>
  );
}
