import { router, type Href } from 'expo-router';

import type { Notification } from '@/api/types';
import { openSection, type SectionRoute } from '@/components/pager/sectionPager';

/** 알림이 가리키는 곳 — 하위 화면(href)이거나, 메인 탭의 한 구역(section, 그 화면이 읽는 주소 값 params). */
export type NotificationTarget =
  | { href: Href; section?: undefined }
  | { section: SectionRoute; params?: Record<string, string> };

function numberOf(payload: Notification['payload'], key: string): number | null {
  const raw = payload?.[key];
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

export function notificationTarget(item: Notification): NotificationTarget | null {
  const clubId = item.clubId ?? numberOf(item.payload, 'clubId');
  const club = (pathname: string, params?: Record<string, string>): NotificationTarget | null =>
    clubId == null ? null : { href: { pathname, params: { id: String(clubId), ...params } } as Href };
  const one = (pathname: string, key: string): NotificationTarget | null => {
    const id = numberOf(item.payload, key);
    return id == null ? null : { href: { pathname, params: { id: String(id) } } as Href };
  };

  switch (item.type) {
    case 'CLUB_WEEKLY_LOG': {
      const weekOf = item.payload?.weekOf;
      return club('/club/[id]/log/week', typeof weekOf === 'string' ? { weekOf } : undefined);
    }
    case 'CLUB_NEW_POST': return club('/club/[id]');
    // 모임 노트는 클럽 홈 '노트' 탭에 모여 있다.
    case 'CLUB_NOTE_PAGE': return club('/club/[id]', { tab: 'notes' });
    // 순위는 함께 읽는 사람이 있는 클럽 정보에서 본다.
    case 'CLUB_OVERTAKEN':
    case 'CLUB_FALLBEHIND': return club('/club/[id]/info');
    // 결산·체크포인트는 걷어냈다 — 예전에 받은 알림은 클럽 홈으로.
    case 'CLUB_ENDED':
    case 'CLUB_CHECKPOINT_RESULT':
    case 'CLUB_CHECKPOINT_DUE':
    case 'CLUB_NUDGE': return club('/club/[id]');
    case 'POST_LIKED':
    case 'POST_COMMENTED': return one('/post/[id]', 'postId');
    case 'POSTCARD_RECEIVED': return { section: 'messenger', params: { pane: 'inbox' } };
    case 'POSTCARD_REPLIED': return { section: 'messenger', params: { pane: 'sent' } };
    case 'CHAT_MESSAGE': return one('/chat/[id]', 'chatId');
    // 고객문의 답변 — 그 문의 화면에서 답을 읽는다.
    case 'INQUIRY_ANSWERED': return one('/inquiry/[id]', 'inquiryId');
    // 광고성 정보 수신 동의·철회 처리 결과 — 그 토글이 있는 설정으로.
    case 'CONSENT_RESULT': return { href: '/settings' };
    case 'FOLLOWED':
    case 'FOLLOW_CONNECTED': return one('/user/[id]', 'userId');
    case 'HABIT':
    case 'LAG':
    case 'MICRO_MISSION':
    case 'STREAK':
    case 'ALMOST_DONE':
    case 'ACHIEVEMENT':
    case 'CLEANUP': return { href: '/library' };
    default: return null;
  }
}

/**
 * 알림이 가리키는 곳을 연다 — 알림 화면과 푸시 탭이 같이 쓴다.
 * 메인 탭 구역은 openSection 으로 연다: 경로로 navigate 하면 알림 화면 위에 메인 탭이 한 벌 더 쌓인다.
 */
export function openNotificationTarget(target: NotificationTarget) {
  if (target.section) openSection(target.section, target.params);
  else router.push(target.href);
}
