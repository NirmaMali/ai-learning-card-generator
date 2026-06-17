import type { CardState } from '../types/messages';
import { LearningCard } from './LearningCard';
import { CardSkeleton } from './CardSkeleton';
import styles from '../styles/CardList.module.css';

interface CardListProps {
  cards: CardState[];
  onRetry: (cardIndex: number) => void;
}

export function CardList({ cards, onRetry }: CardListProps) {
  return (
    <div
      className={styles.grid}
      role="region"
      aria-label="Learning cards"
      aria-live="polite"
    >
      {cards.map((cardState, index) => {
        if (cardState.status === 'loading') {
          return <CardSkeleton key={`skeleton-${index}`} index={index} />;
        }

        return (
          <LearningCard
            key={`card-${index}`}
            cardState={cardState}
            index={index}
            onRetry={onRetry}
          />
        );
      })}
    </div>
  );
}
