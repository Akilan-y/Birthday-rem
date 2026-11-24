import React from 'react';
import {
  Bell,
  Calendar,
  FileSpreadsheet,
  Images,
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
  {id: 'gallery', label: 'People & Gallery', Icon: Images},
  {id: 'calendar', label: 'Calendar Agenda', Icon: Calendar},
  {id: 'statistics', label: 'Statistics', Icon: PieChart},
  {id: 'assistant', label: 'Celebration Assistant', Icon: MessageSquare},
  {id: 'sheets', label: 'Google Sheets Sync', Icon: FileSpreadsheet},
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
      className="hidden md:flex md:sticky md:top-0 md:h-screen flex-col items-center justify-between w-16 shrink-0 py-5 bg-neutral-50/70 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800"
    >
      {/* Top Brand Mark */}
      <button
        type="button"
        onClick={() => onSelectView('calendar')}
        title="Broll — Offline Birthday Reminder"
        aria-label="Broll Home"
        className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
      >
        <Leaf className="w-4 h-4" />
      </button>

      {/* Center Navigation Stack */}
      <nav aria-label="Primary views" className="flex flex-col items-center gap-1.5">
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
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white ${
                isActive
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </nav>

      {/* Bottom Utility Actions */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenAddModal}
          title="Add Birthday"
          aria-label="Add Birthday"
          className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-950 hover:text-white hover:border-neutral-950 dark:hover:bg-white dark:hover:text-neutral-950 dark:hover:border-white transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-10 h-10 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-white"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
