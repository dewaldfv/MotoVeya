const LOGO_URL = 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/a39da6ca0_MoToGo1.png';

export default function LogoMark({ size = 240, className = '' }) {
  return (
    <img
      src={LOGO_URL}
      alt="Mo'toGo — Your bike. Anytime. Anywhere."
      width={size}
      height="auto"
      className={className}
      style={{ maxWidth: '85vw', height: 'auto', display: 'block' }}
    />
  );
}