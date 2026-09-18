import { LayoutDashboard, Utensils, Moon, Scale, Footprints, Apple, ClipboardList, HeartPulse, User } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useCloudData } from './hooks/useCloudData';
import type { TabType } from './types';
import Dashboard from './components/Dashboard';
import MealTracker from './components/MealTracker';
import SleepTracker from './components/SleepTracker';
import WeightTracker from './components/WeightTracker';
import StepTracker from './components/StepTracker';
import NutritionTracker from './components/NutritionTracker';
import BowelTracker from './components/BowelTracker';
import ConditionTracker from './components/ConditionTracker';
import ProfileSettings from './components/ProfileSettings';
import './App.css';

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <LayoutDashboard size={20} /> },
  { id: 'meal', label: '食事', icon: <Utensils size={20} /> },
  { id: 'sleep', label: '睡眠', icon: <Moon size={20} /> },
  { id: 'weight', label: '体重', icon: <Scale size={20} /> },
  { id: 'steps', label: '歩数', icon: <Footprints size={20} /> },
  { id: 'nutrition', label: '栄養素', icon: <Apple size={20} /> },
  { id: 'bowel', label: '排便', icon: <ClipboardList size={20} /> },
  { id: 'conditions', label: '疾患・症状', icon: <HeartPulse size={20} /> },
  { id: 'profile', label: 'プロフィール', icon: <User size={20} /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useLocalStorage<TabType>('health-active-tab', 'dashboard');
  const {
    meals, sleepEntries, weightEntries, stepEntries, bowelEntries, customFoods, conditions, profile,
    loading, error, reload,
    addMeal, deleteMeal,
    addSleep, deleteSleep,
    addWeight, deleteWeight,
    addStep, deleteStep,
    addBowel, deleteBowel,
    addCustomFood, updateCustomFood, deleteCustomFood,
    addCondition, updateCondition, deleteCondition,
    saveProfile, restoreAll,
  } = useCloudData();

  if (loading) {
    return (
      <div className="app">
        <div className="app-loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="app-loading">
          <p>{error}</p>
          <button type="button" className="btn-primary" onClick={reload}>再読み込み</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="app-logo">
            <span className="logo-icon">🌿</span>
            <span className="logo-text">HealthTracker</span>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <Dashboard meals={meals} sleep={sleepEntries} weight={weightEntries} steps={stepEntries} />
        )}
        {activeTab === 'meal' && (
          <MealTracker
            entries={meals}
            customFoods={customFoods}
            onAdd={addMeal}
            onDelete={deleteMeal}
          />
        )}
        {activeTab === 'sleep' && (
          <SleepTracker
            entries={sleepEntries}
            onAdd={addSleep}
            onDelete={deleteSleep}
          />
        )}
        {activeTab === 'weight' && (
          <WeightTracker
            entries={weightEntries}
            onAdd={addWeight}
            onDelete={deleteWeight}
          />
        )}
        {activeTab === 'steps' && (
          <StepTracker
            entries={stepEntries}
            onAdd={addStep}
            onDelete={deleteStep}
          />
        )}
        {activeTab === 'nutrition' && (
          <NutritionTracker
            entries={meals}
            profile={profile}
            customFoods={customFoods}
            onAddFood={addCustomFood}
            onUpdateFood={updateCustomFood}
            onDeleteFood={deleteCustomFood}
          />
        )}
        {activeTab === 'bowel' && (
          <BowelTracker
            entries={bowelEntries}
            onAdd={addBowel}
            onDelete={deleteBowel}
          />
        )}
        {activeTab === 'conditions' && (
          <ConditionTracker
            entries={conditions}
            onAdd={addCondition}
            onUpdate={updateCondition}
            onDelete={deleteCondition}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileSettings
            profile={profile}
            onSave={saveProfile}
            backupData={{ meals, sleepEntries, weightEntries, stepEntries, bowelEntries, customFoods, conditions, profile }}
            onRestore={restoreAll}
          />
        )}
      </main>
    </div>
  );
}
