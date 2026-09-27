import { Modal, SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

export type AddressSelection = { address: string; roadAddress: string; buildingName: string; zonecode: string };

export function AddressSearchModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (value: AddressSelection) => void }) {
  const { colors } = useTheme();
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#postcode{width:100%;height:100%;margin:0}</style></head><body><div id="postcode"></div><script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script><script>new daum.Postcode({oncomplete:function(d){window.ReactNativeWebView.postMessage(JSON.stringify({address:d.address||'',roadAddress:d.roadAddress||'',buildingName:d.buildingName||'',zonecode:d.zonecode||''}))},width:'100%',height:'100%'}).embed(document.getElementById('postcode'));</script></body></html>`;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={[styles.safe,{backgroundColor:colors.bg}]}><View style={styles.header}><Button label="닫기" variant="ghost" size="sm" onPress={onClose}/></View><WebView source={{html}} originWhitelist={['*']} javaScriptEnabled onMessage={event=>{try{onSelect(JSON.parse(event.nativeEvent.data) as AddressSelection)}catch{}}}/></SafeAreaView></Modal>;
}
const styles=StyleSheet.create({safe:{flex:1},header:{padding:spacing.sm,alignItems:'flex-end'},web:{flex:1}});
