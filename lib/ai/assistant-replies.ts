// To use a real AI later: replace the body of getAssistantReply with a fetch to your API route.
// Keep the same input/output types so no component needs to change.
import { CROP_TIPS } from '@/constants/crops';
import { scoreLabel } from '@/lib/calculations/credit-score';
import { formatGHS } from '@/lib/format';
import { marketService } from '@/services/market.service';
import { delay } from '@/services/storage';
import type { AssistantReply, CreditScoreBreakdown } from '@/types';

export interface AssistantContext {
  farmerName: string;
  region: string;
  primaryCrops: string[];
  score: number;
  income: number;
  expenses: number;
  recordCount: number;
  /** The same factors used by the dashboard; lowest factor gets the first action. */
  creditFactors?: CreditScoreBreakdown;
}

function creditSteps(ctx: AssistantContext): { weakest?: string; steps: string[] } {
  const factors = [
    {
      key: 'paymentHistory',
      label: 'Payment History',
      step: 'Record genuine farm or MoMo activity each month to build a consistent six-month history.',
    },
    {
      key: 'recordCompleteness',
      label: 'Record Completeness',
      step: `You have ${ctx.recordCount} farm records. Log every sale, expense and activity, and work towards 30 combined farm and MoMo entries.`,
    },
    {
      key: 'incomeStability',
      label: 'Income Stability',
      step: `With ${formatGHS(ctx.income)} income and ${formatGHS(ctx.expenses)} expenses, ${ctx.income > ctx.expenses ? 'protect your surplus by budgeting for the next season' : 'review your largest costs and plan sales to improve your surplus'}.`,
    },
    {
      key: 'momoActivity',
      label: 'MoMo Activity',
      step: 'Log genuine farm-related Mobile Money receipts and payments; the activity factor reaches its maximum at 20 entries.',
    },
    {
      key: 'verification',
      label: 'Verification',
      step: `${ctx.farmerName}, complete your name, phone, farm name and acreage, then review phone, location and Ghana Card verification in your profile.`,
    },
  ] satisfies { key: Exclude<keyof CreditScoreBreakdown, 'score'>; label: string; step: string }[];

  const credit = ctx.creditFactors;
  if (credit) factors.sort((a, b) => credit[a.key] - credit[b.key]);
  return {
    weakest: credit ? `${factors[0].label} (${credit[factors[0].key]}%)` : undefined,
    steps: factors.map((factor) =>
      credit ? `${factor.label} (${credit[factor.key]}%): ${factor.step}` : factor.step,
    ),
  };
}

export async function getAssistantReply(
  message: string,
  ctx: AssistantContext,
): Promise<AssistantReply> {
  await delay(700);
  const text = message.toLowerCase().trim();
  const name = ctx.farmerName.trim() || 'Farmer';
  const region = ctx.region.trim() || 'your region';
  const has = (pattern: RegExp) => pattern.test(text);

  // First matching topic wins. Word boundaries keep "hi" from matching "something".
  if (has(/\bmaize\b/) && has(/\b(plant\w*|when|season\w*)\b/)) {
    const northern = /northern|savannah|north east|upper east|upper west/i.test(region);
    return {
      title: '🌽 Maize Planting in Ghana',
      intro: `Here are the usual planting windows, ${name}. Wait for reliable rains before sowing.`,
      bullets: [
        'Major season: March–April in the forest and transitional zones.',
        'Minor season: August where a second rainy season supports maize.',
        'Northern zones: May–June, following the onset of reliable rains.',
        'Use healthy, locally adapted seed and prepare a well-drained seedbed.',
      ],
      tip: northern
        ? `For ${region}, plan around the May–June window and confirm rainfall onset with your local MoFA extension officer.`
        : `For ${region}, confirm your local rainfall pattern with a MoFA extension officer; coastal areas can differ from forest and transitional zones.`,
    };
  }

  if (has(/\b(armyworms?|pests?|insects?)\b/)) {
    return {
      title: '🐛 Fall Armyworm Control',
      intro:
        'Scout maize regularly and act while larvae are small. Confirm the pest before treating.',
      bullets: [
        'Early detection: check young leaves and whorls for feeding holes, egg masses and caterpillars.',
        'Biological control: protect natural enemies and ask an extension officer about approved biological treatments.',
        'Chemical control: use only a locally approved product when needed, follow its label, wear protective equipment and observe harvest intervals.',
        'Cultural control: remove egg masses where practical, manage volunteer maize and rotate crops.',
      ],
      tip: 'If spraying is recommended, spray early morning or late evening, following the label and avoiding rain, wind and pollinator activity.',
    };
  }

  if (has(/\b(credit|scores?|loans?)\b/)) {
    const { weakest, steps } = creditSteps({ ...ctx, farmerName: name });
    return {
      title: '💳 Improve Your Credit Score',
      intro: `Your score is ${ctx.score} (${scoreLabel(ctx.score)}). ${weakest ? `Your weakest factor is ${weakest}. Start with the first step below.` : 'These five steps help build your farm financial history.'}`,
      bullets: steps,
      tip: 'This is your AgriCtec farm score. Lenders make their own decisions; improving it does not guarantee a loan.',
    };
  }

  if (has(/\bcocoa\b/) && has(/\bprices?\b/)) {
    const prices = await marketService.getPrices();
    const cocoa = prices.find((price) => price.crop === 'Cocoa');
    return {
      title: '💰 Cocoa Prices',
      intro:
        'These are indicative mock prices from the app’s market data, not a live buying quote.',
      bullets: [
        cocoa
          ? `Cocoa: ${formatGHS(cocoa.price)} per ${cocoa.unit} (illustrative).`
          : 'An indicative cocoa price is currently unavailable.',
        'Compare the unit, weight and any deductions before agreeing to a sale.',
        'Keep your weighing slip and sale receipt, and record the income in your farm records.',
      ],
      tip: 'Check COCOBOD for official farmgate prices',
    };
  }

  if (has(/\b(weather|rain\w*)\b/)) {
    const weather = await marketService.getWeather();
    return {
      title: '🌦️ Weather Intelligence',
      intro: `Today’s app weather: ${weather.description}, ${weather.temp}°C, ${weather.humidity}% humidity and ${weather.rainChance}% chance of rain. This is simulated weather, not a live forecast for ${region}.`,
      bullets: [
        weather.rainChance >= 60
          ? 'Check field drainage and postpone spraying if rain is expected.'
          : 'Check soil moisture and mulch to reduce water loss; water young plants where needed.',
        weather.condition === 'storm'
          ? 'Stay out of exposed fields during thunderstorms and secure loose equipment.'
          : 'Plan demanding field work for cooler morning hours and keep drinking water nearby.',
        `Check a local forecast for ${region} before planting${ctx.primaryCrops.length ? ` or scheduling work on ${ctx.primaryCrops.join(', ')}` : ''}.`,
      ],
      tip: 'Use rainfall onset and soil moisture together when deciding when to plant.',
    };
  }

  if (has(/\b(fertiliz\w*|fertilis\w*|npk)\b/)) {
    return {
      title: '🧪 Fertilizer Guide',
      intro:
        'Match nutrients to the crop, soil and growth stage. Your extension officer can confirm the formulation and rate.',
      bullets: [
        'Maize: discuss a balanced NPK basal application and split nitrogen top-dressing; apply to moist soil and keep fertilizer away from seed and stems.',
        'Cassava: use compost or well-rotted manure and a soil-test-based NPK plan, paying attention to potassium for root development.',
        'Cocoa: use cocoa-specific fertilizer where recommended, based on tree age and soil testing; retain useful organic matter and avoid fertilizing dry soil.',
      ],
      tip: 'Test your soil before buying fertilizer. A soil test helps avoid wasting money on nutrients your field already has.',
    };
  }

  if (has(/\b(profits?|income|expenses?|money|finances?)\b/)) {
    const profit = ctx.income - ctx.expenses;
    const margin =
      ctx.income > 0
        ? `${((profit / ctx.income) * 100).toFixed(1)}%`
        : 'not available (no income recorded)';
    return {
      title: '📊 Your Farm Finances',
      intro: `${name}, here is your all-time summary from ${ctx.recordCount} farm records. MoMo transfers are excluded to avoid double-counting.`,
      bullets: [
        `Total income: ${formatGHS(ctx.income)}.`,
        `Total expenses: ${formatGHS(ctx.expenses)}.`,
        `Net profit: ${formatGHS(profit)}.`,
        `Profit margin: ${margin}.`,
      ],
      tip:
        ctx.recordCount === 0
          ? 'Add your first sale and expense in Farm Records to start tracking your profit.'
          : profit <= 0
            ? 'Review your largest expense category and compare input prices before your next purchase.'
            : 'Set aside part of your surplus for next season’s inputs before taking on new spending.',
    };
  }

  if (has(/\bcassava\b/)) {
    return {
      title: '🍠 Cassava Tips',
      intro: `These four practices can help with your cassava crop in ${region}.`,
      bullets: CROP_TIPS.Cassava,
      tip: 'Ask your local MoFA extension officer which improved varieties suit your soil and market.',
    };
  }

  if (has(/\b(hello|hi|akwaaba|good morning)\b/)) {
    return {
      title: `👋 Akwaaba, ${name}!`,
      intro:
        'I’m your AgriCtec AI assistant. Ask me a farming or farm-finance question in plain English.',
      bullets: [
        'Maize planting, cassava care, pest control and fertilizer guidance.',
        'Weather information and indicative cocoa market prices.',
        'Your farm income, expenses, profit and personalised credit-score steps.',
      ],
      tip: 'Try a quick prompt below to get started. Replies are rule-based for now.',
    };
  }

  if (has(/\bthank\w*\b/)) {
    return {
      title: '🌱 You’re welcome!',
      intro: `Happy farming, ${name}! I’m here when you need a hand.`,
    };
  }

  return {
    title: '🌱 Let me help',
    intro: 'For advice specific to this issue, contact your local MoFA extension officer.',
    bullets: [
      'Maize planting seasons and cassava tips.',
      'Fall armyworm, pests and fertilizer guidance.',
      'Weather information and indicative cocoa prices.',
      'Your credit score, farm income, expenses and profit.',
    ],
    tip: 'Tell me the crop and the issue, or choose a quick prompt below.',
  };
}
