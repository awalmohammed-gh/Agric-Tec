'use client';

import Link from 'next/link';
import {
  Bot,
  Download,
  HandCoins,
  Plus,
  ScanLine,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useModalStore, type GlobalModal } from '@/store/modal-store';

type QuickAction = { label: string; icon: LucideIcon } & (
  { modal: GlobalModal } | { href: string }
);

const ACTIONS: QuickAction[] = [
  { label: 'Add Record', icon: Plus, modal: 'record' },
  { label: 'MoMo Txn', icon: Smartphone, modal: 'momo' },
  { label: 'Crop Scan', icon: ScanLine, href: '/crop-doctor' },
  { label: 'Ask AI', icon: Bot, href: '/assistant' },
  { label: 'Apply Loan', icon: HandCoins, href: '/loans' },
  { label: 'Export', icon: Download, href: '/reports' },
];

const tileClass =
  'glass flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-sm font-semibold text-text transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_8px_24px_-8px_var(--accent-glow)]';

function TileContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <span className="bg-accent/15 text-ink-green inline-flex size-10 items-center justify-center rounded-xl">
        <Icon size={20} aria-hidden="true" />
      </span>
      {label}
    </>
  );
}

export function QuickActions() {
  const openModal = useModalStore((s) => s.openModal);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map((action) =>
          'modal' in action ? (
            <button
              key={action.label}
              type="button"
              onClick={() => openModal(action.modal)}
              className={tileClass}
            >
              <TileContent icon={action.icon} label={action.label} />
            </button>
          ) : (
            <Link key={action.label} href={action.href} className={tileClass}>
              <TileContent icon={action.icon} label={action.label} />
            </Link>
          ),
        )}
      </div>
    </Card>
  );
}
