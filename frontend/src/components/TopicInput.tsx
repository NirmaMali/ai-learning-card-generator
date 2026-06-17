import { useState, type FormEvent } from 'react';
import styles from '../styles/TopicInput.module.css';

interface TopicInputProps {
  onSubmit: (topic: string) => void;
  isGenerating: boolean;
}

export function TopicInput({ onSubmit, isGenerating }: TopicInputProps) {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
  };

  return (
    <form className={styles.wrapper} onSubmit={handleSubmit} role="search">
      <div className={styles.inputContainer}>
        <input
          type="text"
          className={styles.input}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Photosynthesis, Newton's Laws"
          disabled={isGenerating}
          aria-label="Learning topic"
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        className={styles.button}
        disabled={isGenerating || !topic.trim()}
        aria-label={isGenerating ? 'Generating cards...' : 'Generate learning cards'}
      >
        <span className={styles.buttonContent}>
          {isGenerating && <span className={styles.spinner} aria-hidden="true" />}
          {isGenerating ? 'Generating...' : 'Generate'}
        </span>
      </button>
    </form>
  );
}
