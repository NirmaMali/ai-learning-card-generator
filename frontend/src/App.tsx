import { useState, useEffect, useCallback } from 'react';
import { useCardSocket } from './hooks/useCardSocket';
import { TopicInput } from './components/TopicInput';
import { ModeToggle } from './components/ModeToggle';
import { StatusBanner } from './components/StatusBanner';
import { CardList } from './components/CardList';
import styles from './styles/App.module.css';

function App() {
  const {
    cards,
    generationState,
    connectionStatus,
    statusMessage,
    generate,
    retryCard,
    reset,
    isGenerating,
  } = useCardSocket();

  const [mode, setMode] = useState<'success' | 'failure'>('success');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSubmit = useCallback(
    (topic: string) => {
      generate(topic, mode);
    },
    [generate, mode]
  );

  const handleDismiss = useCallback(() => {
    if (generationState === 'complete' || generationState === 'error') {
      reset();
    }
  }, [generationState, reset]);

  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'error'
        ? 'Connection error'
        : 'Disconnected';

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <span />
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>Learning Cards</h1>
          <p className={styles.subtitle}>
            Type a topic to generate three cards, streamed one at a time.
          </p>
          <p className={styles.connection}>
            <span
              className={`${styles.connectionDot} ${styles[connectionStatus]}`}
              aria-hidden="true"
            />
            {connectionLabel}
          </p>
        </header>

        <div className={styles.controls}>
          <TopicInput onSubmit={handleSubmit} isGenerating={isGenerating} />
          <ModeToggle mode={mode} onChange={setMode} disabled={isGenerating} />
          <StatusBanner
            generationState={generationState}
            message={statusMessage}
            onDismiss={handleDismiss}
          />
        </div>

        <CardList cards={cards} onRetry={retryCard} />
      </div>
    </div>
  );
}

export default App;
