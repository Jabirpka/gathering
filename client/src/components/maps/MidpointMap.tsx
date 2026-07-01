import { useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, Navigation, Loader2 } from 'lucide-react';
import { LocationEntry, MeetupData } from '../../types';

interface Props {
  value?: MeetupData | null;
  onChange?: (data: MeetupData) => void;
  readonly?: boolean;
}

function calcMidpoint(locations: LocationEntry[]) {
  if (!locations.length) return null;
  const sum = locations.reduce((acc, l) => ({ lat: acc.lat + l.lat, lng: acc.lng + l.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / locations.length, lng: sum.lng / locations.length };
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = (window as any).__GOOGLE_MAPS_KEY__;
  if (!apiKey) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = (window as any).__GOOGLE_MAPS_KEY__;
  if (!apiKey) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.results?.[0]?.formatted_address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export default function MidpointMap({ value, onChange, readonly = false }: Props) {
  const [locations, setLocations] = useState<LocationEntry[]>(value?.locations ?? []);
  const [midpoint, setMidpoint] = useState(value?.midpoint);
  const [midpointAddress, setMidpointAddress] = useState(value?.address ?? '');
  const [newName, setNewName] = useState('');
  const [newAddr, setNewAddr] = useState('');
  const [loading, setLoading] = useState(false);

  const addLocation = useCallback(async () => {
    if (!newName.trim() || !newAddr.trim()) return;
    setLoading(true);
    try {
      const coords = await geocodeAddress(newAddr);
      if (!coords) {
        alert('Could not find that address. Try a more specific address.');
        return;
      }
      const entry: LocationEntry = {
        userId: Date.now().toString(),
        name: newName.trim(),
        address: newAddr.trim(),
        lat: coords.lat,
        lng: coords.lng,
      };
      const updated = [...locations, entry];
      setLocations(updated);
      setNewName(''); setNewAddr('');

      const mp = calcMidpoint(updated);
      if (mp) {
        setMidpoint(mp);
        const addr = await reverseGeocode(mp.lat, mp.lng);
        setMidpointAddress(addr);
        onChange?.({ locations: updated, midpoint: mp, address: addr });
      }
    } finally {
      setLoading(false);
    }
  }, [newName, newAddr, locations, onChange]);

  const removeLocation = async (idx: number) => {
    const updated = locations.filter((_, i) => i !== idx);
    setLocations(updated);
    const mp = calcMidpoint(updated);
    if (mp) {
      setMidpoint(mp);
      const addr = await reverseGeocode(mp.lat, mp.lng);
      setMidpointAddress(addr);
      onChange?.({ locations: updated, midpoint: mp, address: addr });
    } else {
      setMidpoint(undefined);
      setMidpointAddress('');
      onChange?.({ locations: updated });
    }
  };

  const mapsUrl = midpoint
    ? `https://www.google.com/maps/search/?api=1&query=${midpoint.lat},${midpoint.lng}`
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Navigation size={14} className="text-brand" />
        Meetup Midpoint Calculator
      </h3>

      {/* Add location */}
      {!readonly && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Person's name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input text-sm" placeholder="Their address or city" value={newAddr} onChange={(e) => setNewAddr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLocation()} />
          </div>
          <button onClick={addLocation} disabled={loading || !newName.trim() || !newAddr.trim()} className="btn-secondary text-sm w-full justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Location
          </button>
        </div>
      )}

      {/* Location list */}
      {locations.length > 0 && (
        <div className="space-y-2">
          {locations.map((loc, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface-2 rounded-xl px-3 py-2">
              <MapPin size={13} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{loc.name}</p>
                <p className="text-xs text-slate-500 truncate">{loc.address}</p>
              </div>
              {!readonly && (
                <button onClick={() => removeLocation(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Midpoint result */}
      {midpoint && (
        <div className="bg-brand-dim border border-brand/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-brand uppercase tracking-wider mb-1.5">📍 Suggested Midpoint</p>
          <p className="text-sm text-slate-700 mb-2">{midpointAddress}</p>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline">
              <Navigation size={11} />
              Open in Google Maps
            </a>
          )}
        </div>
      )}

      {locations.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">
          Add at least 2 locations to calculate the geographic midpoint.
        </p>
      )}
    </div>
  );
}
