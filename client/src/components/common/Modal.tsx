// src/components/common/Modal.tsx
import React from 'react';
import './Modal.css';
import { Button } from './Button';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  open,
  onClose,
  onConfirm,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          {onConfirm && (
            <Button variant="primary" onClick={onConfirm}>
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
