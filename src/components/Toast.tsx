/**
 * @ai-file component
 * @ai-description Short-lived success or error message in the top-right corner
 * @ai-dependencies React, react-icons/bi
 * @ai-features
 * - Success and error variants with matching icon
 * - Optional custom icon (login/logout use user icons)
 * - Announced to screen readers (status for success, alert for errors)
 */

import React from 'react';
import { BiCheck, BiError } from 'react-icons/bi';

interface ToastProps {
  type: 'success' | 'error';
  message: string;
  icon?: React.ReactNode;
}

const Toast: React.FC<ToastProps> = ({ type, message, icon }) => (
  <div className="fixed top-4 right-4 z-50 animate-fade-in" role={type === 'error' ? 'alert' : 'status'}>
    <div className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-md border ${
      type === 'success'
        ? 'bg-green-900/90 text-green-100 border-green-500/30'
        : 'bg-red-900/90 text-red-100 border-red-500/30'
    }`}>
      <div className="flex items-center space-x-2">
        {icon ?? (type === 'success'
          ? <BiCheck className="flex-shrink-0" size={20} />
          : <BiError className="flex-shrink-0" size={20} />)}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  </div>
);

export default Toast;
