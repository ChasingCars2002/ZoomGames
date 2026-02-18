import React, { useRef, useCallback, useEffect } from 'react';

interface CarouselItem {
  id: string;
  content: React.ReactNode;
}

interface CarouselProps {
  items: CarouselItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const Carousel: React.FC<CarouselProps> = ({ items, selectedId, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  // Scroll selected item into view when selectedId changes
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-carousel-id="${selectedId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedId]);

  return (
    <div className="relative group">
      {/* Left arrow */}
      <button
        onClick={() => scroll('left')}
        className={[
          'absolute left-0 top-1/2 -translate-y-1/2 z-10',
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-navy-800/90 border border-white/10 text-white/60',
          'hover:text-white hover:border-neon-cyan/40 hover:bg-navy-700/90',
          'transition-all duration-200',
          'opacity-0 group-hover:opacity-100',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
        ].join(' ')}
        aria-label="Scroll left"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth px-12 py-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              data-carousel-id={item.id}
              onClick={() => onSelect?.(item.id)}
              className={[
                'shrink-0 rounded-xl border-2 transition-all duration-300 cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
                isSelected
                  ? 'border-neon-cyan glow-cyan scale-105'
                  : 'border-white/10 hover:border-white/30 hover:scale-[1.02]',
              ].join(' ')}
            >
              {item.content}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        className={[
          'absolute right-0 top-1/2 -translate-y-1/2 z-10',
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-navy-800/90 border border-white/10 text-white/60',
          'hover:text-white hover:border-neon-cyan/40 hover:bg-navy-700/90',
          'transition-all duration-200',
          'opacity-0 group-hover:opacity-100',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
        ].join(' ')}
        aria-label="Scroll right"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
};

export default Carousel;
