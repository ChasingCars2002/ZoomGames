import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge';

describe('Badge', () => {
  it('renders default label for host variant', () => {
    render(<Badge variant="host" />);
    expect(screen.getByText('HOST')).toBeDefined();
  });

  it('renders default label for player variant', () => {
    render(<Badge variant="player" />);
    expect(screen.getByText('PLAYER')).toBeDefined();
  });

  it('renders default label for bot variant', () => {
    render(<Badge variant="bot" />);
    expect(screen.getByText('BOT')).toBeDefined();
  });

  it('renders default label for ready variant', () => {
    render(<Badge variant="ready" />);
    expect(screen.getByText('READY')).toBeDefined();
  });

  it('renders default label for not-ready variant', () => {
    render(<Badge variant="not-ready" />);
    expect(screen.getByText('NOT READY')).toBeDefined();
  });

  it('renders custom children instead of default label', () => {
    render(<Badge variant="host">Custom Label</Badge>);
    expect(screen.getByText('Custom Label')).toBeDefined();
    expect(screen.queryByText('HOST')).toBeNull();
  });

  it('applies variant-specific classes', () => {
    const { container } = render(<Badge variant="host" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain('text-neon-yellow');
  });
});
