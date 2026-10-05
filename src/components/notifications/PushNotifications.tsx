import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from '@/navigation';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { authApi, notificationApi } from '@/api/endpoints';
import type { Notification } from '@/api/types';
import { notificationTarget, openNotificationTarget } from '@/lib/notificationTarget';
import { useAuth } from '@/store/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function notificationFromData(data: Record<string, unknown>): Notification | null {
  const id = Number(data.notificationId);
  const type = typeof data.type === 'string' ? data.type : null;
  if (!Number.isFinite(id) || !type) return null;
  return {
    id,
    type: type as Notification['type'],
    title: '',
    body: '',
    payload: data,
    scheduledAt: new Date().toISOString(),
  } as Notification;
}

/** 권한·토큰 등록과 알림 탭 딥링크를 앱 전역에서 한 번만 연결한다. */
export function PushNotifications() {
  const router = useRouter();
  const status = useAuth((state) => state.status);
  const registeredFor = useRef<number | null>(null);
  const userId = useAuth((state) => state.user?.id ?? null);

  useEffect(() => {
    if (status !== 'authenticated' || userId == null || registeredFor.current === userId) return;
    registeredFor.current = userId;

    void (async () => {
      if (!Device.isDevice || Platform.OS === 'web') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Bookey 알림',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#3ddc97',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const permission = current.status === 'granted'
        ? current
        : await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await authApi.registerDevice(Platform.OS === 'ios' ? 'IOS' : 'ANDROID', token);
    })().catch(() => {
      registeredFor.current = null;
    });
  }, [status, userId]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      if (status !== 'authenticated') return;
      const data = response.notification.request.content.data ?? {};
      const item = notificationFromData(data);
      if (!item) return;
      void notificationApi.open(item.id).catch(() => undefined);
      const target = notificationTarget(item);
      if (target) openNotificationTarget(target);
      else router.push('/notifications');
    };

    // 웹은 알림 응답 API 를 지원하지 않아 호출하면 UnavailabilityError 가 난다.
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response);
          void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => subscription.remove();
  }, [router, status]);

  return null;
}
