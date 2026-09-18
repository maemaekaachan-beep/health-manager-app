import { useState } from 'react';
import { HeartPulse, Plus, Pencil, Trash2, X } from 'lucide-react';
import type { ConditionEntry, ConditionStatus } from '../types';

interface Props {
  entries: ConditionEntry[];
  onAdd: (entry: ConditionEntry) => void;
  onUpdate: (entry: ConditionEntry) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { value: ConditionStatus; label: string }[] = [
  { value: 'new', label: '新規' },
  { value: 'monitoring', label: '経過観察中' },
  { value: 'remission', label: '寛解' },
];

const STATUS_LABEL: Record<ConditionStatus, string> = {
  new: '新規',
  monitoring: '経過観察中',
  remission: '寛解',
};

const STATUS_CLASS: Record<ConditionStatus, string> = {
  new: 'status-pill--condition-new',
  monitoring: 'status-pill--condition-monitoring',
  remission: 'status-pill--condition-remission',
};

const EMPTY_FORM = { name: '', status: 'new' as ConditionStatus, note: '' };

export default function ConditionTracker({ entries, onAdd, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const entry: ConditionEntry = {
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      status: form.status,
      note: form.note.trim() || undefined,
    };

    if (editingId) {
      onUpdate(entry);
    } else {
      onAdd(entry);
    }
    cancelEdit();
  };

  const startEdit = (entry: ConditionEntry) => {
    setEditingId(entry.id);
    setForm({ name: entry.name, status: entry.status, note: entry.note ?? '' });
  };

  return (
    <div className="tracker-container">
      <div className="tracker-header">
        <HeartPulse size={24} />
        <h2>疾患・症状管理</h2>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        <div className="form-row">
          <div className="form-group flex-2">
            <label>疾患名</label>
            <input
              type="text"
              placeholder="例: 花粉症"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>現在の状態</label>
            <div className="amount-selector">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`amount-btn${form.status === opt.value ? ' active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, status: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-2">
            <label>メモ (任意)</label>
            <textarea
              placeholder="自由記述"
              rows={2}
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-primary">
            <Plus size={18} /> {editingId ? '更新' : '登録'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={cancelEdit}>
              <X size={16} /> キャンセル
            </button>
          )}
        </div>
      </form>

      <div className="entries-list">
        {entries.length === 0 ? (
          <div className="empty-state">登録された疾患・症状がありません</div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="entry-card">
              <div className="entry-info">
                <div className="entry-name-row">
                  <span className="entry-name">{entry.name}</span>
                  <span className={`status-pill ${STATUS_CLASS[entry.status]}`}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>
                {entry.note && <span className="entry-time">{entry.note}</span>}
              </div>
              <button className="btn-edit" onClick={() => startEdit(entry)} aria-label="編集">
                <Pencil size={16} />
              </button>
              <button className="btn-delete" onClick={() => onDelete(entry.id)} aria-label="削除">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
