import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export function PlaceMap({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const lat = latitude ?? 37.5665;
  const lng = longitude ?? 126.978;
  const zoom = latitude == null ? 11 : 16;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{width:100%;height:100%;margin:0} .leaflet-control-attribution{font-size:9px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${lat},${lng}],${zoom});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);${latitude == null ? '' : `L.marker([${lat},${lng}]).addTo(map);`}setTimeout(()=>map.invalidateSize(),100);</script></body></html>`;
  return <View style={styles.frame}><WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} /></View>;
}

const styles = StyleSheet.create({ frame: { height: 220, borderRadius: 16, overflow: 'hidden' } });
