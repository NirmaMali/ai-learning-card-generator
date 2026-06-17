import type { CardState } from '../types/messages';
import styles from '../styles/LearningCard.module.css';

interface LearningCardProps {
  cardState: CardState;
  index: number;
  onRetry?: (cardIndex: number) => void;
}

export function LearningCard({ cardState, index, onRetry }: LearningCardProps) {
  if (cardState.status === 'idle') {
    return (
      <article className={`${styles.card} ${styles.idle}`}>
        Card {index + 1}
      </article>
    );
  }

  if (cardState.status === 'error') {
    return (
      <article className={`${styles.card} ${styles.error}`} role="alert">
        <div className={styles.cardNumber}>Card {index + 1}</div>
        <div className={styles.errorContent}>
          <p className={styles.errorMessage}>
            {cardState.errorMessage || 'Something went wrong.'}
          </p>
          {onRetry && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => onRetry(index + 1)}
            >
              Retry
            </button>
          )}
        </div>
      </article>
    );
  }

  if (cardState.status === 'ready' && cardState.card) {
    const { title, keyConcept, funFact } = cardState.card;

    return (
      <article className={`${styles.card} ${styles.ready}`}>
        <div className={styles.cardNumber}>Card {index + 1}</div>
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Key concept</div>
          <p className={styles.sectionContent}>{keyConcept}</p>
        </div>

        <div className={styles.funFact}>
          <div className={styles.funFactLabel}>Fun fact</div>
          <p className={styles.funFactContent}>{funFact}</p>
        </div>
      </article>
    );
  }

  return null;
}
