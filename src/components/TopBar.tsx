import { Menu, X } from 'lucide-react';

export type AppSection = 'workspace' | 'architecture';

interface TopBarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  isAuthenticated: boolean;
  onPrimaryAction: () => void;
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export function TopBar({
  activeSection,
  onSelectSection,
  isAuthenticated,
  onPrimaryAction,
  mobileMenuOpen,
  onToggleMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 shrink-0">
        {isAuthenticated && onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Close documents panel' : 'Open documents panel'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelectSection('workspace')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Pulore DocQA
        </button>
      </div>

      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <button
          type="button"
          onClick={() => onSelectSection('workspace')}
          className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
            activeSection === 'workspace'
              ? 'text-blue-700 underline underline-offset-8 decoration-2'
              : 'hover:text-slate-900'
          }`}
        >
          Workspace
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('architecture')}
          className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
            activeSection === 'architecture'
              ? 'text-blue-700 underline underline-offset-8 decoration-2'
              : 'hover:text-slate-900'
          }`}
        >
          Architecture
        </button>
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isAuthenticated ? 'Sign Out' : 'Sign In'}
        </button>
      </div>
    </header>
  );
}
