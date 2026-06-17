import styles from '../styles/ModeToggle.module.css';

interface ModeToggleProps {
  mode: 'success' | 'failure';
  onChange: (mode: 'success' | 'failure') => void;
  disabled: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const groupClass = [styles.group, disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Mode</span>
      <div className={groupClass} role="radiogroup" aria-label="Generation mode">
        <input
          type="radio"
          id="mode-success"
          name="mode"
          value="success"
          checked={mode === 'success'}
          onChange={() => !disabled && onChange('success')}
          className={styles.radio}
          disabled={disabled}
        />
        <label
          htmlFor="mode-success"
          className={`${styles.option} ${mode === 'success' ? styles.active : ''}`}
        >
          Success
        </label>

        <input
          type="radio"
          id="mode-failure"
          name="mode"
          value="failure"
          checked={mode === 'failure'}
          onChange={() => !disabled && onChange('failure')}
          className={styles.radio}
          disabled={disabled}
        />
        <label
          htmlFor="mode-failure"
          className={`${styles.option} ${mode === 'failure' ? styles.active : ''}`}
        >
          Failure
        </label>
      </div>
    </div>
  );
}
