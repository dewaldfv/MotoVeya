import { Loader2, Wind, Droplets, Thermometer, AlertTriangle, Cloud } from 'lucide-react';

export default function WeatherCard({ weather, loading, plannedDate }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Checking weather for your route…
      </div>
    );
  }
  if (!weather) return null;

  const alertStyles = {
    none: { ring: 'border-border bg-card', label: 'Conditions look good', color: 'text-emerald-600' },
    caution: { ring: 'border-amber-500/40 bg-amber-500/5', label: 'Ride with caution', color: 'text-amber-600' },
    danger: { ring: 'border-destructive/40 bg-destructive/5', label: 'Hazardous conditions', color: 'text-destructive' },
  };
  const a = alertStyles[weather.alertLevel] || alertStyles.none;

  return (
    <div className={`rounded-2xl border p-4 ${a.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{weather.icon}</span>
          <div>
            <p className="text-sm font-bold">{weather.condition}</p>
            <p className="text-xs text-muted-foreground">
              {weather.isCurrent ? 'Current conditions' : plannedDate ? `Forecast for ${new Date(plannedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : 'Forecast'}
            </p>
          </div>
        </div>
        {weather.alertLevel !== 'none' && (
          <div className={`flex items-center gap-1.5 text-xs font-bold ${a.color}`}>
            <AlertTriangle size={14} /> {a.label}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Thermometer size={14} /> {weather.temp != null ? `${weather.temp}°C` : '—'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wind size={14} /> {weather.wind != null ? `${weather.wind} km/h` : '—'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Droplets size={14} /> {weather.precip != null ? `${weather.precip}%` : '—'}
        </div>
      </div>
      {weather.alertLevel === 'danger' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <Cloud size={12} /> Consider rescheduling or rerouting.
        </p>
      )}
    </div>
  );
}