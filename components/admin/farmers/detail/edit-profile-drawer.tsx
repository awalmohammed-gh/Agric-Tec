'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { DetailDrawer } from '@/components/admin/shared/detail-drawer';
import { CropChipsInput } from '@/components/profile/crop-chips-input';
import { farmSchema, personalSchema } from '@/components/profile/profile-schema';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { REGIONS } from '@/constants/regions';
import { normalizePhone } from '@/lib/profile';
import { farmersService, type FarmerProfilePatch } from '@/services/admin/farmers.service';
import type { Crop } from '@/types';
import type { FarmerAccount } from '@/types/admin';

/** The farmer app's own rules (components/profile/profile-schema.ts) for these six fields. */
const editSchema = personalSchema
  .pick({ name: true, phone: true, region: true })
  .extend(farmSchema.pick({ farmName: true, acres: true, primaryCrops: true }).shape);

type Field = 'name' | 'phone' | 'region' | 'farmName' | 'acres' | 'primaryCrops';

interface FormState {
  name: string;
  phone: string;
  region: string;
  farmName: string;
  acres: string;
  primaryCrops: Crop[];
}

const initialState = (f: FarmerAccount): FormState => ({
  name: f.profile.name,
  phone: f.profile.phone.startsWith('+233') ? `0${f.profile.phone.slice(4)}` : f.profile.phone,
  region: f.profile.region,
  farmName: f.profile.farmName,
  acres: String(f.profile.acres),
  primaryCrops: f.profile.primaryCrops as Crop[],
});

/** Edit a farmer's profile. Only changed fields are saved; the audit entry keeps before → after. */
export function EditProfileDrawer({
  farmer,
  open,
  onClose,
  onSaved,
}: {
  farmer: FarmerAccount;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Edit profile"
      description={farmer.profile.name || farmer.email}
    >
      {open && <EditForm key={farmer.userId} farmer={farmer} onClose={onClose} onSaved={onSaved} />}
    </DetailDrawer>
  );
}

function EditForm({
  farmer,
  onClose,
  onSaved,
}: {
  farmer: FarmerAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormState>(() => initialState(farmer));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save() {
    const parsed = editSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])),
      );
      return;
    }
    setErrors({});
    const next = {
      ...parsed.data,
      phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : '',
    };
    const before = farmer.profile;
    const patch: FarmerProfilePatch = {};
    if (next.name !== before.name) patch.name = next.name;
    if (next.phone !== before.phone) patch.phone = next.phone;
    if (next.region !== before.region) patch.region = next.region;
    if (next.farmName !== before.farmName) patch.farmName = next.farmName;
    if (next.acres !== before.acres) patch.acres = next.acres;
    if (next.primaryCrops.join() !== before.primaryCrops.join())
      patch.primaryCrops = next.primaryCrops;
    if (Object.keys(patch).length === 0) {
      toast.info('Nothing changed');
      return onClose();
    }
    setBusy(true);
    try {
      await farmersService.updateProfile(farmer.userId, patch);
      toast.success('Profile updated');
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the profile');
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FormField label="Full name" htmlFor="edit-name" error={errors.name}>
        <Input id="edit-name" value={values.name} onChange={(e) => set('name', e.target.value)} />
      </FormField>
      <FormField label="Phone" htmlFor="edit-phone" error={errors.phone}>
        <Input
          id="edit-phone"
          inputMode="tel"
          placeholder="0244123456"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </FormField>
      <FormField label="Region" htmlFor="edit-region" error={errors.region}>
        <Select
          id="edit-region"
          value={values.region}
          onChange={(e) => set('region', e.target.value)}
        >
          {REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Farm name" htmlFor="edit-farm" error={errors.farmName}>
        <Input
          id="edit-farm"
          value={values.farmName}
          onChange={(e) => set('farmName', e.target.value)}
        />
      </FormField>
      <FormField label="Acres" htmlFor="edit-acres" error={errors.acres}>
        <Input
          id="edit-acres"
          type="number"
          min={0}
          step="0.5"
          value={values.acres}
          onChange={(e) => set('acres', e.target.value)}
        />
      </FormField>
      <div>
        <p className="text-text-dim mb-2 text-xs font-semibold">Primary crops (up to 5)</p>
        <CropChipsInput
          value={values.primaryCrops}
          onChange={(crops) => set('primaryCrops', crops)}
        />
        {errors.primaryCrops && (
          <p role="alert" className="text-ink-red mt-1 text-xs">
            {errors.primaryCrops}
          </p>
        )}
      </div>
      <div className="border-border flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
