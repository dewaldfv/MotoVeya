import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';

export default function ServiceCategoryGrid({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SERVICE_CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onSelect(cat.key)}
          className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl bg-card p-3 shadow-sm transition-transform active:scale-95"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: cat.color + '20' }}>
            {cat.emoji}
          </div>
          <span className="text-center text-xs font-semibold leading-tight">{cat.label}</span>
        </button>
      ))}
    </div>
  );
}