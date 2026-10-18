import type { Metadata } from 'next';
import { FarmDetailsForm } from '@/components/profile/farm-details-form';
import { PersonalInfoForm } from '@/components/profile/personal-info-form';
import { VerificationGrid } from '@/components/profile/verification-grid';
import { AboutCard } from '@/components/settings/about-card';
import { AccountHero } from '@/components/settings/account-hero';
import { AccountSettings } from '@/components/settings/account-settings';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { DataSettings } from '@/components/settings/data-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsSection } from '@/components/settings/settings-section';

export const metadata: Metadata = { title: 'Profile & Settings' };

/** Profile and settings on one page: an identity header, then anchored sections. */
export default function SettingsPage() {
  return (
    <div className="@container space-y-6">
      <AccountHero />
      <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-[200px_minmax(0,1fr)] @5xl:items-start">
        <SettingsNav />
        <div className="@container min-w-0 space-y-10">
          <SettingsSection id="profile" description="Who you are and what you farm">
            <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-2">
              <PersonalInfoForm />
              <FarmDetailsForm />
            </div>
          </SettingsSection>
          <SettingsSection id="verification" description="Checks that build lender trust">
            <VerificationGrid />
          </SettingsSection>
          <SettingsSection id="preferences" description="Theme, language and alerts">
            <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-2">
              <AppearanceSettings />
              <NotificationSettings />
            </div>
          </SettingsSection>
          <SettingsSection id="account" description="Your plan, backups and data">
            <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <AccountSettings />
              <DataSettings />
            </div>
          </SettingsSection>
          <SettingsSection id="about" description="Version and how your data is stored">
            <AboutCard />
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
