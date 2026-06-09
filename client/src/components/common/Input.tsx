// src/components/common/Input.tsx
import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, ...props }) => {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className={`form-control ${error ? 'is-invalid' : ''}`} {...props} />
      {error && <span className="form-error">{error}</span>}
      {helperText && <span className="form-helper">{helperText}</span>}
    </div>
  );
};
