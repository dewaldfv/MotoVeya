// Renders a QR code image from a data string via a public QR generation API.
// No client-side library required.
export default function QrCode({ data, size = 220 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&qzone=1&color=0a0a0a&bgcolor=ffffff&data=${encodeURIComponent(data)}`;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-lg" style={{ width: size + 24, height: size + 24 }}>
      <img src={url} width={size} height={size} alt="QR code" className="block" />
    </div>
  );
}