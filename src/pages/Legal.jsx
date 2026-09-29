import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const DOCS = {
  eula: {
    title: 'End User License Agreement',
    body: `MotoVeya End User License Agreement
Last updated: July 2026

1. License Grant
MotoVeya grants you a personal, non-exclusive, non-transferable license to use the application for your personal motorcycling and navigation purposes, subject to these terms.

2. Acceptable Use
You agree to use MotoVeya lawfully and safely. Do not interact with the app in a way that distracts you from operating your motorcycle safely. Always obey local traffic laws. The app is a supplementary tool and does not replace your judgment, proper riding gear, or adherence to road regulations.

3. Safety Disclaimer
Safety features including crash detection, distress alerts, and emergency notifications are supplementary aids. They rely on device sensors, GPS, and network connectivity, all of which may fail or be unavailable. MotoVeya does not guarantee that alerts will be sent or received in an emergency. Always carry appropriate safety equipment and know your local emergency numbers.

4. Intellectual Property
All content, branding, and software within MotoVeya are owned by MotoVeya or its licensors. You may not copy, modify, or redistribute the app without permission.

5. Termination
You may stop using MotoVeya at any time. We may suspend or terminate access if you breach these terms.

6. Limitation of Liability
MotoVeya is provided "as is" without warranties of any kind. To the fullest extent permitted by law, MotoVeya shall not be liable for any damages arising from your use of the app, including but not limited to accidents, injuries, or data loss.

7. Changes
We may update this agreement from time to time. Continued use after changes constitutes acceptance.

8. Governing Law
This agreement is governed by the laws of the Republic of South Africa.`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `MotoVeya Privacy Policy
Last updated: July 2026

1. Information We Collect
- Profile information: name, nickname, email, motorcycle club, and details you provide during onboarding.
- Location data: real-time GPS during active rides and navigation, used for routing, tracking, and safety features.
- Ride data: distance, duration, speed, and route history.
- Emergency contact: the name and phone number you designate for safety alerts.
- Device data: basic device identifiers and usage analytics to improve the app.

2. How We Use Your Information
- Provide navigation, ride recording, and safety features.
- Send crash and distress alerts to your emergency contact and, for Premium users, emergency services.
- Display your location to friends and group members when you choose to share.
- Show nearby events, services, and points of interest.
- Process Premium subscriptions through Paystack.

3. Location Sharing
Real-time location is only shared with others when you actively join a group or enable location sharing. You can stop sharing at any time by leaving the group or ending the ride.

4. Data Storage and Security
Your data is stored securely on our servers. We use industry-standard measures to protect it. Payment details are handled by Paystack and are never stored by MotoVeya.

5. Data Sharing
We do not sell your personal data. We share data only with service providers necessary to operate the app (such as Paystack and mapping providers), and where required by law.

6. Your Rights
You can view and update your profile information at any time. You can delete your account and associated data from Settings > Account > Delete Account. This action is permanent and cannot be undone.

7. Children
MotoVeya is not intended for users under 18.

8. Contact
For privacy questions, contact MotoVeya support.`,
  },
  terms: {
    title: 'Terms & Conditions',
    body: `MotoVeya Terms & Conditions
Last updated: July 2026

1. Acceptance
By creating an account or using MotoVeya, you agree to these Terms & Conditions and our Privacy Policy and End User License Agreement.

2. Eligibility
You must be at least 18 years old and hold a valid motorcycle license where required by law to use riding-related features.

3. Accounts
You are responsible for maintaining the security of your account and for all activity under your account. Provide accurate information during registration.

4. Subscriptions
MotoVeya offers a Premium monthly subscription. Subscriptions are billed via Paystack and auto-renew according to the configured Paystack plan until cancelled. You can cancel according to the applicable Paystack subscription controls and MotoVeya terms. Prices are displayed in South African Rand.

5. User Content
You are responsible for any content you submit, such as event submissions. You grant MotoVeya a license to display such content within the app. You must not submit content that is unlawful, offensive, or infringes others' rights.

6. Prohibited Conduct
You agree not to misuse the app, including attempting to disrupt the service, reverse engineer it, or use it for unlawful purposes.

7. Third-Party Services
MotoVeya integrates mapping, routing, and payment services from third parties. Their terms and availability are outside our control.

8. Disclaimers
The app is provided "as is" and "as available." We do not guarantee uninterrupted or error-free operation.

9. Changes to Terms
We may update these terms. Continued use after changes constitutes acceptance.

10. Governing Law
These terms are governed by the laws of the Republic of South Africa.`,
  },
};

export default function Legal() {
  const { doc } = useParams();
  const navigate = useNavigate();
  const item = DOCS[doc] || DOCS.eula;

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-lg font-bold">{item.title}</h1>
      </div>
      <div className="mx-auto max-w-2xl p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.body}</p>
      </div>
    </div>
  );
}