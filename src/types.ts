export interface NutrientValues {
  protein?: number;
  fat?: number;
  carbs?: number;
  calcium?: number;
  iron?: number;
  vitaminA?: number;
  vitaminB1?: number;
  vitaminB2?: number;
  vitaminC?: number;
  vitaminE?: number;
  fiber?: number;
  salt?: number;
}

export type NutrientKey = keyof NutrientValues;

export interface MealEntry extends NutrientValues {
  id: string;
  date: string;
  time: string;
  name: string;
  calories: number;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  skipped?: boolean;
  skipReason?: string;
}

export interface SleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  duration: number;
  quality: 1 | 2 | 3 | 4 | 5;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  bodyFat?: number;
  bmr?: number;
  bodyAge?: number;
  note?: string;
}

export interface Profile {
  height?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
}

export interface BowelEntry {
  id: string;
  date: string;
  time: string;
  bristol: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  amount: 'small' | 'medium' | 'large';
  count?: number;
  note?: string;
}

export interface StepEntry {
  id: string;
  date: string;
  steps: number;
}

export type ConditionStatus = 'new' | 'monitoring' | 'remission';

export interface ConditionEntry {
  id: string;
  name: string;
  status: ConditionStatus;
  note?: string;
}

export type TabType = 'dashboard' | 'meal' | 'sleep' | 'weight' | 'steps' | 'nutrition' | 'bowel' | 'conditions' | 'profile';
