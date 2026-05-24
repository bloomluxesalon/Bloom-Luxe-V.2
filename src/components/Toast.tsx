import { AlertCircle, CheckCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const Toast: React.FC<{
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`animate-slide-in px-6 py-4 rounded-2xl text-white text-sm font-bold shadow-xl flex gap-2 items-center border border-white/20 ${
        type === 'success' ? 'bg-[#15803D]/95' : 'bg-red-600/95'
      }`}
    >
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      {message}
    </div>
  );
}

let toastListener: ((msg: string, type: 'success' | 'error') => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error') => {
  if (toastListener) toastListener(message, type);
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);

  useEffect(() => {
    toastListener = (msg, type) => {
      setToasts((prev) => [...prev, { id: Math.random().toString(), msg, type }]);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  return (
    <div id="toast-container" className="fixed top-4 right-4 z-[70] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.msg} type={t.type} onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}
