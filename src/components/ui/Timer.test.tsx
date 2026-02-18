import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timer from './Timer';

describe('Timer', () => {
  it('displays time remaining', () => {
    render(<Timer timeRemaining={45} totalTime={60} />);
    expect(screen.getByText('45')).toBeDefined();
  });

  it('displays 0 when time has expired', () => {
    render(<Timer timeRemaining={0} totalTime={60} />);
    expect(screen.getByText('0')).toBeDefined();
  });

  it('does not display seconds when showSeconds=false', () => {
    render(<Timer timeRemaining={45} totalTime={60} showSeconds={false} />);
    expect(screen.queryByText('45')).toBeNull();
  });

  it('renders SVG circles', () => {
    const { container } = render(<Timer timeRemaining={30} totalTime={60} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2); // background + progress
  });

  it('shows green color when time > 60%', () => {
    const { container } = render(<Timer timeRemaining={50} totalTime={60} />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#39ff14');
  });

  it('shows yellow color when time 30-60%', () => {
    const { container } = render(<Timer timeRemaining={25} totalTime={60} />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#f5e642');
  });

  it('shows red/pink color when time < 30%', () => {
    const { container } = render(<Timer timeRemaining={10} totalTime={60} />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.getAttribute('stroke')).toBe('#ff2d78');
  });
});
