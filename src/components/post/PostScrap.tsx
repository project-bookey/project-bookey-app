import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { ScrapAuthor } from '@/components/home/ScrapAuthor';
import { META_LH, META_SIZE, QUOTE_MAX_H } from '@/components/home/scrapMetrics';
import { VISIBILITY_LABEL } from '@/components/post/PostCard';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 발췌 줄 수 — 책·프로필만 곁들인다. 홈은 0, 즉 발췌를 아예 그리지 않는다:
 * 조각이 표지와 같은 높이(108)로 줄면서 글 상자가 한 줄밖에 안 남아 그 자리를 제목이 가져갔다.
 */
const EXCERPT_LINES = { home: 0, book: 2, profile: 3 } as const;
/** 제목 줄 수 — 홈은 글 상자가 한 줄이라 제목도 한 줄에서 끊는다. */
const TITLE_LINES = { home: 1, book: 2, profile: 2 } as const;

/** 제목·발췌 줄높이(px) — 책·프로필 조판. 홈 제목만 글 상자 높이를 그대로 쓴다(homeTitle 참고). */
const TITLE_LH = 22;
const EXCERPT_LH = 20;

/**
 * 홈 조각의 글 상자(제목) 높이 상한(px).
 *
 * 홈 스포트라이트는 밑줄 조각과 독후감 조각을 번갈아 세우므로 둘의 글 상자가 같은 자리를
 * 써야 행이 출렁이지 않는다. 밑줄 쪽 인용 한 줄과 같은 상한을 공용 상수(scrapMetrics)에서
 * 그대로 받아 쓴다 — 인용 토큰이 바뀌면 두 조각이 함께 움직인다.
 *
 * 안쪽 제목 줄(22)도 제 상한을 갖는다 — 이 상자보다 작아 바깥 상자는 마지막 방어선으로만
 * 남는다(인용 조각의 quote 상한과 짝을 이루는 셈).
 */
const HOME_TEXT_MAX_H = QUOTE_MAX_H;

/**
 * 독후감 조각 — 점선 메모 안 제목 + 발췌 + 모노 메타 한 줄.
 *
 * 밑줄의 QuoteScrap 과 짝을 이루는 조각이다. 카드(PostCard)가 작성자·사진·액션까지
 * 다 보여 주는 자리라면, 조각은 '무슨 글인지'만 오려 붙인 종잇조각이다.
 * 쓰이는 자리마다 곁들이는 메타가 달라 variant 로 가른다.
 *
 * - `home`  — 홈 '오늘의 글' 스포트라이트. 머리에 작성자 행(ScrapAuthor: 아바타·닉네임·책)을
 *             밑줄 조각과 똑같이 세우고, 오른쪽 열에 `독후감` 태그와 `좋아요 n` 을 얹어 어느
 *             종류인지 알린다. 행 높이가 표지와 같게 못 박혀 있어 글 상자는 인용 한 줄 자리다 —
 *             그 한 줄은 제목이 쓰고 발췌는 빠진다.
 * - `book`  — 도서 상세. 책은 이미 아니까 누가 썼는지와 반응만.
 * - `profile` — 내 독후감. 내가 쓴 글이니 작성자 대신 어느 책·공개 범위·조회 수를 본다.
 */
export function PostScrap({ post, rotate, variant, onPress }: {
  post: Post;
  /** 기울기(도) — 목록은 index 에 따라 ±1 로 교차. */
  rotate: number;
  variant: 'home' | 'profile' | 'book';
  /**
   * 누를 때 갈 곳. 넘기지 않으면 조각은 버튼이 아니라 종잇조각 그림으로만 그려진다 —
   * 이미 바깥이 통째로 버튼인 자리(홈 스포트라이트는 카드+표지 한 쌍이 한 버튼이다)에서
   * 웹의 중첩 `<button>` 을 피하려면 여기를 비워 두고 바깥에 맡긴다. 라벨도 바깥이 읽어 준다.
   */
  onPress?: () => void;
}) {
  const { colors } = useTheme();

  const home = variant === 'home';
  const visibility = post.visibility === 'PUBLIC' ? '공개' : VISIBILITY_LABEL[post.visibility];

  const memo = (
    <MemoScrap rotate={rotate} style={home ? styles.homeCard : undefined}>
      {/* 홈은 밑줄 조각과 같은 작성자 행으로 시작한다 — 6초마다 번갈아 서도 첫 줄 모양이 같다.
          무엇의 조각인지는 `독후감` 태그가 알린다 — 밑줄과 섞여 돌아가는 자리라서.
          좋아요는 표시 전용(누를 수 없다). 0 이어도 쓴다 — 밑줄 조각도 같은 규칙. */}
      {home ? (
        <ScrapAuthor
          nickname={post.authorNickname}
          avatarUrl={post.authorAvatarUrl}
          where={post.bookTitle ?? '책 없음'}
          kind="독후감"
          stat={`좋아요 ${post.likeCount}`}
        />
      ) : null}
      <View style={home ? styles.homeText : undefined}>
        <Text
          numberOfLines={TITLE_LINES[variant]}
          style={[styles.title, home && styles.homeTitle, { color: colors.text }]}
        >
          {post.title}
        </Text>
        {/* 홈은 글 상자가 한 줄이라 제목만 선다 — 발췌를 그리면 제목을 밀어낸다. */}
        {EXCERPT_LINES[variant] > 0 ? (
          <Text
            numberOfLines={EXCERPT_LINES[variant]}
            style={[styles.excerpt, { color: colors.textMuted }]}
          >
            {post.excerpt}
          </Text>
        ) : null}
      </View>

      {/* 홈은 작성자·책·좋아요를 머리 행이 이미 보여 줘 메타 줄이 없다 — 밑줄 조각과 줄 수를 맞춘다. */}
      {home ? null : (
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
          {variant === 'profile'
            ? `${post.bookTitle ?? '책 없음'} · ${visibility} · 조회 ${post.viewCount}`
            : `${post.authorNickname} · 좋아요 ${post.likeCount}`}
        </Text>
      )}
    </MemoScrap>
  );

  // 바깥이 버튼인 자리 — 조각은 자리만 채운다. homeCard 의 flex:1 이 Pressable 몫까지 받아
  // 행을 그대로 꽉 채우므로 크기는 달라지지 않는다.
  if (!onPress) return memo;

  // 내 목록에서 '{내 닉네임}의 독후감'은 남의 글처럼 들린다 — 프로필에서는 '내 독후감'으로 읽는다.
  // 끝에 갈 곳을 붙이는 건 홈 조각(HomeScraps)의 라벨과 같은 규칙이다.
  const label = variant === 'profile'
    ? `내 독후감 ${post.title} · 독후감 상세로`
    : `${post.authorNickname}의 독후감 ${post.title} · 독후감 상세로`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={home ? styles.fill : undefined}
    >
      {memo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 홈은 높이가 못 박힌 행 안에 들어간다 — 조각이 그 행을 꽉 채워야 밑줄 조각과 같은 크기로 보인다.
  fill: { flex: 1 },
  homeCard: { flex: 1, overflow: 'hidden' },
  // 제목이 길어져도 이 상자 밖으로는 한 픽셀도 안 나간다(HOME_TEXT_MAX_H 주석 참고).
  homeText: { maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  title: { ...typeScale.titleSerif, fontSize: 15, lineHeight: TITLE_LH },
  excerpt: { ...typeScale.quote, fontSize: 13, lineHeight: EXCERPT_LH },
  // numberOfLines 는 줄 수만 자를 뿐 글자 상자는 못 자른다 — 웹에서 line-clamp 가 블록으로
  // 풀리면 잘린 줄이 상자 높이만큼 그대로 그려져 아랫줄을 밀어낸다(HomeScraps 의 quote 와 같은 방어).
  // 홈 제목은 글 상자(28) 한 줄을 통째로 쓴다 — 줄높이를 상자에 맞춰야 6초마다 밑줄 인용(17/28)과
  // 자리를 바꿔도 글자가 같은 높이에 앉는다(22 로 두면 회전할 때마다 3px 씩 위아래로 튄다).
  homeTitle: { lineHeight: HOME_TEXT_MAX_H, maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  meta: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: spacing.sm },
});
