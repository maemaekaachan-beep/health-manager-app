import type { MealEntry, SleepEntry, WeightEntry, StepEntry, BowelEntry, ConditionEntry, Profile } from '../types';
import type { CustomFoodItem } from '../data/foodDatabase';

export const BACKUP_VERSION = 4;

export interface BackupData {
  version: number;
  exportedAt: string;
  meals: MealEntry[];
  sleepEntries: SleepEntry[];
  weightEntries: WeightEntry[];
  stepEntries: StepEntry[];
  bowelEntries: BowelEntry[];
  customFoods: CustomFoodItem[];
  conditions: ConditionEntry[];
  profile: Profile;
}

export function exportBackup(data: Omit<BackupData, 'version' | 'exportedAt'>) {
  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `health-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('JSONファイルの形式が正しくありません');
  }

  if (!json || typeof json !== 'object') {
    throw new Error('バックアップファイルの形式が正しくありません');
  }

  const data = json as Record<string, unknown>;
  const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

  if (
    !isArray(data.meals) ||
    !isArray(data.sleepEntries) ||
    !isArray(data.weightEntries) ||
    (data.stepEntries !== undefined && !isArray(data.stepEntries)) ||
    (data.customFoods !== undefined && !isArray(data.customFoods)) ||
    (data.conditions !== undefined && !isArray(data.conditions)) ||
    !isArray(data.bowelEntries) ||
    typeof data.profile !== 'object' ||
    data.profile === null
  ) {
    throw new Error('バックアップファイルの内容が正しくありません');
  }

  return {
    version: typeof data.version === 'number' ? data.version : 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    meals: data.meals as MealEntry[],
    sleepEntries: data.sleepEntries as SleepEntry[],
    weightEntries: data.weightEntries as WeightEntry[],
    stepEntries: isArray(data.stepEntries) ? (data.stepEntries as StepEntry[]) : [],
    bowelEntries: data.bowelEntries as BowelEntry[],
    customFoods: isArray(data.customFoods) ? (data.customFoods as CustomFoodItem[]) : [],
    conditions: isArray(data.conditions) ? (data.conditions as ConditionEntry[]) : [],
    profile: data.profile as Profile,
  };
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const seen = new Map(base.map(entry => [entry.id, entry]));
  for (const entry of incoming) {
    seen.set(entry.id, entry);
  }
  return [...seen.values()];
}

function sortByDate<T extends { date: string; time?: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aKey = a.time ? `${a.date}T${a.time}` : a.date;
    const bKey = b.time ? `${b.date}T${b.time}` : b.date;
    return aKey.localeCompare(bKey);
  });
}

function isFilled(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function mergeProfile(base: Profile, incoming: Profile): Profile {
  const merged: Profile = { ...base };
  for (const key of Object.keys(incoming) as (keyof Profile)[]) {
    if (isFilled(incoming[key])) {
      (merged as Record<string, unknown>)[key] = incoming[key];
    }
  }
  return merged;
}

/**
 * 既存データ(base)にインポートしたデータ(incoming)を重複なく追加する。
 * PC/スマホなど別端末で取ったバックアップ同士を統合する用途。
 */
export function mergeBackupData(
  base: Omit<BackupData, 'version' | 'exportedAt'>,
  incoming: Omit<BackupData, 'version' | 'exportedAt'>
): Omit<BackupData, 'version' | 'exportedAt'> {
  return {
    meals: sortByDate(mergeById(base.meals, incoming.meals)),
    sleepEntries: sortByDate(mergeById(base.sleepEntries, incoming.sleepEntries)),
    weightEntries: sortByDate(mergeById(base.weightEntries, incoming.weightEntries)),
    stepEntries: sortByDate(mergeById(base.stepEntries, incoming.stepEntries)),
    bowelEntries: sortByDate(mergeById(base.bowelEntries, incoming.bowelEntries)),
    customFoods: mergeById(base.customFoods, incoming.customFoods),
    conditions: mergeById(base.conditions, incoming.conditions),
    profile: mergeProfile(base.profile, incoming.profile),
  };
}

const LEGACY_KEYS = {
  meals: 'health-meals',
  sleepEntries: 'health-sleep',
  weightEntries: 'health-weight',
  stepEntries: 'health-steps',
  bowelEntries: 'health-bowel',
  customFoods: 'health-custom-foods',
  profile: 'health-profile',
} as const;

function readLegacyArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readLegacyProfile(): Profile {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEYS.profile);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Profile) : {};
  } catch {
    return {};
  }
}

/**
 * クラウドDB移行前、このブラウザのlocalStorageに残っている旧データを読み出す。
 * 現在のアプリはlocalStorageを直接参照しなくなったため、移行漏れの回収に使う。
 */
export function readLegacyLocalStorage(): Omit<BackupData, 'version' | 'exportedAt'> {
  return {
    meals: readLegacyArray<MealEntry>(LEGACY_KEYS.meals),
    sleepEntries: readLegacyArray<SleepEntry>(LEGACY_KEYS.sleepEntries),
    weightEntries: readLegacyArray<WeightEntry>(LEGACY_KEYS.weightEntries),
    stepEntries: readLegacyArray<StepEntry>(LEGACY_KEYS.stepEntries),
    bowelEntries: readLegacyArray<BowelEntry>(LEGACY_KEYS.bowelEntries),
    customFoods: readLegacyArray<CustomFoodItem>(LEGACY_KEYS.customFoods),
    conditions: [],
    profile: readLegacyProfile(),
  };
}

export function countBackupEntries(data: Omit<BackupData, 'version' | 'exportedAt'>): number {
  return (
    data.meals.length +
    data.sleepEntries.length +
    data.weightEntries.length +
    data.stepEntries.length +
    data.bowelEntries.length +
    data.customFoods.length +
    data.conditions.length
  );
}
