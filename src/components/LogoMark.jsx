const LOGO_URL =
  'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/f859a5527_MotoVeya1.png';

export default function LogoMark({ size = 240, className = '' }) {
  return (
    <img
      src={LOGO_URL}
      alt="MotoVeya — Your bike. Anytime. Anywhere."
      width={size}
      height={size}
      className={className}
      style={{ maxWidth: '85vw', height: 'auto', objectFit: 'contain' }}
      draggable={false}
    />
  );
}