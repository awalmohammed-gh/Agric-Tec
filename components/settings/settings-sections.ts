import {
  BadgeCheck,
  Info,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface SettingsSectionMeta {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** The sections of the Profile & Settings page, in page order. Ids are URL anchors. */
export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'verification', label: 'Verification', icon: BadgeCheck },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'account', label: 'Account & data', icon: ShieldCheck },
  { id: 'about', label: 'About', icon: Info },
];
