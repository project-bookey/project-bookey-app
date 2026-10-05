import { Image, type ImageProps } from 'expo-image';

/** 화면 크기에 맞춰 디코딩하고 재방문 시 메모리·디스크 캐시를 함께 사용한다. */
export function CachedImage(props: ImageProps) {
  return <Image cachePolicy="memory-disk" transition={0} allowDownscaling {...props} />;
}
