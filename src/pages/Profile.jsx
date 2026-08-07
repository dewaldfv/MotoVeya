import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Fuel, Bike as BikeIcon, Route, Trophy, Users, Shield, Crown, SlidersHorizontal, Plus, Play, Info, MessageCircle, LifeBuoy, HelpCircle, Wrench, Gauge, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import ShareCodeSheet from '@/components/ShareCodeSheet';
import ProfileHeader from '@/components/profile/ProfileHeader';
import StatGrid from '@/components/profile/StatGrid';
import MenuCard from '@/components/profile/MenuCard';
import RideSummaryCard from '@/components/profile/RideSummaryCard';
import BikeCard from '@/components/profile/BikeCard';
import { toast } from 'sonner';

const coerceBike = (form) => ({
  ...form,
  year: Number(form.year) || undefined,
  engine_size_cc: Number(form.engine_size_cc) || undefined,
  tank_capacity_l: Number(form.tank_capacity_l) || undefined,
  fuel_consumption_l_per_100km: Number(form.fuel_consumption_l_per_100km) || undefined
});

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function computeAchievements(rideCount, totalDistance, maxSpeed) {
  const badges = [];
  if (rideCount >= 1) badges.push('🏍️ First Ride');
  if (totalDistance >= 100) badges.push('💯 Century Rider');
  if (totalDistance >= 500) badges.push('🛣️ Long Hauler');
  if (totalDistance >= 1000) badges.push('🏆 Kilometer King');
  if (rideCount >= 10) badges.push('⚔️ Weekly Warrior');
  if (rideCount >= 50) badges.push('⭐ Seasoned Rider');
  if (maxSpeed >= 120) badges.push('⚡ Speed Demon');
  return badges;
}

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bikeDialog, setBikeDialog] = useState(false);
  const [editingBike, setEditingBike] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [bikeForm, setBikeForm] = useState({ make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '', color: '', nickname: '', is_primary: false });

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) {setLoading(false);return;}
        const me = await base44.auth.me();
        setUser(me);
      } catch (e) {console.error(e);} finally
      {setLoading(false);}
    })();
  }, []);

  const { data: bikes = [] } = useQuery({
    queryKey: ['bikes', user?.id],
    queryFn: () => base44.entities.Bike.filter({ created_by_id: user.id }, '-created_date', 20),
    enabled: !!user?.id
  });

  const { data: rides = [] } = useQuery({
    queryKey: ['profile-rides', user?.id],
    queryFn: () => base44.entities.Ride.filter({ created_by_id: user.id }, '-ride_date', 200),
    enabled: !!user?.id
  });

  const { data: refills = [] } = useQuery({
    queryKey: ['profile-refills', user?.id],
    queryFn: () => base44.entities.FuelRefill.filter({}, '-refill_date', 200),
    enabled: !!user?.id
  });

  const { data: fuelProfiles = [] } = useQuery({
    queryKey: ['profile-fuel-profiles', user?.id],
    queryFn: () => base44.entities.FuelProfile.filter({}, '-last_calculated', 10),
    enabled: !!user?.id
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['profile-friends', user?.id],
    queryFn: () => base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 100),
    enabled: !!user?.id
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['profile-pending', user?.id],
    queryFn: () => base44.entities.Friend.filter({ recipient_id: user.id, status: 'pending' }, '-created_date', 20),
    enabled: !!user?.id
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['profile-memberships', user?.id],
    queryFn: () => base44.entities.GroupMember.filter({ user_id: user.id, status: 'active' }, '-created_date', 50),
    enabled: !!user?.id
  });

  const saveBikeMutation = useMutation({
    mutationFn: ({ editing, form }) => {
      const data = coerceBike(form);
      return editing ? base44.entities.Bike.update(editing.id, data) : base44.entities.Bike.create(data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bikes'] })
  });

  const deleteBikeMutation = useMutation({
    mutationFn: (id) => base44.entities.Bike.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bikes'] })
  });

  const stats = useMemo(() => {
    const totalRides = user?.total_rides || rides.length;
    const totalDistance = Math.round(user?.total_distance_km || rides.reduce((s, r) => s + (r.distance_km || 0), 0));
    const fuelUsed = Math.round(refills.reduce((s, r) => s + (r.litres || 0), 0));
    const maxSpeed = Math.max(0, ...rides.map((r) => r.max_speed_kmh || 0));
    const badges = computeAchievements(totalRides, totalDistance, maxSpeed);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDistance = Math.round(rides.filter((r) => new Date(r.ride_date) >= monthStart).reduce((s, r) => s + (r.distance_km || 0), 0));
    const avgRideLength = totalRides > 0 ? Math.round(totalDistance / totalRides) : 0;
    const fuelEconomy = fuelProfiles[0]?.adaptive_l_per_100km || fuelProfiles[0]?.baseline_l_per_100km || bikes[0]?.fuel_consumption_l_per_100km || '—';
    const rideTimeMin = rides.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const rideTime = rideTimeMin >= 60 ? `${Math.floor(rideTimeMin / 60)}h ${rideTimeMin % 60}m` : `${rideTimeMin}m`;

    const dayCounts = {};
    rides.forEach((r) => {if (r.ride_date) {const d = DAYS[new Date(r.ride_date).getDay()];dayCounts[d] = (dayCounts[d] || 0) + 1;}});
    const favDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const sorted = [...rides].sort((a, b) => new Date(b.ride_date) - new Date(a.ride_date));
    const lastRide = sorted[0];
    const longestRide = [...rides].sort((a, b) => (b.distance_km || 0) - (a.distance_km || 0))[0];

    const primaryBike = bikes.find((b) => b.is_primary) || bikes[0];
    const serviceInterval = 5000;
    const nextService = primaryBike ? Math.max(0, serviceInterval - totalDistance % serviceInterval) : null;

    return {
      totalRides, totalDistance, fuelUsed, achievementCount: badges.length, newestBadge: badges[badges.length - 1],
      monthDistance, avgRideLength, fuelEconomy, rideTime, favDay,
      lastRide: lastRide?.title || '—', longestRide: longestRide ? `${longestRide.title} (${Math.round(longestRide.distance_km)}km)` : '—',
      primaryBike, nextService,
      friendsOnline: friends.filter((f) => f.location_shared).length,
      groupCount: memberships.length, pendingCount: pending.length
    };
  }, [user, rides, refills, fuelProfiles, bikes, friends, pending, memberships]);

  const isPremium = user?.subscription_tier === 'premium';

  const openAddBike = () => {
    setEditingBike(null);
    setBikeForm({ make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '', color: '', nickname: '', is_primary: bikes.length === 0 });
    setBikeDialog(true);
  };

  const openEditBike = (bike) => {
    setEditingBike(bike);
    setBikeForm({ ...bike, year: bike.year || '', engine_size_cc: bike.engine_size_cc || '', tank_capacity_l: bike.tank_capacity_l || '', fuel_consumption_l_per_100km: bike.fuel_consumption_l_per_100km || '' });
    setBikeDialog(true);
  };

  const handleSaveBike = async () => {
    try {await saveBikeMutation.mutateAsync({ editing: editingBike, form: bikeForm });setBikeDialog(false);}
    catch (e) {console.error(e);toast.error('Failed to save bike');}
  };

  const handleDeleteBike = async (id) => {try {await deleteBikeMutation.mutateAsync(id);} catch (e) {console.error(e);}};

  const copyCode = () => {navigator.clipboard.writeText(user.id);setCopied(true);setTimeout(() => setCopied(false), 2000);};

  const handleAvatarUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      setUser((u) => ({ ...u, avatar_url: file_url }));
      toast.success('Profile picture updated');
    } catch (e) {
      console.error(e);
      toast.error('Could not update profile picture');
      throw e;
    }
  };

  const handleCoverUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ cover_url: file_url });
      setUser((u) => ({ ...u, cover_url: file_url }));
      toast.success('Cover photo updated');
    } catch (e) {
      console.error(e);
      toast.error('Could not update cover photo');
      throw e;
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  const crashDetectionOn = localStorage.getItem('motogo_auto_ride_detection') !== 'false';
  const emergencyContacts = user.emergency_contact_name ? 1 : 0;

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <ProfileHeader
          user={user}
          isPremium={isPremium}
          copied={copied}
          onCopy={copyCode}
          onShare={() => setShareOpen(true)}
          onSettings={() => navigate('/settings')}
          onAvatarUpload={handleAvatarUpload}
          onCoverUpload={handleCoverUpload} />
        

        <StatGrid
          totalRides={stats.totalRides}
          totalDistance={stats.totalDistance}
          fuelUsed={stats.fuelUsed}
          achievements={stats.achievementCount} />
        

        {!isPremium &&
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-4 shadow-sm">
          
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/20 blur-xl" />
            <div className="relative flex items-center gap-2">
              <Crown size={20} className="text-primary" />
              <h3 className="font-bold">Upgrade to Premium</h3>
            </div>
            <p className="relative mt-1 text-sm text-muted-foreground">Rider In Distress, 32-rider groups, friends network, emergency services.</p>
            <Button className="relative mt-3 min-h-[48px] w-full" onClick={() => navigate('/premium')}>Go Premium — R79.99/mo</Button>
          </motion.div>
        }

        <div className="space-y-2.5">
          <MenuCard icon={Fuel} title="Fuel Tracker" subtitle="Adaptive fuel consumption and refill history" delay={0.35} onClick={() => navigate('/fuel-tracker')} />

          <MenuCard
            icon={Route}
            title="Ride History"
            subtitle="View every ride you've completed"
            details={`Last: ${stats.lastRide} · Longest: ${stats.longestRide}`}
            delay={0.45}
            onClick={() => navigate('/rides')} />
          

          <MenuCard
            icon={Trophy}
            title="Achievements"
            subtitle="Badges, milestones and riding goals"
            details={stats.newestBadge || 'No badges yet — start riding!'}
            delay={0.5}
            onClick={() => navigate('/achievements')} />
          

          <MenuCard
            icon={Users}
            title="Friends & Community"
            subtitle="Manage friends, groups and voice channels"
            details={`${stats.friendsOnline} online · ${stats.groupCount} groups · ${stats.pendingCount} pending`}
            delay={0.55}
            onClick={() => navigate('/community')} />
          

          <MenuCard
            icon={Shield}
            title="Emergency & Safety"
            subtitle="Crash Detection, SOS and Emergency Contacts"
            details={`Crash Detection ${crashDetectionOn ? 'ON' : 'OFF'} · ${emergencyContacts} Emergency Contact${emergencyContacts === 1 ? '' : 's'}`}
            delay={0.6}
            onClick={() => navigate('/settings')} />
          

          <MenuCard
            icon={Crown}
            title="Subscription"
            subtitle="Manage Premium membership"
            details={isPremium ? `Premium · ${user.subscription_renewal_date || 'Active'}` : 'Free Rider · Tap to upgrade'}
            delay={0.65}
            onClick={() => navigate('/premium')} />
          

          <MenuCard
            icon={SlidersHorizontal}
            title="Preferences"
            subtitle="Display, navigation and ride settings"
            delay={0.7}
            onClick={() => navigate('/settings')} />

          <MenuCard
            icon={BikeIcon}
            title="Bike Garage"
            subtitle="Manage your motorcycles, fuel data and photos"
            delay={0.72}
            onClick={() => navigate('/bike-garage')} />

          <MenuCard
            icon={Wrench}
            title="Service History"
            subtitle="Log maintenance and workshop visits"
            delay={0.725}
            onClick={() => navigate('/service-history')} />

          <MenuCard
            icon={Store}
            title="Provider Dashboard"
            subtitle="Manage your shop listings, contact info and views"
            delay={0.726}
            onClick={() => navigate('/provider-dashboard')} />

          <MenuCard
            icon={Gauge}
            title="Safety Dashboard"
            subtitle="Your riding safety stats and alert history"
            delay={0.73}
            onClick={() => navigate('/safety-dashboard')} />

          <MenuCard
            icon={LifeBuoy}
            title="Safety Guidelines"
            subtitle="Emergency procedures, crash tips and group riding"
            delay={0.73}
            onClick={() => navigate('/safety-guidelines')} />

          <MenuCard
            icon={HelpCircle}
            title="Support Center"
            subtitle="FAQs on features, navigation and subscriptions"
            delay={0.74}
            onClick={() => navigate('/support')} />

          <MenuCard
            icon={Info}
            title="About MotoGo"
            subtitle="What we do and who we are"
            delay={0.75}
            onClick={() => navigate('/about')} />

          <MenuCard
            icon={MessageCircle}
            title="Contact Us"
            subtitle="Get in touch with the MotoGo team"
            delay={0.74}
            onClick={() => navigate('/contact')} />
          
        </div>

        {bikes.length > 0 &&
        <div className="space-y-2">
            {bikes.map((bike) =>
          <BikeCard key={bike.id} bike={bike} onEdit={openEditBike} onDelete={handleDeleteBike} />
          )}
          </div>
        }

        <RideSummaryCard
          data={{
            monthDistance: stats.monthDistance,
            avgRideLength: stats.avgRideLength,
            fuelEconomy: stats.fuelEconomy,
            rideTime: stats.rideTime,
            favDay: stats.favDay,
            weatherPref: 'Clear skies'
          }}
          delay={0.75} />
        

        <div className="flex gap-3 pt-2">
          

          
          




          
        </div>
      </div>

      <Dialog open={bikeDialog} onOpenChange={setBikeDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBike ? 'Edit Bike' : 'Add Bike'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make *</Label><Input value={bikeForm.make} onChange={(e) => setBikeForm({ ...bikeForm, make: e.target.value })} placeholder="KTM" /></div>
              <div><Label>Model *</Label><Input value={bikeForm.model} onChange={(e) => setBikeForm({ ...bikeForm, model: e.target.value })} placeholder="390 Adventure" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Year</Label><Input type="number" value={bikeForm.year} onChange={(e) => setBikeForm({ ...bikeForm, year: e.target.value })} placeholder="2024" /></div>
              <div><Label>Engine (cc)</Label><Input type="number" value={bikeForm.engine_size_cc} onChange={(e) => setBikeForm({ ...bikeForm, engine_size_cc: e.target.value })} placeholder="373" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tank (L)</Label><Input type="number" step="0.1" value={bikeForm.tank_capacity_l} onChange={(e) => setBikeForm({ ...bikeForm, tank_capacity_l: e.target.value })} placeholder="14.5" /></div>
              <div><Label>Consumption (L/100km)</Label><Input type="number" step="0.1" value={bikeForm.fuel_consumption_l_per_100km} onChange={(e) => setBikeForm({ ...bikeForm, fuel_consumption_l_per_100km: e.target.value })} placeholder="3.5" /></div>
            </div>
            <div><Label>Nickname</Label><Input value={bikeForm.nickname} onChange={(e) => setBikeForm({ ...bikeForm, nickname: e.target.value })} placeholder="The Beast" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bikeForm.is_primary} onChange={(e) => setBikeForm({ ...bikeForm, is_primary: e.target.checked })} /> Set as primary bike</label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBikeDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBike}>{editingBike ? 'Save' : 'Add Bike'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareCodeSheet open={shareOpen} onClose={() => setShareOpen(false)} title="My MotoGo Code" code={user.id} qrData={`motogo://friend?code=${user.id}`} description="Share to add as friend" />
    </div>);

}