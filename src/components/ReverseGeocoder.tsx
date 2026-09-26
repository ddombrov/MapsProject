'use client';

import { useEffect } from 'react';

export interface ReverseGeocodeResult {
  formattedAddress: string;
  locality: string | null;
}

interface Props {
  latLng: google.maps.LatLngLiteral | null;
  onResolved: (result: ReverseGeocodeResult) => void;
}

// Renders nothing — just runs a reverse-geocode whenever latLng changes, so a
// map click can fill the destination field without a separate search box.
// Goes through our server-side /api/geocode route rather than the client-side
// Maps JS Geocoder, since the public browser key isn't authorized for the
// Geocoding API while the server key is.
export function ReverseGeocoder({ latLng, onResolved }: Props) {
  useEffect(() => {
    if (!latLng) return;

    fetch(`/api/geocode?lat=${latLng.lat}&lng=${latLng.lng}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.formattedAddress) onResolved({ formattedAddress: data.formattedAddress, locality: data.locality ?? null });
      })
      .catch(() => {});
  }, [latLng, onResolved]);

  return null;
}
