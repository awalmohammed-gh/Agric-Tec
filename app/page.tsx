'use client';

// Temporary "kitchen sink" for the Phase 4 component library. Replaced in Phase 5.

import { useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import {
  Bot,
  Coins,
  CreditCard,
  Lightbulb,
  Moon,
  Plus,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  Wallet,
} from 'lucide-react';
import { BarChart } from '@/components/charts/bar-chart';
import { DoughnutChart } from '@/components/charts/doughnut-chart';
import { LineChart } from '@/components/charts/line-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { AiBanner } from '@/components/ui/ai-banner';
import { AiChip } from '@/components/ui/ai-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { InsightItem } from '@/components/ui/insight-item';
import { Modal } from '@/components/ui/modal';
import { Progress } from '@/components/ui/progress';
import { ScoreRing } from '@/components/ui/score-ring';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface DemoRow {
  id: string;
  date: string;
  description: string;
  crop: string;
  amount: number;
}

const rows: DemoRow[] = [
  {
    id: '1',
    date: '2026-10-12',
    description: 'Maize sales to Kofi Mensah',
    crop: 'Maize',
    amount: 3200,
  },
  {
    id: '2',
    date: '2026-09-23',
    description: 'Labour for harvesting',
    crop: 'Maize',
    amount: -900,
  },
  { id: '3', date: '2026-07-10', description: 'Cocoa sales to LBC', crop: 'Cocoa', amount: 8100 },
  { id: '4', date: '2026-06-15', description: 'Cassava sales', crop: 'Cassava', amount: 3600 },
];

const columns: DataTableColumn<DemoRow>[] = [
  { key: 'date', header: 'Date', sortable: true },
  { key: 'description', header: 'Description' },
  {
    key: 'crop',
    header: 'Crop',
    sortable: true,
    render: (r) => <Badge color="blue">{r.crop}</Badge>,
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    align: 'right',
    render: (r) => (
      <span
        className={r.amount >= 0 ? 'text-ink-green font-semibold' : 'text-ink-red font-semibold'}
      >
        {r.amount >= 0 ? '+' : '−'}GHS {Math.abs(r.amount).toLocaleString('en-GH')}
      </span>
    ),
  },
];

const netByMonth = [-3250, 2400, 7420, 0, 5950, 2300];

type TabValue = 'all' | 'income' | 'expense' | 'activity';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-text text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function KitchenSink() {
  const { resolvedTheme, setTheme } = useTheme();
  const { palette } = useChartTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<TabValue>('all');
  const [aiInsights, setAiInsights] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState(false);
  const [loading, setLoading] = useState(false);

  function fakeSave() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-gradient-brand font-display text-4xl font-black">AgriCtec UI</h1>
          <p className="text-text-dim mt-1 text-sm">Phase 4 component library: kitchen sink</p>
        </div>
        <Button
          variant="ghost"
          icon={resolvedTheme === 'light' ? Moon : Sun}
          onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        >
          Switch to {resolvedTheme === 'light' ? 'dark' : 'light'}
        </Button>
      </header>

      <AiBanner
        icon={Sparkles}
        title="AI Insight"
        subtitle="Your expenses are 30% of income this season. Great job keeping costs low!"
        action={
          <Button icon={Plus} size="sm">
            Add Record
          </Button>
        }
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={Plus}>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={Trash2}>
            Danger
          </Button>
          <Button size="sm">Small primary</Button>
          <Button size="sm" variant="ghost">
            Small ghost
          </Button>
          <Button loading={loading} onClick={fakeSave}>
            {loading ? 'Saving…' : 'Click to load'}
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Stat cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Wallet}
            color="green"
            label="Total Income"
            value="GHS 21,300"
            change={{ text: '+12% this month', trend: 'up' }}
          />
          <StatCard
            icon={Coins}
            color="blue"
            label="Total Expenses"
            value="GHS 6,480"
            change={{ text: '−4% this month', trend: 'down' }}
          />
          <StatCard
            icon={Sprout}
            color="purple"
            label="Active Crops"
            value="3"
            change={{ text: 'across 5 acres', trend: 'up' }}
          />
          <StatCard icon={CreditCard} color="gold" label="Credit Score" value="702" />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Loan readiness</CardTitle>
              <CardSub>Score ring and progress bars</CardSub>
            </div>
            <Badge color="green">Good</Badge>
          </CardHeader>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ScoreRing value={702} max={850} label="Score" />
            <div className="w-full space-y-3">
              <Progress value={100} label="Payment history" />
              <Progress value={60} label="Record completeness" />
              <Progress value={30} label="MoMo activity" />
              <Progress value={0} label="Verification" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges, chips, tabs & switches</CardTitle>
          </CardHeader>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge color="green">Income</Badge>
              <Badge color="red">Expense</Badge>
              <Badge color="blue">Activity</Badge>
              <Badge color="gold">Pending</Badge>
              <Badge color="purple">AI</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <AiChip>
                <Bot size={12} aria-hidden="true" /> AI powered
              </AiChip>
              <AiChip onClick={() => setTab('income')}>When should I plant maize?</AiChip>
            </div>
            <Tabs
              label="Record type"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expenses' },
                { value: 'activity', label: 'Activities' },
              ]}
            />
            <p className="text-text-mute text-xs">Selected tab: {tab}</p>
            <div className="flex flex-col gap-1">
              <div className="text-text-dim flex items-center justify-between text-sm">
                <span>AI insights</span>
                <Switch checked={aiInsights} onChange={setAiInsights} label="AI insights" />
              </div>
              <div className="text-text-dim flex items-center justify-between text-sm">
                <span>Weather alerts</span>
                <Switch
                  checked={weatherAlerts}
                  onChange={setWeatherAlerts}
                  label="Weather alerts"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Section title="Form fields">
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Description" htmlFor="ks-desc" hint="What did you sell or buy?">
              <Input id="ks-desc" placeholder="e.g. Maize sales" />
            </FormField>
            <FormField
              label="Amount (GHS)"
              htmlFor="ks-amount"
              error="Amount must be greater than 0"
            >
              <Input
                id="ks-amount"
                type="number"
                error
                aria-describedby={fieldErrorId('ks-amount')}
                defaultValue={-5}
              />
            </FormField>
            <FormField label="Crop" htmlFor="ks-crop">
              <Select id="ks-crop" defaultValue="Maize">
                <option>Maize</option>
                <option>Cassava</option>
                <option>Cocoa</option>
              </Select>
            </FormField>
            <FormField label="Notes" htmlFor="ks-notes">
              <Textarea id="ks-notes" placeholder="Optional notes" />
            </FormField>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Open confirm dialog
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Insights, empty state & skeleton">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <InsightItem icon={Lightbulb} title="Store part of your maize">
              Prices usually rise 2 to 3 months after harvest.
            </InsightItem>
            <InsightItem icon={Sparkles}>Log MoMo payments to raise your credit score.</InsightItem>
          </div>
          <Card padding="sm">
            <EmptyState
              icon={Sprout}
              title="No records yet"
              description="Add your first farm record to start building your financial identity."
              action={
                <Button size="sm" icon={Plus}>
                  Add Record
                </Button>
              }
            />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
      </Section>

      <Section title="Data table">
        <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} caption="Demo records" />
        <DataTable columns={columns} rows={[]} getRowId={(r) => r.id} caption="Empty table" />
      </Section>

      <Section title="Charts">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
            </CardHeader>
            <LineChart
              ariaLabel="Income versus expenses, last 6 months"
              labels={['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']}
              datasets={[
                {
                  label: 'Income',
                  data: [0, 3600, 8100, 0, 6400, 3200],
                  color: palette.accent,
                  fill: true,
                },
                {
                  label: 'Expenses',
                  data: [3250, 1200, 680, 0, 450, 900],
                  color: palette.danger,
                  fill: true,
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Income by crop</CardTitle>
            </CardHeader>
            <DoughnutChart
              ariaLabel="Income by crop"
              labels={['Maize', 'Cocoa', 'Cassava']}
              data={[9600, 8100, 3600]}
              colors={[palette.accent, palette.gold, palette.purple]}
            />
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Monthly net</CardTitle>
            </CardHeader>
            <BarChart
              ariaLabel="Monthly net income"
              labels={['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']}
              datasets={[
                {
                  label: 'Net',
                  data: netByMonth,
                  color: palette.accent,
                  colorsPerBar: netByMonth.map((v) => (v < 0 ? palette.danger : palette.accent)),
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Empty doughnut</CardTitle>
            </CardHeader>
            <DoughnutChart ariaLabel="No data yet" labels={[]} data={[]} colors={[]} />
          </Card>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Farm Record"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete…
            </Button>
            <Button onClick={() => setModalOpen(false)}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-text-dim text-sm">
            Press Tab: focus stays inside. Press Escape: it closes and focus returns to the button.
          </p>
          <FormField label="Description" htmlFor="m-desc">
            <Input id="m-desc" placeholder="e.g. Sold 10 bags of maize" />
          </FormField>
          <FormField label="Crop" htmlFor="m-crop">
            <Select id="m-crop">
              <option>Maize</option>
              <option>Cocoa</option>
            </Select>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete record?"
        message="This record will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
