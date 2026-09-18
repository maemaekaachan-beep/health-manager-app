import { useRef, useState } from 'react';
import { User, Save, Download, Upload } from 'lucide-react';
import type { Profile, MealEntry, SleepEntry, WeightEntry, StepEntry, BowelEntry, ConditionEntry } from '../types';
import type { CustomFoodItem } from '../data/foodDatabase';
import {
  exportBackup,
  parseBackupFile,
  mergeBackupData,
  readLegacyLocalStorage,
  countBackupEntries,
  type BackupData,
} from '../utils/backup';

const GENDER_OPTIONS: { value: Profile['gender']; label: string }[] = [
  { value: 'male',   label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other',  label: 'その他' },
];

const GENDER_LABEL: Record<NonNullable<Profile['gender']>, string> = {
  male: '男性', female: '女性', other: 'その他',
};

interface BackupPayload {
  meals: MealEntry[];
  sleepEntries: SleepEntry[];
  weightEntries: WeightEntry[];
  stepEntries: StepEntry[];
  bowelEntries: BowelEntry[];
  customFoods: CustomFoodItem[];
  conditions: ConditionEntry[];
  profile: Profile;
}

interface Props {
  profile: Profile;
  onSave: (profile: Profile) => void;
  backupData: BackupPayload;
  onRestore: (data: BackupData) => void;
}

export default function ProfileSettings({ profile, onSave, backupData, onRestore }: Props) {
  const [form, setForm] = useState({
    height: profile.height?.toString() ?? '',
    age: profile.age?.toString() ?? '',
    gender: profile.gender ?? ('' as Profile['gender'] | ''),
  });
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState('');
  const [imported, setImported] = useState(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [legacyStatus, setLegacyStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportBackup(backupData);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError('');
    try {
      const data = await parseBackupFile(file);

      if (importMode === 'overwrite') {
        const confirmed = window.confirm(
          '現在のデータをすべて上書きして、ファイルの内容で復元します。よろしいですか?'
        );
        if (!confirmed) return;
        onRestore(data);
      } else {
        const confirmed = window.confirm(
          '現在のデータに、ファイルの内容を重複なく追加(マージ)します。よろしいですか?'
        );
        if (!confirmed) return;
        const merged = mergeBackupData(backupData, data);
        onRestore({ ...data, ...merged });
      }

      setImported(true);
      setTimeout(() => setImported(false), 2000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'インポートに失敗しました');
    }
  };

  const handleLegacyRecover = () => {
    const legacy = readLegacyLocalStorage();
    const count = countBackupEntries(legacy);

    if (count === 0) {
      setLegacyStatus('このブラウザに旧データ(クラウド移行前のlocalStorage)は見つかりませんでした。');
      return;
    }

    const summary = [
      `食事 ${legacy.meals.length}件`,
      `睡眠 ${legacy.sleepEntries.length}件`,
      `体重 ${legacy.weightEntries.length}件`,
      `歩数 ${legacy.stepEntries.length}件`,
      `排便 ${legacy.bowelEntries.length}件`,
      `登録食品 ${legacy.customFoods.length}件`,
    ].join(' / ');

    const confirmed = window.confirm(
      `このブラウザに旧データが見つかりました:\n${summary}\n\n現在のクラウドデータに重複なく追加(マージ)します。よろしいですか?`
    );
    if (!confirmed) return;

    const merged = mergeBackupData(backupData, legacy);
    onRestore({ version: 0, exportedAt: '', ...merged });
    setLegacyStatus('旧データをクラウドにマージしました。');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      height: form.height ? Number(form.height) : undefined,
      age: form.age ? Number(form.age) : undefined,
      gender: (form.gender || undefined) as Profile['gender'],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasProfile = profile.height || profile.age || profile.gender;

  return (
    <div className="tracker-container">
      <div className="tracker-header">
        <User size={24} />
        <h2>プロフィール設定</h2>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        <div className="form-row">
          <div className="form-group">
            <label>身長 (cm)</label>
            <input
              type="number"
              placeholder="170.0"
              step="0.1"
              min="0"
              max="300"
              value={form.height}
              onChange={e => setForm(prev => ({ ...prev, height: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>年齢</label>
            <input
              type="number"
              placeholder="30"
              min="0"
              max="120"
              value={form.age}
              onChange={e => setForm(prev => ({ ...prev, age: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>性別</label>
            <div className="amount-selector">
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`amount-btn${form.gender === opt.value ? ' active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, gender: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary">
            <Save size={18} /> {saved ? '保存しました' : '保存'}
          </button>
        </div>
      </form>

      {hasProfile && (
        <div className="summary-card">
          <span>現在の設定</span>
          <div className="profile-stats">
            {profile.height && (
              <div className="profile-stat">
                <span className="profile-stat-label">身長</span>
                <span className="profile-stat-value">{profile.height} cm</span>
              </div>
            )}
            {profile.age && (
              <div className="profile-stat">
                <span className="profile-stat-label">年齢</span>
                <span className="profile-stat-value">{profile.age} 歳</span>
              </div>
            )}
            {profile.gender && (
              <div className="profile-stat">
                <span className="profile-stat-label">性別</span>
                <span className="profile-stat-value">{GENDER_LABEL[profile.gender]}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="tracker-header">
        <Download size={24} />
        <h2>データのバックアップ</h2>
      </div>

      <div className="backup-section">
        <p className="backup-desc">
          体重・食事・睡眠・歩数・排便・登録食品などすべての記録をJSONファイルに書き出せます。
          アプリをアンインストールする前にエクスポートしておくと、後で同じファイルから復元できます。
        </p>

        <div className="backup-actions">
          <button type="button" className="btn-primary" onClick={handleExport}>
            <Download size={18} /> JSONでエクスポート
          </button>

          <button type="button" className="btn-secondary" onClick={handleImportClick}>
            <Upload size={18} /> {imported ? '復元しました' : 'JSONから復元'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file-input"
            onChange={handleFileChange}
          />
        </div>

        <div className="amount-selector" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`amount-btn${importMode === 'overwrite' ? ' active' : ''}`}
            onClick={() => setImportMode('overwrite')}
          >
            上書き
          </button>
          <button
            type="button"
            className={`amount-btn${importMode === 'merge' ? ' active' : ''}`}
            onClick={() => setImportMode('merge')}
          >
            マージ(追加)
          </button>
        </div>
        <p className="backup-desc">
          「上書き」は現在のデータを完全に置き換えます。「マージ(追加)」は他の端末で書き出したバックアップを、現在のデータに重複なく追加したいときに使います(PCとスマホのデータ統合など)。
        </p>

        {importError && <p className="backup-error">{importError}</p>}
      </div>

      <div className="tracker-header">
        <Upload size={24} />
        <h2>旧データの復元(このブラウザ限定)</h2>
      </div>

      <div className="backup-section">
        <p className="backup-desc">
          クラウド対応版に切り替わる前、このブラウザに保存されていたデータが残っていないか確認し、見つかった場合は現在のクラウドデータに追加します。
          他の端末のデータはここでは検出できません(その場合はJSONエクスポート/インポートを使ってください)。
        </p>
        <div className="backup-actions">
          <button type="button" className="btn-secondary" onClick={handleLegacyRecover}>
            <Upload size={18} /> このブラウザの旧データを確認してマージ
          </button>
        </div>
        {legacyStatus && <p className="backup-desc">{legacyStatus}</p>}
      </div>
    </div>
  );
}
