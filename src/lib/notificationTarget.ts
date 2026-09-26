import type { Href } from 'expo-router';

import type { Notification } from '@/api/types';

export type NotificationTarget = { href: Href; section?: boolean };

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
    case 'CLUB_NEW_POST': return club('/club/[id]/posts');
    case 'CLUB_ENDED': return club('/club/[id]/result');
    case 'CLUB_CHECKPOINT_DUE':
    case 'CLUB_CHECKPOINT_RESULT':
    case 'CLUB_OVERTAKEN':
    case 'CLUB_FALLBEHIND':
    case 'CLUB_NUDGE': return club('/club/[id]');
    case 'POST_LIKED':
    case 'POST_COMMENTED': return one('/post/[id]', 'postId');
    case 'QUOTE_AGREED':
    case 'QUOTE_COMMENTED': return one('/quote/[id]', 'quoteId');
    case 'POSTCARD_RECEIVED': return { href: { pathname: '/messenger', params: { pane: 'inbox' } }, section: true };
    case 'POSTCARD_REPLIED': return { href: { pathname: '/messenger', params: { pane: 'sent' } }, section: true };
    case 'CHAT_MESSAGE': return one('/chat/[id]', 'chatId');
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
