import type { Post, PostVisibility } from '@/api/types';
import { parsePostNoteDoc, type PostNoteDoc } from '@/components/note';

/** 글 하나에 엮을 수 있는 밑줄 수 — 서버 상한과 같은 값(텍스트·노트 공통). */
export const POST_QUOTE_MAX = 10;
/** 노트 독후감에 붙일 수 있는 사진 수 — 서버 상한과 같은 값(텍스트 글은 10). */
export const NOTE_IMAGE_MAX = 30;
/** 제목 길이 상한 — 서버 계약과 같은 값. */
export const POST_TITLE_MAX = 300;

/** 노트 모드 독후감인지. */
export const isNotePost = (post: Pick<Post, 'format'>) => post.format === 'NOTE';

/** 서버의 불투명 document → 노트 문서. 깨졌거나 비어도 빈 격자 한 장으로 연다(throw 없음). */
export const noteDocOf = (post: Pick<Post, 'document'>): PostNoteDoc => parsePostNoteDoc(post.document);

/**
 * 공개 범위 고르기 — 클럽 글은 클럽만(CLUB)·광장에도(PUBLIC), 그 밖은 공개·비공개.
 * 링크 공개는 앱에서 새로 고르지 않는다 — 이미 링크 공개인 글을 고칠 때만 그대로 둘 수 있게 보인다.
 */
export function visibilityOptions(inClub: boolean, current?: PostVisibility): { value: PostVisibility; label: string }[] {
  if (inClub) return [{ value: 'CLUB', label: '클럽만' }, { value: 'PUBLIC', label: '광장에도' }];
  return [
    { value: 'PUBLIC', label: '공개' },
    { value: 'PRIVATE', label: '비공개' },
    ...(current === 'LINK' ? [{ value: 'LINK' as const, label: '링크' }] : []),
  ];
}

/** 공개 범위 아래 한 줄. */
export function visibilityCaption(visibility: PostVisibility, inClub: boolean): string {
  switch (visibility) {
    case 'CLUB': return '이 클럽 멤버만 봅니다';
    case 'PUBLIC': return inClub ? '클럽과 함께 광장·책 상세에도 실립니다' : '광장·책 상세에 실립니다';
    case 'PRIVATE': return '나만 봅니다';
    case 'LINK': return '링크로만 볼 수 있어요';
  }
}

/** 처음 고를 공개 범위 — 클럽 글은 클럽만, 그 밖은 공개. */
export const defaultVisibility = (inClub: boolean): PostVisibility => (inClub ? 'CLUB' : 'PUBLIC');
