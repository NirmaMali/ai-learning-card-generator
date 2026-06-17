import styles from '../styles/CardSkeleton.module.css';

interface CardSkeletonProps {
  index: number;
}

export function CardSkeleton({ index }: CardSkeletonProps) {
  return (
    <div
      className={styles.skeleton}
      role="status"
      aria-label={`Loading card ${index + 1}`}
    >
      <div className={styles.lineShort} />
      <div className={styles.lineTitle} />
      <div className={styles.lineFull} />
      <div className={styles.lineMedium} />
      <div className={styles.lineEnd} />
      <div className={styles.thinkingDots} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <span className="sr-only">Loading card {index + 1}</span>
    </div>
  );
}
