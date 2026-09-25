import confetti from 'canvas-confetti';
import { STATUSES } from '../api.js';
import { showToast } from '../toast.js';

export default function StatusSelect({ value, onChange, ...rest }) {
  const handleChange = (nextValue) => {
    if (nextValue === 'interviewing') {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#F59E0B', '#FBBF24', '#FDE68A'],
      });
    }

    if (nextValue === 'offer') {
      confetti({
        particleCount: 180,
        spread: 120,
        startVelocity: 42,
        origin: { y: 0.5 },
        colors: ['#F59E0B', '#FCD34D', '#FB923C', '#FDE68A'],
      });
      showToast('🎉 Congrats! You got an offer!');
    }

    onChange(nextValue);
  };

  return (
    <select
      className={`status-select status-${value}`}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      {...rest}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
