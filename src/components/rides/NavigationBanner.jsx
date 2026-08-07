import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Fuel, UtensilsCrossed, Beer, Clock, Route as RouteIcon, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LocationSearchInput from './LocationSearchInput';
import { savePendingNavigation } from '@/lib/rideCache';
import { toast } from 'sonner';

const ROUTE_OPTIONS = [
{ key: 'fastest', label: 'Fastest' },
{ key: 'scenic', label: 'Scenic' },
{ key: 'avoid_gravel', label: 'Avoid Gravel' }];


function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No GPS'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export default function NavigationBanner() {
  const navigate = useNavigate();
  const [start, setStart] = useState(null);
  const [dest, setDest] = useState(null);
  const [routeOption, setRouteOption] = useState('fastest');
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const computeEstimate = async (origin, destination) => {
    if (!origin || !destination) {setEstimate(null);return;}
    setLoading(true);
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination.lng},${destination.lat}?overview=false`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setEstimate({ distance: data.routes[0].distance, duration: data.routes[0].duration });
      } else setEstimate(null);
    } catch (e) {setEstimate(null);} finally {setLoading(false);}
  };

  const handleDestSelect = async (d) => {
    setDest(d);
    let origin = start ? [start.lat, start.lng] : null;
    if (!origin) {
      try {origin = await getCurrentPosition();} catch (e) {toast.error('Enable GPS to estimate route');}
    }
    computeEstimate(origin, d);
  };

  const handleStartSelect = (s) => {
    setStart(s);
    if (dest) computeEstimate([s.lat, s.lng], dest);
  };

  const handleStartNavigation = () => {
    if (!dest) {toast.error('Choose a destination first');return;}
    savePendingNavigation({ start, dest, routeOption });
    navigate('/');
  };

  return null;

























































}