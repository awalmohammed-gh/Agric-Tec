import type { ReactNode } from 'react';
import { AnimatedBackground } from '@/components/layout/animated-background';
import { MobileNavOverlay } from '@/components/layout/mobile-nav-overlay';
import { PageContainer } from '@/components/layout/page-container';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { DataLoader } from '@/components/providers/data-loader';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnimatedBackground />
      <DataLoader>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNavOverlay />
          {/* The 900px breakpoint matches the sidebar, so content never sits under it. */}
          <main className="min-w-0 flex-1 px-5 py-6 pb-16 min-[900px]:ml-[260px] md:px-8">
            <Topbar />
            <PageContainer>{children}</PageContainer>
          </main>
        </div>
      </DataLoader>
    </>
  );
}
