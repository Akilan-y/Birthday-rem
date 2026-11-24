import React from 'react';
import {
  Bell,
  Calendar,
  Images,
  LayoutGrid,
  MessageSquare,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import type {WorkspaceView} from '../types/birthday';

interface MobileBottomNavProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
}

const ITEMS: {id: WorkspaceView; label: string; Icon: React.FC<{className?: string}>}[] = [
  {id: 'calendar', label: 'Calendar', Icon: Calendar},
  {id: 'upcoming', label: 'Upcoming', Icon: LayoutGrid},
  {id: 'gallery', label: 'Gallery', Icon: Images},
  {id: 'statistics', label: 'Stats', Icon: PieChart},
  {id: 'assistant', label: 'Assistant', Icon: MessageSquare},
  {id: 'reminders', label: 'Alerts', Icon: Bell},
  {id: 'vault', label: 'Vault', Icon: ShieldCheck},
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
}) => {
  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
    >
      <div className="grid grid-cols-7 h-14">
        {ITEMS.map(({id, label, Icon}) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectView(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'text-neutral-950 dark:text-white font-semibold'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-3 h-0.5 bg-neutral-950 dark:bg-white"
                />
              )}
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
