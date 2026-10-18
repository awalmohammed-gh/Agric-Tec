'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<V extends string> {
  value: V;
  label: string;
}

export interface TabsProps<V extends string> {
  tabs: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  label?: string;
  className?: string;
}

export function Tabs<V extends string>({ tabs, value, onChange, label, className }: TabsProps<V>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(tabs[next].value);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <div
        role="tablist"
        aria-label={label}
        className="glass inline-flex min-w-max gap-1 rounded-2xl p-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'min-h-10 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-all duration-200',
                selected
                  ? 'bg-linear-to-br from-[#34d399] to-[#10b981] text-[#022c22] shadow-[0_4px_16px_-4px_var(--accent-glow)]'
                  : 'text-text-dim hover:bg-glass-strong hover:text-text',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
