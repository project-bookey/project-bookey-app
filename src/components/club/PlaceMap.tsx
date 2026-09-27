import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const TILE=256, ZOOM=15;
const tilePoint=(lat:number,lng:number)=>{const n=2**ZOOM;const x=(lng+180)/360*n;const rad=lat*Math.PI/180;const y=(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*n;return{x,y,n}};

export function PlaceMap({latitude,longitude}:{latitude?:number;longitude?:number}){
 const [width,setWidth]=useState(320);if(latitude==null||longitude==null)return null;const p=tilePoint(latitude,longitude),baseX=Math.floor(p.x),baseY=Math.floor(p.y);
 return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={s.frame}>{[-1,0,1].flatMap(dy=>[-1,0,1].map(dx=>{const x=(baseX+dx+p.n)%p.n,y=baseY+dy;return <Image key={`${x}-${y}`} source={{uri:`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`}} style={[s.tile,{left:width/2+(baseX+dx-p.x)*TILE,top:110+(baseY+dy-p.y)*TILE}]}/>}))}<View style={s.pin}><Text style={s.pinText}>●</Text></View><Text style={s.credit}>© OpenStreetMap</Text></View>
}
const s=StyleSheet.create({frame:{height:220,borderRadius:16,overflow:'hidden',backgroundColor:'#e9e5dd'},tile:{position:'absolute',width:TILE,height:TILE},pin:{position:'absolute',left:'50%',top:'50%',marginLeft:-12,marginTop:-24,width:24,height:24,alignItems:'center'},pinText:{fontSize:30,color:'#e14f4f',textShadowColor:'white',textShadowRadius:2},credit:{position:'absolute',right:4,bottom:2,fontSize:9,color:'#333',backgroundColor:'rgba(255,255,255,.75)'}});
