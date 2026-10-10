import { Linking } from 'react-native';

import { router, type Href } from '@/navigation';
import { openSection, type SectionRoute } from '@/components/pager/sectionPager';

/**
 * 관리자가 넣은 링크(홈 배너·공지 팝업·전체 푸시)가 가리키는 곳.
 * - 웹 주소(http·https)는 브라우저로 연다.
 * - '/…' 는 앱 화면 경로. 메인 탭 다섯 구역('/plaza' 등, '/' 는 홈)은 openSection 으로 연다 —
 *   경로로 push 하면 지금 화면 위에 메인 탭이 한 벌 더 쌓인다.
 * - 그 밖의 스킴은 열지 않는다(null).
 */
export type LinkTarget =
  | { url: string; href?: undefined; section?: undefined }
  | { href: Href; url?: undefined; section?: undefined }
  | { section: SectionRoute; params?: Record<string, string>; url?: undefined; href?: undefined };

const SECTIONS: readonly SectionRoute[] = ['plaza', 'clubs', 'home', 'messenger', 'profile'];

export function linkTarget(link: unknown): LinkTarget | null {
  if (typeof link !== 'string') return null;
  const value = link.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return { url: value };
  if (!value.startsWith('/') || value.startsWith('//')) return null;

  const [path, query = ''] = value.split('#')[0].split('?', 2);
  const name = path.replace(/\/+$/, '').slice(1) || 'home';
  const section = SECTIONS.find((s) => s === name);
  if (!section) return { href: value as Href };
  const params = parseQuery(query);
  return Object.keys(params).length > 0 ? { section, params } : { section };
}

export function openLinkTarget(target: LinkTarget) {
  if (target.url) Linking.openURL(target.url).catch(() => {});
  else if (target.section) openSection(target.section, target.params);
  else if (target.href) router.push(target.href);
}

/** 링크를 바로 연다. 열 수 없는 링크면 false. */
export function openLink(link: unknown): boolean {
  const target = linkTarget(link);
  if (!target) return false;
  openLinkTarget(target);
  return true;
}

/** 'tab=notes&x=1' → { tab: 'notes', x: '1' }. RN 의 URLSearchParams 는 문자열 생성자를 다 갖추지 않아 직접 나눈다. */
function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, raw = ''] = pair.split('=', 2);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      // 잘못 인코딩된 값은 건너뛴다.
    }
  }
  return out;
}
