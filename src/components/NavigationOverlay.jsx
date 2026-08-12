import { useState } from 'react';
import { Navigation, X, Loader2 } from 'lucide-react';
import NavigationCard from '@/components/NavigationCard';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import NavActionButtons from '@/components/NavActionButtons';
import EmergencyOverlay from '@/components/EmergencyOverlay';
import AutoStopCountdown from '@/components/AutoStopCountdown';
import RideInviteToggle from '@/components/RideInviteToggle';
import RideHud from '@/components/RideHud';
import { getServiceCategory, formatDistance } from '@/lib/serviceCategories';
import { haversine } from '@/lib/navigation';

export default function NavigationOverlay({
  session,
  user,
  bike,
  notifyFriends,
  setNotifyFriends,
}) {
  const {
    isActive, rideMode, speed, speedLimit, navProgress, destination,
    routeLoading, nearbyService, gpsWeak, fuelRange, lowFuel, fuelRemaining, distressActive, ending,
    crashPhase, crashCountdown, severity, autoStopCountdown,
    emergencyContactsNotified, nearbyRidersNotified, beacon,
    voiceSupported, voiceListening, batteryLevel, heading, userPos,
    recalculating,
    startRide, endRide, handleDistress, handleSimulateCrash,
    handleCancelCrash, handleResolveEmergency,
    handleAddStop, handleDismissService, setAutoStopCountdown, clearDestination,
  } = session;

  const [voiceEnabled, setVoiceEnabled] = useState(
    () => localStorage.getItem('motogo_voice_nav') !== 'false'
  );
  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem('motogo_voice_nav', next ? 'true' : 'false');
    if (!next) { try { window.speechSynthesis?.cancel(); } catch (e) {} }
  };
  useVoiceNavigation({
    navProgress,
    destinationName: destination?.name,
    enabled: voiceEnabled,
  });

  // Idle with no destination — Home's own controls handle everything
  if (!isActive && !destination) return null;

  // Idle with destination — destination bar + start button
  if (!isActive) {
    return (
      <>
        <div className="absolute hud-left hud-right z-20" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2 rounded-2xl bg-card/95 px-4 py-3 shadow-lg backdrop-blur-lg landscape:max-w-md landscape:mx-auto">
            <Navigation size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="truncate text-sm font-bold">{destination.name}</p>
            </div>
            {routeLoading && <Loader2 size={18} className="shrink-0 animate-spin text-primary" />}
            <button onClick={clearDestination} className="glove-target flex shrink-0 items-center justify-center rounded-full bg-secondary">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="absolute left-0 right-0 z-20 space-y-2 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
          {user?.subscription_tier === 'premium' && (
            <RideInviteToggle enabled={notifyFriends} onChange={setNotifyFriends} />
          )}
          <button
            onClick={() => startRide()}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 landscape:max-w-xs landscape:mx-auto"
          >
            <Navigation size={22} fill="white" /> START NAVIGATION
          </button>
        </div>
      </>
    );
  }

  // Active ride — full navigation overlay
  return (
    <>
      {navProgress?.nextStep && (
        <div className="absolute left-3 right-3 z-20 landscape:max-w-md" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <NavigationCard
            step={navProgress.nextStep}
            followingStep={navProgress.followingStep}
            distanceToManeuver={navProgress.distanceToManeuver}
            remainingDistance={navProgress.remainingDistance}
            remainingDuration={navProgress.remainingDuration}
            destinationName={destination?.name}
            rideMode={rideMode}
          />
        </div>
      )}
      {routeLoading && !navProgress?.nextStep && (
        <div className="absolute left-3 right-3 z-20 flex items-center gap-2 rounded-2xl bg-card/95 p-3 shadow-xl backdrop-blur-lg landscape:max-w-md" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-sm font-medium">Calculating route...</span>
        </div>
      )}

      {nearbyService && (
        <div className="absolute left-3 right-3 z-[15] landscape:max-w-sm landscape:mx-auto" style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-sm items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl backdrop-blur-lg">
            <span className="text-xl">{getServiceCategory(nearbyService.category).emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{nearbyService.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {getServiceCategory(nearbyService.category).short} · {formatDistance(userPos ? haversine(nearbyService.lat, nearbyService.lng, userPos[0], userPos[1]) : null)} off route
              </p>
            </div>
            <button onClick={() => handleAddStop(nearbyService)} className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground">Add Stop</button>
            <button onClick={handleDismissService} className="shrink-0"><X size={16} className="text-muted-foreground" /></button>
          </div>
        </div>
      )}

      <div className="absolute z-20" style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))', left: 'calc(1rem + env(safe-area-inset-left))' }}>
        <RideHud
          speed={speed}
          heading={heading}
          roadName={navProgress?.nextStep?.name || destination?.name}
          fuelRange={fuelRange}
          fuelRemaining={fuelRemaining}
          lowFuel={lowFuel}
          recalculating={recalculating}
          gpsWeak={gpsWeak}
          speedLimit={speedLimit}
        />
      </div>

      <div className="absolute z-20" style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}>
        <NavActionButtons
          onDistress={handleDistress}
          onCrash={handleSimulateCrash}
          onEnd={endRide}
          distressActive={distressActive}
          ending={ending}
          disabled={!user || user.subscription_tier !== 'premium'}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          showVoiceToggle={!!navProgress?.nextStep}
        />
      </div>

      <AutoStopCountdown
        countdown={autoStopCountdown}
        onEnd={endRide}
        onContinue={() => setAutoStopCountdown(null)}
      />

      <EmergencyOverlay
        phase={crashPhase}
        severity={severity}
        countdown={crashCountdown}
        onCancel={handleCancelCrash}
        onResolve={handleResolveEmergency}
        emergencyNumber="112"
        contactNotified={emergencyContactsNotified}
        nearbyNotified={nearbyRidersNotified}
        riderName={user?.nickname || user?.full_name}
        location={userPos}
        incidentInfo={{
          speed, heading, batteryLevel,
          bikeMake: bike?.make, bikeModel: bike?.model, bikeYear: bike?.year,
        }}
        beaconActive={beacon.isActive}
        audioEnabled={beacon.audioEnabled}
        onToggleAudio={beacon.toggleAudio}
        voiceSupported={voiceSupported}
        voiceListening={voiceListening}
      />
    </>
  );
}