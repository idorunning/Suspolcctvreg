import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Camera } from '../types';
import { calculateDestination } from '../utils/geo';

interface HeatmapLayerProps {
  cameras: Camera[];
}

export default function HeatmapLayer({ cameras }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!cameras || cameras.length === 0) return;

    const points: [number, number, number][] = [];

    cameras.forEach(camera => {
      const dist = camera.viewDistance || 30;
      const fov = camera.fieldOfView;
      const dir = camera.direction;
      
      // If no direction/fov, just add the center point and a few points around it
      if (dir === undefined || fov === undefined) {
         points.push([camera.latitude, camera.longitude, 1]);
         for (let d = 5; d <= dist; d += 10) {
           for (let a = 0; a < 360; a += 45) {
             const dest = calculateDestination(camera.latitude, camera.longitude, a, d);
             points.push([dest[0], dest[1], 0.5]);
           }
         }
         return;
      }

      const startAngle = dir - fov / 2;
      const endAngle = dir + fov / 2;
      
      // Sample points inside the cone
      // Center point
      points.push([camera.latitude, camera.longitude, 1]);
      
      for (let d = 5; d <= dist; d += 5) { // every 5 meters
        // The further away, the more points we need to maintain density
        const arcLength = (fov / 360) * 2 * Math.PI * d;
        const numPoints = Math.max(3, Math.floor(arcLength / 5)); // point every ~5 meters along arc
        
        for (let i = 0; i <= numPoints; i++) {
           const a = startAngle + (i * fov) / numPoints;
           const dest = calculateDestination(camera.latitude, camera.longitude, a, d);
           // Weight decreases slightly with distance
           const weight = Math.max(0.3, 1 - (d / dist) * 0.5);
           points.push([dest[0], dest[1], weight]); 
        }
      }
    });
    
    // @ts-ignore - leaflet.heat adds L.heatLayer
    const heatLayer = L.heatLayer(points, {
      radius: 20,
      blur: 15,
      maxZoom: 18,
      max: 1.0,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, cameras]);

  return null;
}
