import type { GenerationState } from '../types/messages';
import styles from '../styles/StatusBanner.module.css';

interface StatusBannerProps {
  generationState: GenerationState;
  message: string;
  onDismiss: () => void;
}

export function StatusBanner({ generationState, message, onDismiss }: StatusBannerProps) {
  if (!message || (generationState !== 'complete' && generationState !== 'error')) {
    return null;
  }

  const variant = generationState === 'complete' ? styles.success : styles.error;

  return (
    <div className={`${styles.banner} ${variant}`} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
