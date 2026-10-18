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
  User,
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
      { label: 'Profile', href: '/profile', icon: User },
      { label: 'Settings', href: '/settings', icon: Settings },
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
    subtitle: 'Track your income, expenses and farm activities.',
  },
  '/momo': {
    title: 'MoMo Transactions',
    subtitle: 'Log your mobile money payments to strengthen your financial history.',
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
  '/profile': {
    title: 'Profile',
    subtitle: 'Your farmer identity: the details lenders see.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage your theme, language, notifications and data.',
  },
};
