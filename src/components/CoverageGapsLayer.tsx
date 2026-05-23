import { useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { Camera } from '../types';
import { calculateDestination } from '../utils/geo';

interface CoverageGapsLayerProps {
  cameras: Camera[];
}

export default function CoverageGapsLayer({ cameras }: CoverageGapsLayerProps) {
  const positions = useMemo(() => {
    // Outer ring: massive polygon covering the UK/World (Clockwise)
    const outerRing: [number, number][] = [
      [90, -180],
      [90, 180],
      [-90, 180],
      [-90, -180],
    ];

    // Inner rings (holes) for each camera (Counter-clockwise)
    const holes: [number, number][][] = cameras.map(camera => {
      const centerLat = camera.latitude;
      const centerLng = camera.longitude;
      const radius = camera.viewDistance || 30;
      
      const holePoints: [number, number][] = [];
      
      const direction = camera.direction;
      const fieldOfView = camera.fieldOfView;
      if (direction != null && fieldOfView != null) {
        // Draw a cone
        const halfFov = fieldOfView / 2;
        const startAngle = direction - halfFov;

        holePoints.push([centerLat, centerLng]); // Center point

        const numPoints = Math.max(10, Math.floor(fieldOfView / 5));
        for (let i = 0; i <= numPoints; i++) {
          const bearing = startAngle + (i * fieldOfView) / numPoints;
          const dest = calculateDestination(centerLat, centerLng, bearing, radius);
          holePoints.push([dest[0], dest[1]]);
        }
      } else {
        // Draw a full circle
        const numPoints = 36;
        for (let i = 0; i < numPoints; i++) {
          const bearing = (i * 360) / numPoints;
          const dest = calculateDestination(centerLat, centerLng, bearing, radius);
          holePoints.push([dest[0], dest[1]]);
        }
      }
      
      // Reverse to ensure counter-clockwise winding for holes
      return holePoints.reverse();
    });

    return [outerRing, ...holes];
  }, [cameras]);

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: 'transparent',
        fillColor: '#000000',
        fillOpacity: 0.7,
        fillRule: 'nonzero',
        interactive: false // Let clicks pass through
      }}
    />
  );
}
