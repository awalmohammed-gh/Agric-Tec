// Demo world for the admin console (admin spec Section 9).
// Every choice comes from one fixed-seed generator and every date is relative to the start of
// today, so a reset on the same day rebuilds exactly the same world. Never use Math.random here.

import { addMinutes, differenceInCalendarDays, format, startOfDay, subDays } from 'date-fns';
import { LOAN_PERIODS, LOAN_PURPOSES } from '@/constants/loan-partners';
import { REGIONS } from '@/constants/regions';
import { calculateCreditScore } from '@/lib/calculations/credit-score';
import { monthlyRepayment } from '@/lib/calculations/loan';
import { readAdmins, writeAdmins, type StoredAdmin } from '@/lib/admin/admin-session';
import {
  DEFAULT_ASSISTANT_KB,
  DEFAULT_CREDIT_CONFIG,
  DEFAULT_CROP_CONTENT,
  DEFAULT_DIAGNOSES,
  DEFAULT_FLAGS,
  DEFAULT_LENDERS,
  DEFAULT_MARKET_PRICES,
  DEFAULT_PLANS,
} from '@/lib/admin/defaults';
import { readUsers, writeUsers, type FarmerData } from '@/lib/admin/farmer-data';
import {
  FARMER_ADMIN_META,
  FARMER_DATA,
  PLATFORM_KEYS,
  SEED_FARMER_PREFIX,
} from '@/lib/admin/keys';
import { hashGhanaCard } from '@/lib/admin/card-hash';
import { detectRisks } from '@/lib/admin/risk-rules';
import { CONFIGURED_SUPER_ADMIN } from '@/lib/admin/super-admin';
import type { RejectReason } from '@/lib/admin/verification-queue';
import { constituenciesOf } from '@/constants/constituencies';
import { maskGhanaCard } from '@/lib/profile';
import { rejectionMessage } from '@/lib/verification';
import { hashPassword, type StoredUser } from '@/services/auth.service';
import { storage, userKey } from '@/services/storage';
import type { Crop, Diagnosis, FarmRecord, MomoNetwork, MomoTransaction, Profile } from '@/types';
import type {
  AccountStatus,
  AdminRole,
  Announcement,
  LoanApplication,
  LoanStatus,
  RiskFlag,
  VerificationRequest,
} from '@/types/admin';

/** Change this and every reset produces a different (but still repeatable) world. */
export const SEED = 20260101;

/** Demo only. Shown on the admin login page and in Team & Roles. */
export const DEMO_PASSWORDS = {
  superAdmin: 'Admin@2026',
  team: 'Team@2026',
  farmer: 'Farmer@2026',
} as const;

export const SUPER_ADMIN_ID = 'admin-super';
export const SUPER_ADMIN_EMAIL = 'superadmin@agrictec.app';

// ---------- Deterministic random ----------

export interface Random {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
  shuffle: <T>(items: readonly T[]) => T[];
}

/** mulberry32: a small, fast PRNG. The same seed always gives the same sequence. */
export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

// ---------- Ghana reference data ----------

/** 60 farmers: every region at least twice, weighted towards Ashanti, Eastern, Bono, Northern and Volta. */
const FARMERS_PER_REGION: Record<string, number> = {
  Ashanti: 9,
  Eastern: 7,
  Bono: 6,
  Northern: 6,
  Volta: 6,
  Western: 3,
  Central: 3,
  'Greater Accra': 3,
  'Bono East': 3,
  Ahafo: 2,
  'Western North': 2,
  Oti: 2,
  Savannah: 2,
  'Upper East': 2,
  'Upper West': 2,
  'North East': 2,
};

type Zone = 'cocoa' | 'middle' | 'north' | 'volta' | 'coast';

const REGION_ZONE: Record<string, Zone> = {
  Western: 'cocoa',
  'Western North': 'cocoa',
  Ashanti: 'cocoa',
  Eastern: 'cocoa',
  Ahafo: 'cocoa',
  Central: 'cocoa',
  Bono: 'middle',
  'Bono East': 'middle',
  Northern: 'north',
  Savannah: 'north',
  'North East': 'north',
  'Upper East': 'north',
  'Upper West': 'north',
  Volta: 'volta',
  Oti: 'volta',
  'Greater Accra': 'coast',
};

/** The first crop is the zone's main crop. */
const ZONE_CROPS: Record<Zone, Crop[]> = {
  cocoa: ['Cocoa', 'Plantain', 'Cassava', 'Maize'],
  middle: ['Maize', 'Yam', 'Cassava', 'Cocoa'],
  north: ['Maize', 'Groundnut', 'Yam', 'Rice'],
  volta: ['Rice', 'Cassava', 'Maize', 'Yam'],
  coast: ['Tomato', 'Cassava', 'Maize'],
};

const NAMES: Record<'akan' | 'north' | 'ewe' | 'ga', { first: string[]; last: string[] }> = {
  akan: {
    first: [
      'Akosua',
      'Abena',
      'Ama',
      'Efua',
      'Adwoa',
      'Afua',
      'Yaa',
      'Akua',
      'Esi',
      'Gifty',
      'Kwame',
      'Kofi',
      'Yaw',
      'Kwaku',
      'Kwabena',
      'Kojo',
      'Kwasi',
      'Kwadwo',
      'Samuel',
      'Daniel',
    ],
    last: [
      'Mensah',
      'Owusu',
      'Boateng',
      'Asante',
      'Osei',
      'Agyeman',
      'Appiah',
      'Darko',
      'Ofori',
      'Amoah',
      'Antwi',
      'Frimpong',
      'Danso',
      'Nyarko',
      'Badu',
      'Acheampong',
      'Sarpong',
    ],
  },
  north: {
    first: [
      'Fatima',
      'Amina',
      'Mariama',
      'Ayishetu',
      'Hawa',
      'Zenabu',
      'Seidu',
      'Ibrahim',
      'Abdulai',
      'Mohammed',
      'Iddrisu',
      'Alhassan',
      'Yakubu',
      'Mahama',
    ],
    last: [
      'Issah',
      'Abdulai',
      'Iddrisu',
      'Alhassan',
      'Mahama',
      'Yakubu',
      'Salifu',
      'Sulemana',
      'Bawa',
      'Fuseini',
      'Mumuni',
      'Dramani',
    ],
  },
  ewe: {
    first: [
      'Selasi',
      'Dzifa',
      'Enyonam',
      'Mawusi',
      'Esinam',
      'Selorm',
      'Edem',
      'Elikem',
      'Kodzo',
      'Senyo',
    ],
    last: ['Agbeko', 'Kpodo', 'Amegah', 'Adzraku', 'Gbedemah', 'Dogbe', 'Agbenyo', 'Ahiadzro'],
  },
  ga: {
    first: ['Naa', 'Dede', 'Adoley', 'Nii', 'Nortey', 'Comfort', 'Grace', 'Emmanuel'],
    last: ['Tetteh', 'Quaye', 'Lamptey', 'Laryea', 'Ankrah', 'Addo'],
  },
};

const ZONE_NAMES: Record<Zone, keyof typeof NAMES> = {
  cocoa: 'akan',
  middle: 'akan',
  north: 'north',
  volta: 'ewe',
  coast: 'ga',
};

/** The spec's example names, each placed in a fitting region. */
const NAMED_FARMERS: { name: string; region: string }[] = [
  { name: 'Akosua Mensah', region: 'Ashanti' },
  { name: 'Kwame Owusu', region: 'Eastern' },
  { name: 'Abena Boateng', region: 'Bono' },
  { name: 'Yaw Asante', region: 'Ashanti' },
  { name: 'Fatima Issah', region: 'Northern' },
  { name: 'Seidu Abdulai', region: 'Northern' },
];

const REGION_CENTRE: Record<string, [number, number]> = {
  Ahafo: [7.0, -2.4],
  Ashanti: [6.7, -1.6],
  Bono: [7.5, -2.5],
  'Bono East': [7.75, -1.05],
  Central: [5.5, -1.0],
  Eastern: [6.3, -0.5],
  'Greater Accra': [5.65, -0.15],
  'North East': [10.5, -0.4],
  Northern: [9.4, -0.85],
  Oti: [8.0, 0.3],
  Savannah: [9.1, -1.8],
  'Upper East': [10.8, -0.9],
  'Upper West': [10.3, -2.2],
  Volta: [6.6, 0.47],
  Western: [5.3, -2.1],
  'Western North': [6.3, -2.8],
};

const REGION_MARKET: Record<string, string> = {
  Ahafo: 'Goaso market',
  Ashanti: 'Kumasi Central Market',
  Bono: 'Sunyani market',
  'Bono East': 'Techiman market',
  Central: 'Cape Coast market',
  Eastern: 'Koforidua market',
  'Greater Accra': 'Agbogbloshie market',
  'North East': 'Nalerigu market',
  Northern: 'Tamale market',
  Oti: 'Dambai market',
  Savannah: 'Damongo market',
  'Upper East': 'Bolgatanga market',
  'Upper West': 'Wa market',
  Volta: 'Ho market',
  Western: 'Takoradi market',
  'Western North': 'Sefwi Wiawso market',
};

const PHONE_PREFIXES = ['24', '54', '55', '59', '20', '50', '27', '57', '26', '56'];

const NETWORKS: MomoNetwork[] = ['MTN', 'MTN', 'MTN', 'Telecel', 'Telecel', 'AirtelTigo'];

const SUSPENDED_REASONS = [
  'A lender reported repeated fake sales records.',
  'Identity details do not match the Ghana Card submitted.',
  'Under investigation for a shared MoMo wallet with another account.',
];

/** Reviewed-and-rejected cards in the history (reasons from the reviewer's list). */
const SEED_REJECTIONS: { reason: RejectReason; note: string }[] = [
  { reason: 'Unclear', note: 'The photo of the card is unreadable.' },
  { reason: "Doesn't match name", note: 'The name on the card does not match your profile.' },
  { reason: 'Number format invalid', note: 'Check the number on your card and try again.' },
];

// ---------- Planted cases for the risk rules ----------

/** Farmer indexes with deliberately suspicious data. All are active and joined 8+ months ago. */
const PLANTED = {
  duplicateMomo: 4,
  burst: 9,
  sharedPhoneA: 14,
  sharedPhoneB: 15,
  outlier: 22,
  spike: 31,
  backdated: 40,
  sharedCardA: 47,
  sharedCardB: 48,
} as const;
const PLANTED_INDEXES = new Set<number>(Object.values(PLANTED));
const PLANTED_CARD_LAST4 = '4821';
const PLANTED_MOMO_REF = 'MOMO771204';

// ---------- The world ----------

export interface SeedFarmer {
  user: StoredUser;
  data: FarmerData;
}

export interface SeedWorld {
  farmers: SeedFarmer[];
  admins: StoredAdmin[];
  verifications: VerificationRequest[];
  applications: LoanApplication[];
  riskFlags: RiskFlag[];
  announcements: Announcement[];
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Builds the whole demo world without writing anything. Same day + same SEED = same world. */
export async function buildSeedWorld(now = new Date()): Promise<SeedWorld> {
  const rand = createRandom(SEED);
  const today = startOfDay(now);
  /** A timestamp `daysAgo` days before today at hh:mm local time. */
  const at = (daysAgo: number, hour = 9, minute = 0) =>
    addMinutes(subDays(today, daysAgo), hour * 60 + minute).toISOString();
  const day = (daysAgo: number) => format(subDays(today, daysAgo), 'yyyy-MM-dd');

  const [farmerHash, teamHash, superHash] = await Promise.all([
    hashPassword(DEMO_PASSWORDS.farmer),
    hashPassword(DEMO_PASSWORDS.team),
    hashPassword(DEMO_PASSWORDS.superAdmin),
  ]);

  // Team (spec: the super admin, 1 admin, 2 support, 1 analyst).
  const team: { id: string; name: string; email: string; role: AdminRole; daysAgo: number }[] = [
    {
      id: SUPER_ADMIN_ID,
      name: 'Super Admin',
      email: SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      daysAgo: 365,
    },
    {
      id: 'admin-efua',
      name: 'Efua Asantewaa',
      email: 'efua.asantewaa@agrictec.app',
      role: 'admin',
      daysAgo: 300,
    },
    {
      id: 'admin-kofi',
      name: 'Kofi Adjei',
      email: 'kofi.adjei@agrictec.app',
      role: 'support',
      daysAgo: 200,
    },
    {
      id: 'admin-ama',
      name: 'Ama Serwaa',
      email: 'ama.serwaa@agrictec.app',
      role: 'support',
      daysAgo: 150,
    },
    {
      id: 'admin-yaw',
      name: 'Yaw Darko',
      email: 'yaw.darko@agrictec.app',
      role: 'analyst',
      daysAgo: 90,
    },
  ];
  const owner = CONFIGURED_SUPER_ADMIN;
  const admins: StoredAdmin[] = team.map((member) => {
    const isSuper = member.id === SUPER_ADMIN_ID;
    return {
      id: member.id,
      name: member.name,
      // The owner's .env sign-in replaces the demo one (the password was chosen, so no forced
      // change at first login). Otherwise the demo super admin must change its password.
      email: isSuper && owner ? owner.email : member.email,
      role: member.role,
      status: 'active',
      mustChangePassword: isSuper && !owner,
      createdAt: at(member.daysAgo),
      ...(!isSuper && { createdBy: SUPER_ADMIN_ID }),
      passwordHash: isSuper ? (owner?.passwordHash ?? superHash) : teamHash,
      ...(isSuper && owner && { configuredFrom: owner.fingerprint }),
    };
  });
  const reviewer = (role: 'admin' | 'support') =>
    role === 'admin' ? 'Efua Asantewaa' : rand.pick(['Kofi Adjei', 'Ama Serwaa']);

  // Regions: shuffled, then each named farmer swapped into the first slot of their region.
  const regions = rand.shuffle(
    REGIONS.flatMap((region) => Array<string>(FARMERS_PER_REGION[region]).fill(region)),
  );
  const fixedNames = new Map<number, string>();
  for (const named of NAMED_FARMERS) {
    const index = regions.findIndex((r, i) => r === named.region && !fixedNames.has(i));
    fixedNames.set(index, named.name);
  }

  // Statuses: 85% active, 5% suspended, 10% pending verification. Planted farmers stay active.
  const statusOrder = rand.shuffle(regions.map((_, i) => i).filter((i) => !PLANTED_INDEXES.has(i)));
  const status = new Map<number, AccountStatus>();
  statusOrder.slice(0, 3).forEach((i) => status.set(i, 'suspended'));
  statusOrder.slice(3, 9).forEach((i) => status.set(i, 'pending_verification'));

  const usedNames = new Set<string>(fixedNames.values());
  const usedPhones = new Set<string>();
  const usedCards = new Set<string>([PLANTED_CARD_LAST4]);
  let momoCounter = 0;
  const farmers: SeedFarmer[] = [];
  const verifications: VerificationRequest[] = [];
  const pendingCards = new Map<string, string>();
  /** Last four digits of each verified card (the profile keeps only the masked form). */
  const verifiedCards = new Map<string, string>();

  regions.forEach((region, index) => {
    const userId = `${SEED_FARMER_PREFIX}${pad(index + 1, 3)}`;
    const zone = REGION_ZONE[region];
    const planted = PLANTED_INDEXES.has(index);
    const accountStatus = status.get(index) ?? 'active';

    // Name: fixed, or a unique pick from the region's naming pool.
    let name = fixedNames.get(index);
    while (!name || (!fixedNames.has(index) && usedNames.has(name))) {
      const pool = NAMES[ZONE_NAMES[zone]];
      name = `${rand.pick(pool.first)} ${rand.pick(pool.last)}`;
    }
    usedNames.add(name);
    const [first, last] = name.split(' ');

    let phone = '';
    while (!phone || usedPhones.has(phone)) {
      phone = `+233${rand.pick(PHONE_PREFIXES)}${pad(rand.int(0, 9_999_999), 7)}`;
    }
    usedPhones.add(phone);
    // Planted: the second account reuses the first one's phone number.
    if (index === PLANTED.sharedPhoneB) phone = farmers[PLANTED.sharedPhoneA].data.profile.phone;

    const farmTypeRoll = rand.next();
    const farmType: Profile['farmType'] =
      farmTypeRoll < 0.75 ? 'Smallholder' : farmTypeRoll < 0.9 ? 'Cooperative' : 'Commercial';
    const acres = planted
      ? 4
      : farmType === 'Smallholder'
        ? rand.int(1, 15)
        : farmType === 'Cooperative'
          ? rand.int(20, 60)
          : rand.int(30, 120);
    const zoneCrops = ZONE_CROPS[zone];
    const primaryCrops = [
      ...new Set<Crop>([
        rand.chance(0.8) ? zoneCrops[0] : rand.pick(zoneCrops),
        ...Array.from({ length: rand.int(0, 2) }, () => rand.pick(zoneCrops)),
      ]),
    ];
    const [lat, lng] = REGION_CENTRE[region];
    const gps = {
      lat: Math.round((lat + (rand.next() - 0.5) * 0.5) * 10000) / 10000,
      lng: Math.round((lng + (rand.next() - 0.5) * 0.5) * 10000) / 10000,
    };

    // Ghana Card: verified for about a third; pending-verification farmers have none yet.
    const cardVerified =
      index === PLANTED.sharedCardA || index === PLANTED.sharedCardB
        ? true
        : accountStatus !== 'pending_verification' && rand.chance(0.35);
    let cardLast4: string | undefined;
    if (index === PLANTED.sharedCardA || index === PLANTED.sharedCardB) {
      cardLast4 = PLANTED_CARD_LAST4;
    } else if (cardVerified || accountStatus === 'pending_verification') {
      while (!cardLast4 || usedCards.has(cardLast4)) cardLast4 = pad(rand.int(1000, 9999), 4);
      usedCards.add(cardLast4);
    }

    const signupDaysAgo = planted ? rand.int(240, 360) : rand.int(0, 364);
    const profile: Profile = {
      userId,
      name,
      phone,
      email: `${first}.${last}@agrictec.demo`.toLowerCase(),
      region,
      farmName:
        farmType === 'Cooperative'
          ? `${region} ${primaryCrops[0]} Growers`
          : `${last} ${primaryCrops[0]} Farm`,
      useNameAsFarmName: false,
      // Constituency: picked by position, not from rand, so the rest of the seed is unchanged.
      constituency: constituenciesOf(region)[index % constituenciesOf(region).length] ?? '',
      acres,
      sizeUnit: 'acres',
      farmType,
      ...(farmType === 'Cooperative' && {
        cooperativeName: `${region} ${primaryCrops[0]} Growers`,
      }),
      primaryCrops,
      gps,
      ghanaCard:
        cardVerified && cardLast4
          ? { status: 'verified', masked: maskGhanaCard(cardLast4) }
          : { status: 'not_provided' },
      verification: {
        phone: rand.chance(0.85),
        location: rand.chance(0.6),
        ghanaCard: cardVerified,
      },
      onboardingCompletedAt: at(signupDaysAgo, 8, index % 60),
    };
    if (cardVerified && cardLast4) verifiedCards.set(userId, cardLast4);
    if (accountStatus === 'pending_verification' && cardLast4) pendingCards.set(userId, cardLast4);

    // Records: one income per month at most and narrow ranges, so ordinary farmers never
    // look like outliers or spikes. Amounts scale with farm size by one factor per farmer.
    const scale = 1 + acres / 25;
    const market = REGION_MARKET[region];
    const records: FarmRecord[] = [];
    const incomeMonths = new Set<string>();
    const addRecord = (
      daysAgo: number,
      type: FarmRecord['type'],
      crop: Crop,
      description: string,
      amount: number,
      createdAt = at(daysAgo, 8 + (records.length % 10), records.length % 60),
    ) => {
      records.push({
        id: `${userId}-rec-${pad(records.length + 1)}`,
        userId,
        type,
        description,
        crop,
        amount,
        date: day(daysAgo),
        createdAt,
      });
    };

    const recordCount = planted ? 18 : rand.int(0, 40);
    for (let i = 0; i < recordCount; i++) {
      const daysAgo = rand.int(0, signupDaysAgo);
      const crop = rand.pick(primaryCrops);
      const roll = rand.next();
      const month = day(daysAgo).slice(0, 7);
      if (roll < 0.35 && !incomeMonths.has(month)) {
        incomeMonths.add(month);
        addRecord(
          daysAgo,
          'income',
          crop,
          crop === 'Cocoa' ? 'Cocoa sales to LBC' : `${crop} sales at ${market}`,
          roundTo(rand.int(2000, 6000) * scale, 10),
        );
      } else if (roll < 0.75) {
        const description = rand.pick([
          `Certified ${crop.toLowerCase()} seed`,
          'NPK fertilizer',
          'Labour for weeding',
          `Transport to ${market}`,
          'Pesticide spray',
          'Land preparation (tractor hire)',
        ]);
        addRecord(daysAgo, 'expense', crop, description, roundTo(rand.int(300, 1500) * scale, 10));
      } else {
        const description = rand.pick([
          `Planted ${crop.toLowerCase()}`,
          `Weeded ${crop.toLowerCase()} field`,
          `Harvested ${crop.toLowerCase()}`,
          'Applied fertilizer',
        ]);
        addRecord(daysAgo, 'activity', crop, description, 0);
      }
    }

    // Planted cases.
    const mainCrop = primaryCrops[0];
    if (index === PLANTED.burst) {
      for (let i = 0; i < 15; i++) {
        addRecord(
          9,
          i % 3 ? 'activity' : 'expense',
          mainCrop,
          `Field work batch ${i + 1}`,
          i % 3 ? 0 : 400,
        );
      }
    }
    if (index === PLANTED.outlier) {
      for (let i = 0; i < 6; i++)
        addRecord(20 + i * 25, 'expense', mainCrop, 'NPK fertilizer', 800 + i * 50);
      addRecord(12, 'expense', mainCrop, 'Tractor purchase', 48000);
    }
    if (index === PLANTED.spike) {
      for (let m = 2; m <= 7; m++)
        addRecord(m * 30 + 5, 'income', mainCrop, `${mainCrop} sales at ${market}`, 4200);
      for (let i = 0; i < 3; i++)
        addRecord(5 + i * 4, 'income', mainCrop, `Bulk ${mainCrop.toLowerCase()} sale`, 14000);
    }
    if (index === PLANTED.backdated) {
      for (let i = 0; i < 10; i++) {
        addRecord(60 + i * 15, 'expense', mainCrop, 'Late entry: farm inputs', 600, at(3, 21, i));
      }
    }
    records.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const momo: MomoTransaction[] = [];
    const momoCount = planted ? 8 : rand.int(0, 20);
    for (let i = 0; i < momoCount; i++) {
      const daysAgo = rand.int(0, signupDaysAgo);
      const incoming = rand.chance(0.55);
      momoCounter++;
      momo.push({
        id: `${userId}-momo-${pad(i + 1)}`,
        userId,
        direction: incoming ? 'in' : 'out',
        counterparty: incoming
          ? rand.pick(['Produce buyer', `${market} trader`, 'Cooperative payout', 'LBC payment'])
          : rand.pick(['Agro-input shop', 'Farm labour', 'Transport', 'Tractor service']),
        amount: incoming ? roundTo(rand.int(300, 5000), 10) : roundTo(rand.int(100, 3000), 10),
        reference: `MOMO${100000 + momoCounter * 37}`,
        network: rand.pick(NETWORKS),
        date: day(daysAgo),
        createdAt: at(daysAgo, 12, i % 60),
      });
    }
    if (index === PLANTED.duplicateMomo) {
      momo.push(
        {
          id: `${userId}-momo-dup-1`,
          userId,
          direction: 'in',
          counterparty: 'Produce buyer',
          amount: 2500,
          reference: PLANTED_MOMO_REF,
          network: 'MTN',
          date: day(16),
          createdAt: at(16, 10),
        },
        {
          id: `${userId}-momo-dup-2`,
          userId,
          direction: 'in',
          counterparty: 'Produce buyer',
          amount: 3100,
          reference: PLANTED_MOMO_REF,
          network: 'MTN',
          date: day(11),
          createdAt: at(11, 15),
        },
      );
    }
    momo.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const diagnoses: Diagnosis[] = [];
    if (rand.chance(0.3)) {
      const options = DEFAULT_DIAGNOSES.filter((d) => !d.crop || primaryCrops.includes(d.crop));
      const count = rand.int(1, 3);
      for (let i = 0; i < count; i++) {
        const picked = rand.pick(options);
        const daysAgo = rand.int(0, Math.min(120, signupDaysAgo));
        diagnoses.push({
          id: `${userId}-diag-${pad(i + 1)}`,
          userId,
          disease: picked.disease,
          severity: picked.severity,
          confidence: picked.confidence,
          treatment: picked.treatment,
          crop: picked.crop ?? mainCrop,
          date: at(daysAgo, 14),
        });
      }
    }

    const tags = [
      ...(farmType === 'Cooperative' && rand.chance(0.5) ? ['cooperative-lead'] : []),
      ...(rand.chance(0.25) ? ['pilot-2026'] : []),
    ];
    const adminNotes =
      accountStatus === 'suspended' || rand.chance(0.1)
        ? [
            {
              id: `${userId}-note-1`,
              text:
                accountStatus === 'suspended'
                  ? 'Suspended pending review. Contact the farmer before reactivating.'
                  : 'Called the farmer to confirm their farm size. Details are correct.',
              by: 'Efua Asantewaa',
              at: at(rand.int(0, Math.max(0, signupDaysAgo - 1)), 11),
            },
          ]
        : [];
    // Two of the three suspended farmers have appealed (the overview's "needs attention" list).
    const suspendedSoFar = farmers.filter((f) => f.user.status === 'suspended').length;
    if (accountStatus === 'suspended' && suspendedSoFar < 2) {
      tags.push('appeal');
      adminNotes.unshift({
        id: `${userId}-note-2`,
        text: 'The farmer appealed the suspension by phone and asked for a review.',
        by: 'Kofi Adjei',
        at: at(Math.max(0, Math.min(3, signupDaysAgo)), 15),
      });
    }

    const user: StoredUser = {
      id: userId,
      email: profile.email,
      passwordHash: farmerHash,
      isGuest: false,
      createdAt: at(signupDaysAgo, 7, index % 60),
      status: accountStatus,
      ...(accountStatus === 'suspended' && {
        suspendedReason:
          SUSPENDED_REASONS[farmers.filter((f) => f.user.status === 'suspended').length],
      }),
      lastActiveAt: at(
        Math.min(
          signupDaysAgo,
          accountStatus === 'suspended' ? rand.int(40, 120) : rand.int(0, 60),
        ),
        18,
      ),
    };

    farmers.push({ user, data: { profile, records, momo, diagnoses, meta: { tags, adminNotes } } });
  });

  // Verifications: 12 pending (8 Ghana Cards, 2 phone, 2 location), plus the reviewed history.
  // Card numbers are made up per farmer and never stored: only the mask and a hash are kept.
  // (Pending requests draw nothing from `rand`, so adding them keeps the rest of the seed fixed.)
  const indexOf = (farmer: SeedFarmer) => farmers.indexOf(farmer);
  const cardNumber = (seedIndex: number, last4: string) =>
    `GHA-${100000 + ((seedIndex * 7919) % 900000)}${last4.slice(0, 3)}-${last4[3]}`;
  const addVerification = async (
    farmer: SeedFarmer,
    status: VerificationRequest['status'],
    daysAgo: number,
    kind: VerificationRequest['kind'],
    /** The full card number for ghanaCard; the phone or "lat, lng" otherwise. */
    value: string,
    rejection?: { reason: string; note: string },
  ) => {
    const card = kind === 'ghanaCard';
    verifications.push({
      id: `seed-verif-${pad(verifications.length + 1)}`,
      userId: farmer.user.id,
      kind,
      submittedValue: card ? maskGhanaCard(value.replace(/\D/g, '').slice(-4)) : value,
      ...(card && { valueHash: await hashGhanaCard(value) }),
      status,
      submittedAt: at(daysAgo, 10),
      ...(status !== 'pending' && {
        reviewedBy: reviewer('support'),
        reviewedAt: at(Math.max(0, daysAgo - 1), 15),
      }),
      ...(rejection && { reason: rejection.reason, note: rejection.note }),
    });
  };
  const daysSince = (iso: string) => differenceInCalendarDays(today, new Date(iso));

  // The planted duplicate: a second account submits the same card as Yaw Asante.
  const yaw = farmers.find((f) => f.data.profile.name === 'Yaw Asante');
  const yawLast4 = yaw && (pendingCards.get(yaw.user.id) ?? verifiedCards.get(yaw.user.id));
  const firstPending = farmers.find((f) => pendingCards.has(f.user.id));
  const duplicateOf =
    yaw && yawLast4
      ? cardNumber(indexOf(yaw), yawLast4)
      : firstPending && cardNumber(indexOf(firstPending), pendingCards.get(firstPending.user.id)!);
  const duplicateOwner = yaw && yawLast4 ? yaw : firstPending;

  for (const farmer of farmers) {
    const last4 = pendingCards.get(farmer.user.id);
    if (last4)
      await addVerification(
        farmer,
        'pending',
        rand.int(0, Math.min(10, daysSince(farmer.user.createdAt))),
        'ghanaCard',
        cardNumber(indexOf(farmer), last4),
      );
  }
  const unverifiedActive = rand.shuffle(
    farmers.filter((f) => f.user.status === 'active' && !f.data.profile.verification.ghanaCard),
  );
  const queued = new Set<string>();
  let cardsQueued = 0;
  for (const farmer of unverifiedActive.slice(0, 6)) {
    let last4 = '';
    while (!last4 || usedCards.has(last4)) last4 = pad(rand.int(1000, 9999), 4);
    usedCards.add(last4);
    const daysAgo = rand.int(0, Math.min(14, daysSince(farmer.user.createdAt)));
    // Two cards from these farmers (the first reuses the duplicate number); the other slots
    // become the phone and location checks below.
    if (cardsQueued === 2 || farmer === duplicateOwner) continue;
    const number =
      cardsQueued === 0 && duplicateOf ? duplicateOf : cardNumber(indexOf(farmer), last4);
    await addVerification(farmer, 'pending', daysAgo, 'ghanaCard', number);
    queued.add(farmer.user.id);
    cardsQueued++;
  }
  // Pending phone and location checks (for bulk approval): active farmers not yet verified.
  const candidates = farmers.filter(
    (f, i) => f.user.status === 'active' && !PLANTED_INDEXES.has(i) && !queued.has(f.user.id),
  );
  const phoneChecks = candidates.filter((f) => !f.data.profile.verification.phone).slice(0, 2);
  const locationChecks = candidates
    .filter((f) => !f.data.profile.verification.location && f.data.profile.gps)
    .filter((f) => !phoneChecks.includes(f))
    .slice(0, 2);
  for (const [i, farmer] of phoneChecks.entries())
    await addVerification(farmer, 'pending', 1 + i * 3, 'phone', farmer.data.profile.phone);
  for (const [i, farmer] of locationChecks.entries()) {
    const { lat, lng } = farmer.data.profile.gps!;
    await addVerification(
      farmer,
      'pending',
      2 + i * 2,
      'location',
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    );
  }

  for (const farmer of unverifiedActive.slice(6, 9)) {
    let last4 = '';
    while (!last4 || usedCards.has(last4)) last4 = pad(rand.int(1000, 9999), 4);
    usedCards.add(last4);
    const daysAgo = rand.int(2, Math.max(2, daysSince(farmer.user.createdAt)));
    await addVerification(
      farmer,
      'rejected',
      daysAgo,
      'ghanaCard',
      cardNumber(indexOf(farmer), last4),
      rand.pick(SEED_REJECTIONS),
    );
  }
  for (const farmer of farmers.filter((f) => f.data.profile.verification.ghanaCard)) {
    const index = indexOf(farmer);
    // The two planted shared-card accounts really do hold the same card.
    const numberIndex = index === PLANTED.sharedCardB ? PLANTED.sharedCardA : index;
    await addVerification(
      farmer,
      'approved',
      rand.int(1, Math.max(1, daysSince(farmer.user.createdAt))),
      'ghanaCard',
      cardNumber(numberIndex, verifiedCards.get(farmer.user.id) ?? '0000'),
    );
  }

  // Each profile's Ghana Card follows its latest request (as the verifications service does):
  // verified, pending or rejected with the reason, with the mask and hash of that request.
  for (const farmer of farmers) {
    const latest = verifications
      .filter((v) => v.userId === farmer.user.id && v.kind === 'ghanaCard')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    if (!latest) continue;
    const profile = farmer.data.profile;
    const status =
      profile.verification.ghanaCard || latest.status === 'approved'
        ? 'verified'
        : latest.status === 'pending'
          ? 'pending'
          : 'rejected';
    profile.ghanaCard = {
      status,
      masked: latest.submittedValue,
      ...(latest.valueHash && { hash: latest.valueHash }),
      submittedAt: latest.submittedAt,
      ...(status === 'rejected' && { rejectedReason: rejectionMessage(latest) }),
    };
  }

  // Loan applications: 25 across every status, each with a valid history.
  interface LoanPlan {
    /** Every status the application passed through; the last one is its current status. */
    path: LoanStatus[];
    ageDays: [number, number];
  }
  const repeat = (count: number, plan: LoanPlan): LoanPlan[] =>
    Array.from({ length: count }, () => plan);
  const statusPlan: LoanPlan[] = [
    ...repeat(5, { path: ['submitted'], ageDays: [0, 6] }),
    ...repeat(4, { path: ['submitted', 'under_review'], ageDays: [5, 20] }),
    ...repeat(3, { path: ['submitted', 'under_review', 'approved'], ageDays: [15, 40] }),
    ...repeat(2, { path: ['submitted', 'rejected'], ageDays: [5, 60] }),
    ...repeat(2, { path: ['submitted', 'under_review', 'rejected'], ageDays: [10, 90] }),
    ...repeat(4, {
      path: ['submitted', 'under_review', 'approved', 'disbursed'],
      ageDays: [40, 120],
    }),
    ...repeat(3, {
      path: ['submitted', 'under_review', 'approved', 'disbursed', 'repaid'],
      ageDays: [180, 300],
    }),
    ...repeat(2, {
      path: ['submitted', 'under_review', 'approved', 'disbursed', 'defaulted'],
      ageDays: [150, 300],
    }),
  ];
  const notes: Partial<Record<LoanStatus, string>> = {
    under_review: 'Documents received. Checking records with the lender.',
    approved: 'Consistent records and income. Approved by the lender.',
    rejected: 'Income records are too thin for the amount requested.',
    disbursed: 'Funds sent to the farmer’s MoMo wallet.',
    repaid: 'Fully repaid on schedule.',
    defaulted: 'No repayment for three months after several reminders.',
  };
  const applicants = rand.shuffle(
    farmers.filter((f) => f.user.status === 'active' && f.data.records.length >= 5),
  );
  const usedReferences = new Set<string>();
  const applications: LoanApplication[] = statusPlan.slice(0, applicants.length).map((plan, i) => {
    const farmer = applicants[i];
    const lender = rand.pick(DEFAULT_LENDERS);
    const months = rand.pick(
      LOAN_PERIODS.filter((m) => m >= lender.minMonths && m <= lender.maxMonths),
    );
    const amount = roundTo(rand.int(2000, Math.min(lender.maxAmount, 30000)), 500);
    const age = Math.min(
      rand.int(plan.ageDays[0], plan.ageDays[1]),
      Math.max(0, daysSince(farmer.user.createdAt) - 1),
    );
    const step = Math.max(1, Math.floor(age / plan.path.length));
    const createdAt = at(age, 9, i);
    let reference = '';
    while (!reference || usedReferences.has(reference)) {
      reference = `APP-${createdAt.slice(0, 4)}-${rand.int(10000, 99999)}`;
    }
    usedReferences.add(reference);
    return {
      id: `seed-app-${pad(i + 1)}`,
      reference,
      userId: farmer.user.id,
      partnerId: lender.id,
      amount,
      months,
      purpose: rand.pick(LOAN_PURPOSES),
      rate: lender.rate,
      monthly: monthlyRepayment(amount, lender.rate, months).monthly,
      scoreAtApplication: calculateCreditScore(
        farmer.data.records,
        farmer.data.momo,
        farmer.data.profile,
      ).score,
      status: plan.path[plan.path.length - 1],
      history: plan.path.map((status, s) => ({
        status,
        by:
          s === 0
            ? farmer.data.profile.name
            : reviewer(status === 'under_review' ? 'support' : 'admin'),
        at: s === 0 ? createdAt : at(Math.max(0, age - s * step), 14, s),
        ...(notes[status] && { note: notes[status] }),
      })),
      createdAt,
    };
  });

  // Risk flags: the real rules run over the seeded data (finding the planted cases).
  const riskFlags: RiskFlag[] = detectRisks(
    farmers.map(({ user, data }) => ({
      userId: user.id,
      profile: data.profile,
      records: data.records,
      momo: data.momo,
    })),
  ).map((risk, i) => ({
    ...risk,
    id: `seed-risk-${pad(i + 1)}`,
    status: 'open',
    detectedAt: at(0, 6, i),
  }));

  const announcements: Announcement[] = [
    {
      id: 'seed-ann-1',
      title: 'Ghana Card checks are now faster',
      message:
        'Most Ghana Card verifications are now reviewed within one working day. Verify yours to raise your credit score.',
      type: 'success',
      audience: { kind: 'all' },
      startsAt: at(3, 8),
      endsAt: at(-30, 8),
      active: true,
      dismissible: true,
      createdBy: 'Super Admin',
      createdAt: at(3, 8),
    },
    {
      id: 'seed-ann-2',
      title: 'Dry spell expected in the Northern Region',
      message:
        'Little rain is expected over the next two weeks. Delay planting and mulch to keep soil moisture.',
      type: 'warning',
      audience: { kind: 'region', regions: ['Northern'] },
      startsAt: at(1, 7),
      endsAt: at(-14, 7),
      active: true,
      dismissible: true,
      createdBy: 'Efua Asantewaa',
      createdAt: at(1, 7),
    },
    {
      id: 'seed-ann-3',
      title: 'Cocoa price review',
      message:
        'COCOBOD has announced the new season’s farmgate price. Check the Market page for details.',
      type: 'info',
      audience: { kind: 'crop', crops: ['Cocoa'] },
      startsAt: at(40, 8),
      endsAt: at(10, 8),
      active: false,
      dismissible: true,
      createdBy: 'Efua Asantewaa',
      createdAt: at(40, 8),
    },
  ];

  return { farmers, admins, verifications, applications, riskFlags, announcements };
}

// ---------- Writing ----------

/** When the demo platform was last seeded (or reset), or null if never. */
export const seededAt = (): string | null => storage.get<string | null>(PLATFORM_KEYS.seeded, null);

export const isSeeded = (): boolean =>
  storage.get<string | null>(PLATFORM_KEYS.seeded, null) !== null;

/** Platform keys a demo reset rebuilds. The team and the audit trail are never wiped. */
const RESETTABLE_KEYS = Object.entries(PLATFORM_KEYS)
  .filter(([name]) => !['admins', 'audit', 'auditArchive'].includes(name))
  .map(([, key]) => key);

/** Removes seeded farmers (and their data) and every resettable platform key. Real accounts stay. */
export function clearSeedData(): void {
  const users = readUsers();
  users.filter((u) => u.id.startsWith(SEED_FARMER_PREFIX)).forEach((u) => storage.clearUser(u.id));
  writeUsers(users.filter((u) => !u.id.startsWith(SEED_FARMER_PREFIX)));
  RESETTABLE_KEYS.forEach((key) => storage.remove(key));
}

/**
 * Seeds the demo platform once (spec Section 9): on the first admin login, if there is no seed.
 * `force` re-seeds anyway (used by "Reset demo data", after clearSeedData). An existing admin team
 * is kept, so a reset never signs anyone out or reverts passwords. Returns whether it seeded.
 */
export async function seedPlatform({ force = false }: { force?: boolean } = {}): Promise<boolean> {
  if (!force && isSeeded()) return false;
  const world = await buildSeedWorld();

  writeUsers([
    ...readUsers().filter((u) => !u.id.startsWith(SEED_FARMER_PREFIX)),
    ...world.farmers.map((f) => f.user),
  ]);
  for (const { user, data } of world.farmers) {
    storage.set(userKey(user.id, FARMER_DATA.profile), data.profile);
    storage.set(userKey(user.id, FARMER_DATA.records), data.records);
    storage.set(userKey(user.id, FARMER_DATA.momo), data.momo);
    storage.set(userKey(user.id, FARMER_DATA.diagnoses), data.diagnoses);
    storage.set(userKey(user.id, FARMER_ADMIN_META), data.meta);
  }

  if (readAdmins().length === 0) writeAdmins(world.admins);
  storage.set(PLATFORM_KEYS.creditConfig, DEFAULT_CREDIT_CONFIG);
  storage.set(PLATFORM_KEYS.creditHistory, []);
  storage.set(PLATFORM_KEYS.flags, DEFAULT_FLAGS);
  storage.set(PLATFORM_KEYS.plans, DEFAULT_PLANS);
  storage.set(PLATFORM_KEYS.lenders, DEFAULT_LENDERS);
  storage.set(PLATFORM_KEYS.market, DEFAULT_MARKET_PRICES);
  storage.set(PLATFORM_KEYS.weatherOverride, null);
  storage.set(PLATFORM_KEYS.crops, DEFAULT_CROP_CONTENT);
  storage.set(PLATFORM_KEYS.assistantKb, DEFAULT_ASSISTANT_KB);
  storage.set(PLATFORM_KEYS.diagnoses, DEFAULT_DIAGNOSES);
  storage.set(PLATFORM_KEYS.announcements, world.announcements);
  storage.set(PLATFORM_KEYS.verifications, world.verifications);
  storage.set(PLATFORM_KEYS.loanApplications, world.applications);
  storage.set(PLATFORM_KEYS.riskFlags, world.riskFlags);
  storage.set(PLATFORM_KEYS.seeded, new Date().toISOString());
  return true;
}
