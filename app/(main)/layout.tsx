import type { ReactNode } from 'react';
import { AnimatedBackground } from '@/components/layout/animated-background';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileNavOverlay } from '@/components/layout/mobile-nav-overlay';
import { PageContainer } from '@/components/layout/page-container';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MomoFormModal } from '@/components/momo/momo-form-modal';
import { RecordFormModal } from '@/components/records/record-form-modal';
import { DataLoader } from '@/components/providers/data-loader';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnimatedBackground />
      <DataLoader>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNavOverlay />
          {/* 900px matches the sidebar; 272px = 12px inset + 260px floating sidebar.
              Below 900px the bottom padding clears the mobile bar and the device safe area. */}
          <main className="min-w-0 flex-1 px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] min-[900px]:ml-[272px] min-[900px]:pt-6 min-[900px]:pb-16 md:px-8">
            <Topbar />
            <PageContainer>{children}</PageContainer>
          </main>
          <MobileNav />
        </div>
        {/* App-wide form modals, opened from anywhere through useModalStore. */}
        <RecordFormModal />
        <MomoFormModal />
      </DataLoader>
    </>
  );
}
