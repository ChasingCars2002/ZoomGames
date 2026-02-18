import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerList from './PlayerList';
import { Player, Role } from '../../types';

function makePlayers(): Player[] {
  return [
    {
      id: 'host-1',
      name: 'HostUser',
      role: Role.HOST,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color: '#f5e642',
      isBot: false,
    },
    {
      id: 'p2',
      name: 'Alice',
      role: Role.PLAYER,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
      color: '#ff2d78',
      isBot: false,
    },
    {
      id: 'bot-1',
      name: 'RoboPlayer',
      role: Role.PLAYER,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      color: '#39ff14',
      isBot: true,
    },
  ];
}

describe('PlayerList', () => {
  it('renders all player names', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="host-1"
        hostId="host-1"
      />,
    );
    expect(screen.getByText('HostUser')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('RoboPlayer')).toBeDefined();
  });

  it('shows player count in heading', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="host-1"
        hostId="host-1"
      />,
    );
    expect(screen.getByText('Players (3)')).toBeDefined();
  });

  it('marks current player with (You)', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="host-1"
        hostId="host-1"
      />,
    );
    expect(screen.getByText('(You)')).toBeDefined();
  });

  it('shows HOST badge for host player', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="p2"
        hostId="host-1"
      />,
    );
    expect(screen.getByText('HOST')).toBeDefined();
  });

  it('shows BOT badge for bot player', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="p2"
        hostId="host-1"
      />,
    );
    expect(screen.getByText('BOT')).toBeDefined();
  });

  it('shows READY and NOT READY badges', () => {
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="p2"
        hostId="host-1"
      />,
    );
    // host-1 and bot-1 are ready, p2 is not
    const readyBadges = screen.getAllByText('READY');
    const notReadyBadges = screen.getAllByText('NOT READY');
    expect(readyBadges.length).toBe(2);
    expect(notReadyBadges.length).toBe(1);
  });

  it('shows kick button for non-host players when current user is host', () => {
    const onKick = vi.fn();
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="host-1"
        hostId="host-1"
        onKick={onKick}
      />,
    );
    // Should have kick buttons for Alice and RoboPlayer (not for host)
    const kickButtons = screen.getAllByTitle('Kick player');
    expect(kickButtons).toHaveLength(2);
  });

  it('calls onKick with player id when kick button is clicked', () => {
    const onKick = vi.fn();
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="host-1"
        hostId="host-1"
        onKick={onKick}
      />,
    );
    const kickButtons = screen.getAllByTitle('Kick player');
    fireEvent.click(kickButtons[0]);
    expect(onKick).toHaveBeenCalledWith('p2');
  });

  it('does not show kick buttons when current user is not host', () => {
    const onKick = vi.fn();
    render(
      <PlayerList
        players={makePlayers()}
        currentPlayerId="p2"
        hostId="host-1"
        onKick={onKick}
      />,
    );
    expect(screen.queryAllByTitle('Kick player')).toHaveLength(0);
  });
});
