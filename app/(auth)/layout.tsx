import type { ReactNode } from 'react';
import { AnimatedBackground } from '@/components/layout/animated-background';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Card } from '@/components/ui/card';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnimatedBackground />
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="animate-fade-in w-full max-w-[440px]">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo subtitle="Digital Identity" />
            <p className="text-text-dim mt-3 text-sm">Build your digital financial identity</p>
          </div>
          <Card padding="lg">{children}</Card>
          <p className="text-text-mute mt-6 text-center text-xs">
            Built for Ghana&apos;s smallholder farmers 🇬🇭
          </p>
        </div>
      </main>
    </>
  );
}
