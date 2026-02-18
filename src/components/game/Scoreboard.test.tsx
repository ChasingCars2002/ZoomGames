import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Scoreboard from './Scoreboard';
import { Player, Role } from '../../types';

function makePlayers(): Player[] {
  return [
    {
      id: 'p1',
      name: 'Alice',
      role: Role.HOST,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color: '#f5e642',
      isBot: false,
    },
    {
      id: 'p2',
      name: 'Bob',
      role: Role.PLAYER,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color: '#ff2d78',
      isBot: false,
    },
    {
      id: 'p3',
      name: 'Charlie',
      role: Role.PLAYER,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color: '#00e5ff',
      isBot: false,
    },
  ];
}

describe('Scoreboard', () => {
  it('renders "Scoreboard" heading', () => {
    render(
      <Scoreboard
        scores={{ p1: 0, p2: 0, p3: 0 }}
        players={makePlayers()}
        currentPlayerId="p1"
      />,
    );
    expect(screen.getByText('Scoreboard')).toBeDefined();
  });

  it('renders all player names', () => {
    render(
      <Scoreboard
        scores={{ p1: 100, p2: 200, p3: 50 }}
        players={makePlayers()}
        currentPlayerId="p1"
      />,
    );
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('marks current player with (You)', () => {
    render(
      <Scoreboard
        scores={{ p1: 100, p2: 200, p3: 50 }}
        players={makePlayers()}
        currentPlayerId="p1"
      />,
    );
    expect(screen.getByText('(You)')).toBeDefined();
  });

  it('sorts players by score descending', () => {
    const { container } = render(
      <Scoreboard
        scores={{ p1: 100, p2: 500, p3: 300 }}
        players={makePlayers()}
        currentPlayerId="p1"
      />,
    );
    const names = container.querySelectorAll('.truncate');
    // First name should be Bob (500), then Charlie (300), then Alice (100)
    expect(names[0].textContent).toContain('Bob');
    expect(names[1].textContent).toContain('Charlie');
    expect(names[2].textContent).toContain('Alice');
  });

  it('shows rank numbers for players outside top 3', () => {
    const players: Player[] = [
      ...makePlayers(),
      {
        id: 'p4',
        name: 'Diana',
        role: Role.PLAYER,
        ready: true,
        connected: true,
        joinedAt: Date.now(),
        color: '#39ff14',
        isBot: false,
      },
    ];

    render(
      <Scoreboard
        scores={{ p1: 100, p2: 500, p3: 300, p4: 50 }}
        players={players}
        currentPlayerId="p1"
      />,
    );
    expect(screen.getByText('#4')).toBeDefined();
  });
});
