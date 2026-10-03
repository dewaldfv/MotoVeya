import { useState } from 'react';
import { Navigation, X, Loader2 } from 'lucide-react';
import NavigationCard from '@/components/NavigationCard';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import NavActionButtons from '@/components/NavActionButtons';
import EmergencyOverlay from '@/components/EmergencyOverlay';
import AutoStopCountdown from '@/components/AutoStopCountdown';
import RideInviteToggle from '@/components/RideInviteToggle';
import ImmersiveRideHud from '@/components/ImmersiveRideHud';
import RideWarningSheet from '@/components/RideWarningSheet';
import NextTurnArrow from '@/components/NextTurnArrow';
import { getServiceCategory, formatDistance } from '@/lib/serviceCategories';
import { haversine } from '@/lib/navigation';

export default function NavigationOverlay({
  session,
  user,
  bike,
  notifyFriends,
  setNotifyFriends,
  routeFuelStops = [],
  fuelRouteWarning = null,
}) {
  const {
    isActive, rideMode, speed, speedLimit, navProgress, destination,
    routeLoading, nearbyService, gpsWeak, fuelRange, fuelRemaining, distressActive, ending,
    crashPhase, crashCountdown, severity, autoStopCountdown,
    emergencyContactsNotified, nearbyRidersNotified, beacon,
    voiceSupported, voiceListening, batteryLevel, heading, userPos,
    routeWarnings, reportingWarning,
    recalculating,
    startRide, endRide, handleDistress, handleReportWarning, handleSimulateCrash,
    handleCancelCrash, handleResolveEmergency,
    handleAddStop, handleDismissService, setAutoStopCountdown, clearDestination,
  } = session;

  const [voiceEnabled, setVoiceEnabled] = useState(
    () => localStorage.getItem('motogo_voice_nav') !== 'false'
  );
  const [hudExpanded, setHudExpanded] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
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

      {routeLoading && !navProgress?.nextStep && (
        <div className="absolute left-3 right-3 z-20 flex items-center gap-2 rounded-2xl bg-card/95 p-3 shadow-xl backdrop-blur-lg landscape:max-w-md" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-sm font-medium">Calculating route...</span>
        </div>
      )}

      {navProgress?.nextStep?.maneuver && (
        <NextTurnArrow
          maneuver={navProgress.nextStep.maneuver}
          distanceToManeuver={navProgress.distanceToManeuver}
        />
      )}

      {fuelRouteWarning && (
        <div className="absolute left-3 right-3 z-[17] landscape:max-w-sm landscape:mx-auto" style={{ top: 'calc(4.25rem + env(safe-area-inset-top))' }}>
          <div className={`mx-auto flex max-w-sm items-center gap-2 rounded-2xl p-2.5 shadow-xl backdrop-blur-lg ${fuelRouteWarning.level === 'critical' ? 'bg-destructive/95 text-destructive-foreground' : 'bg-amber-500/95 text-white'}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-lg">⛽</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">{fuelRouteWarning.level === 'critical' ? 'FUEL RANGE WARNING' : 'FUEL RESERVE WARNING'}</p>
              <p className="truncate text-[11px] opacity-90">{fuelRouteWarning.station ? `${fuelRouteWarning.station.name || 'Fuel station'} is ${fuelRouteWarning.station.distance_ahead_km} km ahead.` : 'No suitable fuel station found within the current planning range.'}</p>
            </div>
          </div>
        </div>
      )}

      {routeFuelStops.length > 0 && (
        <div className="absolute left-3 right-3 z-[16] landscape:max-w-sm landscape:mx-auto" style={{ bottom: nearbyService ? 'calc(10.5rem + env(safe-area-inset-bottom))' : 'calc(7rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-sm items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl backdrop-blur-lg">
            {routeFuelStops[0].logo_url ? (
              <img src={routeFuelStops[0].logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain bg-white p-1" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">⛽</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{routeFuelStops[0].brand || 'Fuel Station'} · {routeFuelStops[0].name}</p>
              <p className="text-[11px] text-muted-foreground">
                {routeFuelStops[0].distance_ahead_km} km ahead · {routeFuelStops[0].detour_is_exact ? (routeFuelStops[0].exact_detour_km + ' km detour · +' + routeFuelStops[0].exact_detour_minutes + ' min') : ('~' + routeFuelStops[0].estimated_detour_km + ' km estimated detour')}
              </p>
            </div>
            <button onClick={() => handleAddStop(routeFuelStops[0])} className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground">Add Stop</button>
          </div>
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

      <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 pb-[calc(0.7rem+env(safe-area-inset-bottom))]">
        <ImmersiveRideHud
          speed={speed}
          heading={heading}
          roadName={navProgress?.nextStep?.name || destination?.name}
          fuelRange={fuelRange}
          fuelRemaining={fuelRemaining}
          speedLimit={speedLimit}
          expanded={hudExpanded}
          onToggle={() => setHudExpanded((v) => !v)}
          gpsWeak={gpsWeak}
          recalculating={recalculating}
          nextStep={navProgress?.nextStep}
          followingStep={navProgress?.followingStep}
          distanceToManeuver={navProgress?.distanceToManeuver}
          remainingDistance={navProgress?.remainingDistance}
          remainingDuration={navProgress?.remainingDuration}
          destinationName={destination?.name}
        />
      </div>

      <div className="absolute z-20" style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}>
        <NavActionButtons
          onDistress={handleDistress}
          onWarning={() => setWarningOpen(true)}
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

      {routeWarnings?.length > 0 && (() => {
        const upcoming = [...routeWarnings]
          .filter((w) => w.distance_from_rider_km != null)
          .sort((a, b) => a.distance_from_rider_km - b.distance_from_rider_km)[0];
        return upcoming ? (
          <div className="absolute left-3 right-3 z-20" style={{ top: 'calc(7rem + env(safe-area-inset-top))' }}>
            <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-amber-400/25 bg-black/80 px-3 py-2 shadow-xl backdrop-blur-xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-black text-white">{upcoming.title}</p>
                <p className="truncate text-[10px] text-white/55">{upcoming.distance_from_rider_km < 1 ? 'Ahead' : `${upcoming.distance_from_rider_km} km ahead`} · Reported by {upcoming.rider_name || 'rider'}</p>
              </div>
              {routeWarnings.length > 1 && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[9px] font-black text-amber-300">+{routeWarnings.length - 1}</span>}
            </div>
          </div>
        ) : null;
      })()}

      <RideWarningSheet
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        reporting={reportingWarning}
        onReport={async (warning) => {
          await handleReportWarning(warning);
          setWarningOpen(false);
        }}
      />

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