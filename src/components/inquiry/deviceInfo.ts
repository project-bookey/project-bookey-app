import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { CreateInquiry } from '@/api/types';

/** 문의에 자동으로 붙이는 기기 정보 — 운영팀이 다시 묻지 않고 원인을 좁힐 수 있게. */
export type InquiryDevice = Pick<CreateInquiry, 'appVersion' | 'platform' | 'osVersion' | 'deviceModel'>;

const PLATFORM_LABEL: Record<string, string> = { IOS: 'iOS', ANDROID: 'Android', WEB: '웹' };

/** 웹은 앱 버전·기기 모델이 없어 비는 칸이 있다 — 서버는 빈 값을 그대로 받는다. */
export function inquiryDevice(): InquiryDevice {
  const platform = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB';
  return {
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? undefined,
    platform,
    osVersion: Device.osVersion ?? undefined,
    deviceModel: Device.modelName ?? undefined,
  };
}

/** 작성 화면 아래 한 줄 — "앱 1.2.0 · iOS 18.1 · iPhone 15". 빈 칸은 건너뛴다. */
export function deviceSummary(device: InquiryDevice): string {
  const os = [PLATFORM_LABEL[device.platform ?? ''] ?? device.platform, device.osVersion].filter(Boolean).join(' ');
  return [device.appVersion ? `앱 ${device.appVersion}` : null, os || null, device.deviceModel]
    .filter(Boolean)
    .join(' · ');
}
