import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">About MotoVeya</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-foreground">
          <p>
            MotoVeya is a social navigation and safety platform built specifically for motorcyclists across South Africa.
            We bring together turn-by-turn GPS navigation, real-time group ride coordination, crash detection,
            and a connected community of riders into a single, glove-friendly mobile experience. Whether you're
            commuting through Johannesburg traffic, carving the scenic passes of the Cape, or organising a charity
            rally with thirty friends, MotoVeya is designed to keep you on route, in touch, and safer on every ride.
          </p>
          <p>
            The app is built for every kind of South African rider — daily commuters, weekend jolters, long-haul
            tourers, adventure riders, club members, and track-day enthusiasts. Free users get core GPS navigation,
            crash detection, fuel calculation, and access to motorcycle events. MotoVeya Premium unlocks the full
            experience: rider-in-distress alerts, automatic emergency services notification, a friends network with
            live location tracking, group rides of up to 32 riders with real-time voice channels, premium route
            planning, and full ride history with statistics.
          </p>
          <p>
            MotoVeya is developed and maintained by an independent South African team passionate about two wheels and
            the open road. Our mission is simple: make every ride safer, more social, and more enjoyable for the
            local riding community. We partner with verified service providers, dealerships, and riding clubs
            across all nine provinces to keep riders connected to the people and places that matter.
          </p>
          <p className="pt-2 text-sm text-muted-foreground">
            Ride safe. Ride together. MotoVeya.
          </p>
        </div>
      </div>
    </div>
  );
}