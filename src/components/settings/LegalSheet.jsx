import BottomSheet from '@/components/BottomSheet';

const APP_VERSION = '1.0.0';
const UPDATED = '3 July 2026';

const DOCS = {
  eula: {
    title: 'End User License Agreement',
    content: (
      <>
        <p className="text-xs text-muted-foreground">Last updated: {UPDATED} · Version {APP_VERSION}</p>
        <p>By downloading, installing, or using MotoGo ("the App"), you agree to be bound by this End User License Agreement. If you do not agree, do not use the App.</p>
        <h4 className="font-bold text-foreground">1. License Grant</h4>
        <p>MotoGo grants you a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes in accordance with these terms.</p>
        <h4 className="font-bold text-foreground">2. Restrictions</h4>
        <p>You may not reverse engineer, decompile, disassemble, or modify the App. You may not distribute, sell, or sublicense the App without prior written consent.</p>
        <h4 className="font-bold text-foreground">3. Safety Disclaimer</h4>
        <p>MotoGo provides navigation assistance and safety features but is not a substitute for safe riding practices. Always obey traffic laws, ride within your abilities, and wear appropriate safety gear. The App's crash detection and distress features are supplementary aids and may not function in all circumstances.</p>
        <h4 className="font-bold text-foreground">4. Limitation of Liability</h4>
        <p>MotoGo is provided "as is" without warranties of any kind. To the fullest extent permitted by law, MotoGo shall not be liable for any damages, injuries, or losses arising from your use of the App, including but not limited to navigation errors, delayed emergency alerts, or service interruptions.</p>
        <h4 className="font-bold text-foreground">5. Termination</h4>
        <p>This license is effective until terminated. MotoGo may terminate your access at any time for violation of these terms.</p>
        <h4 className="font-bold text-foreground">6. Governing Law</h4>
        <p>This agreement shall be governed by the laws of the Republic of South Africa.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    content: (
      <>
        <p className="text-xs text-muted-foreground">Last updated: {UPDATED}</p>
        <p>MotoGo is committed to protecting your privacy. This policy explains what data we collect and how we use it.</p>
        <h4 className="font-bold text-foreground">1. Data We Collect</h4>
        <p><strong>Location Data:</strong> Real-time GPS data is used for navigation, ride tracking, crash detection, and distress alerts. Location is only shared with your approved groups and emergency contacts when you enable these features.</p>
        <p><strong>Profile Information:</strong> Your name, nickname, motorcycle details, and emergency contact information.</p>
        <p><strong>Ride Data:</strong> Distance, duration, speed, and route information from your recorded rides.</p>
        <p><strong>Usage Data:</strong> Analytics data to improve the App's features and performance.</p>
        <h4 className="font-bold text-foreground">2. How We Use Your Data</h4>
        <p>We use your data to provide navigation, safety alerts, community features, ride history, and to improve the App. We do not sell your personal data to third parties.</p>
        <h4 className="font-bold text-foreground">3. Data Sharing</h4>
        <p>Your location is shared only with: (a) group members you actively join, (b) emergency contacts and services during a crash or distress event, and (c) service providers necessary for App functionality (e.g., map and routing providers).</p>
        <h4 className="font-bold text-foreground">4. Data Retention</h4>
        <p>Ride data is retained until you delete your account. You may delete individual rides or your entire account at any time.</p>
        <h4 className="font-bold text-foreground">5. Your Rights</h4>
        <p>You have the right to access, correct, or delete your personal data. Contact Base44 support to exercise these rights.</p>
        <h4 className="font-bold text-foreground">6. Security</h4>
        <p>We use industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms & Conditions',
    content: (
      <>
        <p className="text-xs text-muted-foreground">Last updated: {UPDATED}</p>
        <p>These Terms & Conditions govern your use of MotoGo. By using the App, you agree to these terms.</p>
        <h4 className="font-bold text-foreground">1. Acceptable Use</h4>
        <p>You agree to use MotoGo lawfully and responsibly. You must not use the App while riding in a manner that endangers yourself or others. Always pull over before interacting with the App.</p>
        <h4 className="font-bold text-foreground">2. User-Generated Content</h4>
        <p>You are responsible for any content you submit, including event submissions and service reviews. Content must be accurate and not infringe on others' rights.</p>
        <h4 className="font-bold text-foreground">3. Subscriptions</h4>
        <p>Premium features are available via subscription (R79.99/month or R799.99/year). Subscriptions auto-renew unless cancelled. Refunds are subject to applicable app store policies.</p>
        <h4 className="font-bold text-foreground">4. Events and Services</h4>
        <p>MotoGo lists events and motorcycle services submitted by organizers and businesses. MotoGo does not guarantee the accuracy of listings or the quality of services. Always verify details independently.</p>
        <h4 className="font-bold text-foreground">5. Modifications</h4>
        <p>MotoGo may update these terms at any time. Continued use of the App after changes constitutes acceptance of the new terms.</p>
        <h4 className="font-bold text-foreground">6. Contact</h4>
        <p>For questions about these terms, contact Base44 support.</p>
      </>
    ),
  },
};

export default function LegalSheet({ doc, onClose }) {
  if (!doc) return null;
  const info = DOCS[doc];
  if (!info) return null;
  return (
    <BottomSheet open={!!doc} onClose={onClose} title={info.title}>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {info.content}
      </div>
    </BottomSheet>
  );
}