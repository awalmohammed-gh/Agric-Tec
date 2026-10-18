import {
  LayoutDashboard,
  Leaf,
  Smartphone,
  FileText,
  Bot,
  Stethoscope,
  Wheat,
  HandCoins,
  Store,
  UserCog,
  UserRound,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Farm Records', href: '/records', icon: Leaf },
      { label: 'MoMo Transactions', href: '/momo', icon: Smartphone },
      { label: 'Financial Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    title: 'AI Powered',
    items: [
      { label: 'AI Assistant', href: '/assistant', icon: Bot },
      { label: 'AI Crop Doctor', href: '/crop-doctor', icon: Stethoscope },
      { label: 'AI Yield Predictor', href: '/yield-predictor', icon: Wheat },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Loans & Credit', href: '/loans', icon: HandCoins },
      { label: 'Market & Weather', href: '/market', icon: Store },
    ],
  },
  {
    title: 'Account',
    items: [
      // Profile lives on the Settings page (/profile redirects there).
      { label: 'Profile & Settings', href: '/settings', icon: UserCog },
    ],
  },
];

export const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Welcome. Start building your digital financial identity.',
  },
  '/records': {
    title: 'Farm Records',
    subtitle: 'Track crops, activities, income and expenses.',
  },
  '/momo': {
    title: 'MoMo Transactions',
    subtitle: 'All your MoMo inflows and outflows.',
  },
  '/reports': {
    title: 'Financial Reports',
    subtitle: 'Generate income, expense, loan and tax reports you can share with lenders.',
  },
  '/assistant': {
    title: 'AI Assistant',
    subtitle: 'Ask anything about farming, finance and loans.',
  },
  '/crop-doctor': {
    title: 'AI Crop Doctor',
    subtitle: 'Upload a photo of your crop to detect diseases and get treatment advice.',
  },
  '/yield-predictor': {
    title: 'AI Yield Predictor',
    subtitle: 'Estimate your harvest and expected revenue before the season ends.',
  },
  '/loans': {
    title: 'Loans & Credit',
    subtitle: 'Check your credit score, compare lenders and apply for farm loans.',
  },
  '/market': {
    title: 'Market & Weather',
    subtitle: 'Live crop prices and local weather to plan your farm work.',
  },
  '/settings': {
    title: 'Profile & Settings',
    subtitle: 'Your farmer identity, verification, preferences and data in one place.',
  },
};

/** True when `pathname` is the item's page or one of its nested routes. */
export const isNavActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Mobile bottom bar: four direct destinations; the Menu button sits in the middle. */
export const MOBILE_PRIMARY_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Records', href: '/records', icon: Leaf },
  { label: 'Crop Doctor', href: '/crop-doctor', icon: Stethoscope },
  { label: 'Profile', href: '/settings', icon: UserRound },
];

/**
 * The mobile Menu sheet: every page not in the bottom bar, in sidebar order. The bar's
 * Profile opens the Profile & Settings page at the top, so Settings here jumps straight
 * to its preferences section.
 */
export const MOBILE_MENU_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item) => !MOBILE_PRIMARY_NAV.some((primary) => primary.href === item.href),
  ),
  { label: 'Settings', href: '/settings#preferences', icon: Settings },
];
