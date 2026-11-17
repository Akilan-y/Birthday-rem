import React from 'react';
import {
  Bell,
  Calendar,
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#161E2A]/95 backdrop-blur-md"
    >
      <div className="grid grid-cols-6 h-14">
        {ITEMS.map(({id, label, Icon}) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectView(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'text-[#1D8FE1] dark:text-[#38BDF8]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
