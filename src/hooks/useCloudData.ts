import { useCallback, useEffect, useState } from 'react';
import type { MealEntry, SleepEntry, WeightEntry, StepEntry, BowelEntry, ConditionEntry, Profile } from '../types';
import type { CustomFoodItem } from '../data/foodDatabase';
import type { BackupData } from '../utils/backup';

interface CloudState {
  meals: MealEntry[];
  sleepEntries: SleepEntry[];
  weightEntries: WeightEntry[];
  stepEntries: StepEntry[];
  bowelEntries: BowelEntry[];
  customFoods: CustomFoodItem[];
  conditions: ConditionEntry[];
  profile: Profile;
}

const EMPTY_STATE: CloudState = {
  meals: [],
  sleepEntries: [],
  weightEntries: [],
  stepEntries: [],
  bowelEntries: [],
  customFoods: [],
  conditions: [],
  profile: {},
};

async function apiFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(`${input} failed: ${res.status}`);
  }
  return res;
}

export function useCloudData() {
  const [data, setData] = useState<CloudState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/bootstrap')
      .then((res) => res.json())
      .then((json: CloudState) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError('データの読み込みに失敗しました。ネットワーク接続を確認してください。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  }, []);

  const addEntry = useCallback(
    <K extends 'meals' | 'sleepEntries' | 'weightEntries' | 'stepEntries' | 'bowelEntries'>(
      key: K,
      resource: string,
      entry: CloudState[K][number]
    ) => {
      setData((prev) => ({ ...prev, [key]: [...prev[key], entry] }));
      apiFetch(`/api/entries/${resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
    },
    []
  );

  const deleteEntry = useCallback(
    <K extends 'meals' | 'sleepEntries' | 'weightEntries' | 'stepEntries' | 'bowelEntries' | 'customFoods' | 'conditions'>(
      key: K,
      resource: string,
      id: string
    ) => {
      setData((prev) => ({
        ...prev,
        [key]: (prev[key] as { id: string }[]).filter((e) => e.id !== id) as CloudState[K],
      }));
      apiFetch(`/api/entries/${resource}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() =>
        setError('削除に失敗しました。通信環境を確認してください。')
      );
    },
    []
  );

  const addCustomFood = useCallback((food: CustomFoodItem) => {
    setData((prev) => ({ ...prev, customFoods: [...prev.customFoods, food] }));
    apiFetch('/api/entries/custom-foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(food),
    }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
  }, []);

  const updateCustomFood = useCallback((food: CustomFoodItem) => {
    setData((prev) => ({
      ...prev,
      customFoods: prev.customFoods.map((f) => (f.id === food.id ? food : f)),
    }));
    apiFetch('/api/entries/custom-foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(food),
    }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
  }, []);

  const deleteCustomFood = useCallback((id: string) => {
    deleteEntry('customFoods', 'custom-foods', id);
  }, [deleteEntry]);

  const addCondition = useCallback((condition: ConditionEntry) => {
    setData((prev) => ({ ...prev, conditions: [...prev.conditions, condition] }));
    apiFetch('/api/entries/conditions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(condition),
    }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
  }, []);

  const updateCondition = useCallback((condition: ConditionEntry) => {
    setData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.id === condition.id ? condition : c)),
    }));
    apiFetch('/api/entries/conditions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(condition),
    }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
  }, []);

  const deleteCondition = useCallback((id: string) => {
    deleteEntry('conditions', 'conditions', id);
  }, [deleteEntry]);

  const saveProfile = useCallback((profile: Profile) => {
    setData((prev) => ({ ...prev, profile }));
    apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }).catch(() => setError('保存に失敗しました。通信環境を確認してください。'));
  }, []);

  const restoreAll = useCallback(async (backup: BackupData) => {
    const next: CloudState = {
      meals: backup.meals,
      sleepEntries: backup.sleepEntries,
      weightEntries: backup.weightEntries,
      stepEntries: backup.stepEntries,
      bowelEntries: backup.bowelEntries,
      customFoods: backup.customFoods,
      conditions: backup.conditions,
      profile: backup.profile,
    };
    await apiFetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    setData(next);
  }, []);

  return {
    ...data,
    loading,
    error,
    reload,
    addMeal: (e: MealEntry) => addEntry('meals', 'meals', e),
    deleteMeal: (id: string) => deleteEntry('meals', 'meals', id),
    addSleep: (e: SleepEntry) => addEntry('sleepEntries', 'sleep', e),
    deleteSleep: (id: string) => deleteEntry('sleepEntries', 'sleep', id),
    addWeight: (e: WeightEntry) => addEntry('weightEntries', 'weight', e),
    deleteWeight: (id: string) => deleteEntry('weightEntries', 'weight', id),
    addStep: (e: StepEntry) => addEntry('stepEntries', 'steps', e),
    deleteStep: (id: string) => deleteEntry('stepEntries', 'steps', id),
    addBowel: (e: BowelEntry) => addEntry('bowelEntries', 'bowel', e),
    deleteBowel: (id: string) => deleteEntry('bowelEntries', 'bowel', id),
    addCustomFood,
    updateCustomFood,
    deleteCustomFood,
    addCondition,
    updateCondition,
    deleteCondition,
    saveProfile,
    restoreAll,
  };
}
