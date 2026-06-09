// src/components/auth/LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks';
import { Input, Button, Alert } from '../common';
import { validateEmail } from '../../utils';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { login, isLoading, error, clearError } = useAuth();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';

    if (!formData.password) newErrors.password = 'Password is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await login(formData.email, formData.password);
      onSuccess?.();
    } catch (err) {
      // Error handled by useAuth hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {error && <Alert type="error" message={error} onClose={clearError} />}

      <Input
        type="email"
        label="Email"
        placeholder="Enter your email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        error={errors.email}
      />

      <Input
        type="password"
        label="Password"
        placeholder="Enter your password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        error={errors.password}
      />

      <Button type="submit" loading={isLoading} fullWidth>
        Sign In
      </Button>
    </form>
  );
};
