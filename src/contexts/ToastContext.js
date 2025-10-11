import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = ++idCounter;
    const ttl = toast.ttl ?? 3500;
    const item = { id, type: toast.type || 'info', title: toast.title, message: toast.message };
    setToasts((prev) => [item, ...prev].slice(0, 5));
    if (ttl > 0) {
      setTimeout(() => removeToast(id), ttl);
    }
    return id;
  }, [removeToast]);

  const value = useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
