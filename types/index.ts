// ---------- Core domain types (spec Section 4) ----------

export type RecordType = 'income' | 'expense' | 'activity';
export type Crop =
  'Maize' | 'Cassava' | 'Rice' | 'Cocoa' | 'Yam' | 'Plantain' | 'Groundnut' | 'Tomato' | 'Other';

export interface FarmRecord {
  id: string; // crypto.randomUUID(), never Date.now()
  userId: string;
  type: RecordType;
  description: string; // ONE field name everywhere (old code mixed desc/description)
  crop: Crop;
  amount: number; // activities may be 0
  date: string; // ISO yyyy-MM-dd
  notes?: string;
  createdAt: string;
}

export interface MomoTransaction {
  id: string;
  userId: string;
  direction: 'in' | 'out';
  counterparty: string;
  amount: number;
  reference: string;
  network?: MomoNetwork;
  date: string;
  createdAt: string;
}

export interface Diagnosis {
  id: string;
  userId: string;
  disease: string;
  severity: Severity;
  confidence: number;
  treatment: string;
  crop?: Crop;
  imageThumb?: string;
  date: string;
}

export interface Profile {
  userId: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  farmName: string;
  acres: number;
  farmType: 'Smallholder' | 'Commercial' | 'Cooperative';
  primaryCrops: string[];
  gps?: { lat: number; lng: number };
  verification: { phone: boolean; location: boolean; ghanaCard: boolean };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string | AssistantReply; // AI messages store structured replies
  createdAt: string;
}

export interface CreditScoreBreakdown {
  score: number; // 300–850
  paymentHistory: number; // 0–100
  recordCompleteness: number; // 0–100
  incomeStability: number; // 0–100
  momoActivity: number; // 0–100
  verification: number; // 0–100
}

// ---------- Supporting types ----------

export type MomoNetwork = 'MTN' | 'Telecel' | 'AirtelTigo';
export type Severity = 'None' | 'Moderate' | 'High';
export type ReportType = 'income' | 'expense' | 'loan' | 'tax';
export type Language = 'en' | 'tw' | 'ga' | 'ee' | 'ha';

export type NewRecordInput = Omit<FarmRecord, 'id' | 'userId' | 'createdAt'>;
export type NewMomoInput = Omit<MomoTransaction, 'id' | 'userId' | 'createdAt'>;
export type NewDiagnosisInput = Omit<Diagnosis, 'id' | 'userId'>;
/** What a diagnosis engine returns, before it is saved to history. */
export type DiagnosisResult = Omit<Diagnosis, 'id' | 'userId' | 'date' | 'imageThumb'>;

export interface User {
  id: string;
  email: string;
  isGuest: boolean;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  isGuest: boolean;
  startedAt: string;
}

export interface LoanPartner {
  id: string;
  name: string;
  rate: number; // annual %
  maxAmount: number;
  minMonths: number;
  maxMonths: number;
  minScore: number;
  color: string;
}

export interface MarketPrice {
  crop: Crop | string;
  unit: string;
  price: number;
  change: number;
}

export type WeatherCondition = 'sunny' | 'partly-cloudy' | 'showers' | 'storm';

export interface Weather {
  condition: WeatherCondition;
  temp: number;
  description: string;
  humidity: number;
  rainChance: number;
}

export interface YieldInput {
  crop: Crop;
  acres: number;
  season: 'major' | 'minor';
  fertilizer: 'both' | 'inorganic' | 'organic' | 'none';
  irrigation: 'rainfed' | 'drip' | 'sprinkler';
}

export interface YieldResult {
  low: number;
  expected: number;
  high: number;
  perAcre: number;
  revenue: number;
  pricePerTonne: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAffordable: number;
}

export interface RepaymentResult {
  monthly: number;
  total: number;
  interest: number;
}

export interface ReadinessItem {
  key: string;
  label: string;
  description: string;
  done: boolean;
}

export interface AssistantReply {
  title: string;
  intro?: string;
  bullets?: string[];
  tip?: string;
}

export interface NotificationSettings {
  aiInsights: boolean;
  weatherAlerts: boolean;
  priceAlerts: boolean;
}

// ---------- Phase 3: services & stores ----------

export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AppSettings {
  language: Language;
  notifications: NotificationSettings;
}

export interface MonthlySeries {
  labels: string[];
  income: number[];
  expense: number[];
}

export interface PriceTrend {
  crop: string;
  prices: number[];
}

export interface PriceTrends {
  labels: string[];
  series: PriceTrend[];
}

export interface LoanApplicationInput {
  partnerId: string;
  amount: number;
  purpose: string;
  months: number;
  monthly: number;
}

export interface LoanApplication extends LoanApplicationInput {
  id: string;
  userId: string;
  reference: string; // e.g. APP-2026-48213
  status: 'submitted';
  createdAt: string;
}
