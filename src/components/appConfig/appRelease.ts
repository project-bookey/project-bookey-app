import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { AppConfig, AppPlatform, MaintenanceNotice } from '@/api/types';
import { meetingClock, meetingDay, meetingWeekday } from '@/components/club/meetingTime';

/** 서버가 버전을 판정하는 플랫폼. 웹은 미리보기라 묻지 않는다(null). */
export function appPlatform(): AppPlatform | null {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return null;
}

/**
 * 지금 앱 버전('0.1.0' 꼴). Expo Go 안에서는 nativeApplicationVersion 이 Expo Go 자체의 버전이라
 * app.json 의 version 을 쓴다.
 */
export function currentAppVersion(): string | undefined {
  const configured = Constants.expoConfig?.version ?? undefined;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return configured;
  return Application.nativeApplicationVersion ?? configured;
}

/**
 * 업데이트하러 갈 스토어 주소 — 관리자가 넣은 주소가 먼저다. 없으면 Android 는 패키지 이름으로 Play 스토어 주소를 만들고,
 * iOS 는 App Store 앱 번호를 몰라 null 이다(화면이 'App Store 에서 찾아 달라'고 안내한다).
 */
export function storeUrlFor(config: AppConfig, platform: AppPlatform): string | null {
  if (config.storeUrl) return config.storeUrl;
  if (platform === 'ANDROID') {
    return `https://play.google.com/store/apps/details?id=${Application.applicationId ?? 'app.bookey.mobile'}`;
  }
  return null;
}

/** 점검 시간 — 같은 날이면 '10.12 일 · 02:00 → 04:00', 날을 넘기면 '10.12 일 23:00 → 10.13 월 01:00'(KST). */
export function maintenanceRange(maintenance: MaintenanceNotice): string {
  const { startsAt, endsAt } = maintenance;
  const startDay = `${meetingDay(startsAt)} ${meetingWeekday(startsAt)}`;
  const endDay = `${meetingDay(endsAt)} ${meetingWeekday(endsAt)}`;
  if (startDay === endDay) return `${startDay} · ${meetingClock(startsAt)} → ${meetingClock(endsAt)}`;
  return `${startDay} ${meetingClock(startsAt)} → ${endDay} ${meetingClock(endsAt)}`;
}
