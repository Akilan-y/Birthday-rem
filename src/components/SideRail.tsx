import React from 'react';
import {
  Bell,
  Calendar,
  LayoutGrid,
  Leaf,
  MessageSquare,
  Moon,
  PieChart,
  Plus,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import type {WorkspaceView} from '../types/birthday';

interface SideRailProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onOpenAddModal: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const RAIL_ITEMS: {
  id: WorkspaceView;
  label: string;
  Icon: React.FC<{className?: string}>;
}[] = [
  {id: 'upcoming', label: 'Upcoming & Bulk Edit', Icon: LayoutGrid},
  {id: 'calendar', label: 'Calendar Agenda', Icon: Calendar},
  {id: 'statistics', label: 'Statistics', Icon: PieChart},
  {id: 'assistant', label: 'Celebration Assistant', Icon: MessageSquare},
  {id: 'reminders', label: 'Local Reminders', Icon: Bell},
  {id: 'vault', label: 'Privacy & Sync Vault', Icon: ShieldCheck},
];

export const SideRail: React.FC<SideRailProps> = ({
  activeView,
  onSelectView,
  onOpenAddModal,
  isDarkMode,
  onToggleDarkMode,
}) => {
  return (
    <aside
      aria-label="Workspace navigation"
      className="hidden md:flex flex-col items-center justify-between w-16 shrink-0 py-6 border-r border-slate-200/80 dark:border-white/[0.06]"
    >
      {/* Top Brand Emblem */}
      <button
        type="button"
        onClick={() => onSelectView('calendar')}
        title="Broll — Offline Birthday Reminder"
        aria-label="Broll Home"
        className="w-10 h-10 rounded-xl bg-[#1D8FE1]/15 dark:bg-[#1D8FE1]/20 border border-[#1D8FE1]/30 flex items-center justify-center text-[#1D8FE1] dark:text-[#38BDF8] hover:bg-[#1D8FE1]/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
      >
        <Leaf className="w-5 h-5" />
      </button>

      {/* Center Vertical Navigation Dock */}
      <nav
        aria-label="Primary views"
        className="flex flex-col items-center gap-2.5 p-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07]"
      >
        {RAIL_ITEMS.map(({id, label, Icon}) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectView(id)}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                isActive
                  ? 'bg-[#1D8FE1] text-white shadow-[0_6px_18px_rgba(29,143,225,0.45)]'
                  : 'bg-white/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.12] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </nav>

      {/* Bottom Utility Dock */}
      <div className="flex flex-col items-center gap-2.5 p-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07]">
        <button
          type="button"
          onClick={onOpenAddModal}
          title="Add Birthday"
          aria-label="Add Birthday"
          className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-[#1D8FE1] hover:text-white transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.12] hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-[#1D8FE1]" />
          )}
        </button>
      </div>
    </aside>
  );
};
