import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !duration) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-md w-auto"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl shadow-[#171533]/5 dark:shadow-black/50 backdrop-blur-xl border transition-all ${
              isSuccess
                ? 'bg-white/95 dark:bg-[#141228]/95 border-[#22B573]/30 text-[#171533] dark:text-[#F4F3FA]'
                : isError
                ? 'bg-white/95 dark:bg-[#141228]/95 border-[#E4586E]/30 text-[#171533] dark:text-[#F4F3FA]'
                : 'bg-white/95 dark:bg-[#141228]/95 border-[#643EF3]/30 text-[#171533] dark:text-[#F4F3FA]'
            }`}
          >
            {/* Icon */}
            {isSuccess && (
              <div className="w-7 h-7 rounded-xl bg-[#22B573]/15 text-[#22B573] flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
            {isError && (
              <div className="w-7 h-7 rounded-xl bg-[#E4586E]/15 text-[#E4586E] flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            )}
            {!isSuccess && !isError && (
              <div className="w-7 h-7 rounded-xl bg-[#643EF3]/15 text-[#643EF3] flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
            )}

            {/* Message */}
            <p className="text-xs sm:text-sm font-medium pr-1 leading-snug">
              {message}
            </p>

            {/* Close button */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close notification"
                className="p-1 rounded-lg text-[#68657D] hover:text-[#171533] dark:hover:text-white hover:bg-[#F1EEFF] dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer ml-auto"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
