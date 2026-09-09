import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Plus, Trash2, Scale } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { WeightEntry } from '../types';

interface Props {
  entries: WeightEntry[];
  onAdd: (entry: WeightEntry) => void;
  onDelete: (id: string) => void;
}

export default function WeightTracker({ entries, onAdd, onDelete }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({ date: today, weight: '', bodyFat: '', bmr: '', bodyAge: '', note: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.weight) return;
    onAdd({
      id: crypto.randomUUID(),
      date: form.date,
      weight: Number(form.weight),
      bodyFat: form.bodyFat ? Number(form.bodyFat) : undefined,
      bmr: form.bmr ? Number(form.bmr) : undefined,
      bodyAge: form.bodyAge ? Number(form.bodyAge) : undefined,
      note: form.note || undefined,
    });
    setForm(prev => ({ ...prev, weight: '', bodyFat: '', bmr: '', bodyAge: '', note: '' }));
  };

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.slice(-30).map(e => ({
    date: format(new Date(e.date + 'T00:00:00'), 'M/d'),
    weight: e.weight,
    bodyFat: e.bodyFat ?? null,
  }));

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const diff = latest && first && latest.id !== first.id
    ? latest.weight - first.weight
    : null;

  return (
    <div className="tracker-container">
      <div className="tracker-header">
        <Scale size={24} />
        <h2>体重管理</h2>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        <div className="form-row">
          <div className="form-group">
            <label>日付</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>体重 (kg)</label>
            <input
              type="number"
              placeholder="65.0"
              step="0.1"
              min="0"
              value={form.weight}
              onChange={e => setForm(prev => ({ ...prev, weight: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>体脂肪率 (%) 任意</label>
            <input
              type="number"
              placeholder="20.0"
              step="0.1"
              min="0"
              max="100"
              value={form.bodyFat}
              onChange={e => setForm(prev => ({ ...prev, bodyFat: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>基礎代謝量 (kcal) 任意</label>
            <input
              type="number"
              placeholder="1500"
              min="0"
              value={form.bmr}
              onChange={e => setForm(prev => ({ ...prev, bmr: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>体内年齢 (歳) 任意</label>
            <input
              type="number"
              placeholder="30"
              min="0"
              max="120"
              value={form.bodyAge}
              onChange={e => setForm(prev => ({ ...prev, bodyAge: e.target.value }))}
            />
          </div>
          <div className="form-group flex-2">
            <label>メモ（任意）</label>
            <input
              type="text"
              placeholder="例: 運動後"
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-primary">
            <Plus size={18} /> 追加
          </button>
        </div>
      </form>

      {latest && (
        <div className="summary-card">
          <span>最新の記録</span>
          <div className="weight-summary">
            <span className="calories-total">{latest.weight.toFixed(1)} kg</span>
            {diff !== null && (
              <span className={`weight-diff ${diff > 0 ? 'up' : 'down'}`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
              </span>
            )}
            {latest.bodyFat != null && (
              <span className="bodyfat-label">体脂肪率 {latest.bodyFat} %</span>
            )}
            {latest.bmr != null && (
              <span className="bmr-label">基礎代謝 {latest.bmr} kcal</span>
            )}
            {latest.bodyAge != null && (
              <span className="bodyage-label">体内年齢 {latest.bodyAge} 歳</span>
            )}
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div className="chart-container">
          <h3>推移グラフ（直近30件）</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
              <XAxis dataKey="date" stroke="#8884d8" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="weight"
                stroke="#6366f1"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={v => `${v}kg`}
              />
              <YAxis
                yAxisId="fat"
                orientation="right"
                stroke="#f472b6"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #444' }}
                formatter={(v, name) =>
                 name === 'weight' ? [`${Number(v).toFixed(1)} kg`, '体重'] : [`${Number(v).toFixed(1)} %`, '体脂肪率']
                }
              />
              <Legend
                formatter={v => v === 'weight' ? '体重' : '体脂肪率'}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="weight"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="fat"
                type="monotone"
                dataKey="bodyFat"
                stroke="#f472b6"
                strokeWidth={2}
                dot={{ fill: '#f472b6', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="entries-list">
        {sorted.length === 0 ? (
          <div className="empty-state">体重記録がありません</div>
        ) : (
          [...sorted].reverse().slice(0, 20).map(entry => (
            <div key={entry.id} className="entry-card">
              <div className="entry-info">
                <span className="entry-name">
                  {format(new Date(entry.date + 'T00:00:00'), 'M月d日 (E)', { locale: ja })}
                </span>
                {(entry.bodyFat != null || entry.bmr != null || entry.bodyAge != null) && (
                  <span className="entry-time">
                    {[
                      entry.bodyFat != null && `体脂肪 ${entry.bodyFat}%`,
                      entry.bmr != null && `基礎代謝 ${entry.bmr}kcal`,
                      entry.bodyAge != null && `体内年齢 ${entry.bodyAge}歳`,
                    ].filter(Boolean).join('　')}
                  </span>
                )}
                {entry.note && <span className="entry-time">{entry.note}</span>}
              </div>
              <span className="entry-calories">{entry.weight.toFixed(1)} kg</span>
              <button
                className="btn-delete"
                onClick={() => onDelete(entry.id)}
                aria-label="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
