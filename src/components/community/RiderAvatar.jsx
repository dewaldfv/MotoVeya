export default function RiderAvatar({ src, name, size = 44 }) {
  const initials = (name?.trim()?.[0] || 'R').toUpperCase();
  if (src) {
    return (
      <img src={src} alt={name || 'Rider'} style={{ width: size, height: size }} className="rounded-full object-cover" />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-primary/10 font-black text-primary"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials}</span>
    </div>
  );
}