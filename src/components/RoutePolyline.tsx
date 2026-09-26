'use client';

import { Polyline, useApiIsLoaded } from '@vis.gl/react-google-maps';

interface Props {
  path: google.maps.LatLngLiteral[];
  color?: string;
}

export function RoutePolyline({ path, color = '#374151' }: Props) {
  const isLoaded = useApiIsLoaded();
  if (!isLoaded || path.length < 2) return null;

  return (
    <Polyline
      path={path}
      strokeColor={color}
      strokeOpacity={0.7}
      strokeWeight={2}
      icons={[
        {
          icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: color },
          offset: '0%',
          repeat: '80px',
        },
      ]}
    />
  );
}
