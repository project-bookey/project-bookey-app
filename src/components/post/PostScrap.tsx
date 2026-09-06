import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { HOT_GAP, META_LH, META_SIZE, QUOTE_MAX_H } from '@/components/home/scrapMetrics';
import { VISIBILITY_LABEL } from '@/components/post/PostCard';
import { spacing, typeScale, useTheme } from '@/theme';

/** 발췌 줄 수 — 홈은 제목 두 줄 아래로 두 줄, 책·프로필은 더 읽힌다. */
const EXCERPT_LINES = { home: 2, book: 2, profile: 3 } as const;
/**
 * 제목 줄 수 — 홈 전용이 아니라 세 variant 가 모두 이 값으로 끊는다(발췌만 자리마다 다르다).
 * 홈은 여기에 더해 상자 높이 계산에도 쓴다(numberOfLines 와 같은 값이어야 한다).
 */
const TITLE_LINES = 2;

/** 제목·발췌 줄높이(px) — 스타일과 상자 상한이 같은 값을 봐야 해서 상수로 둔다. */
const TITLE_LH = 22;
const EXCERPT_LH = 20;

/**
 * 홈 조각의 글 상자(제목+발췌) 높이 상한(px).
 *
 * 홈 스포트라이트는 밑줄 조각과 독후감 조각을 번갈아 세우므로 둘의 글 상자가 같은 자리를
 * 써야 행이 출렁이지 않는다. 밑줄 쪽 인용 3줄과 같은 상한을 공용 상수(scrapMetrics)에서
 * 그대로 받아 쓴다 — 인용 토큰이 바뀌면 두 조각이 함께 움직인다.
 *
 * 안쪽 두 줄(제목 2줄 44 + 발췌 2줄 40)도 각자 제 상한을 갖는다 — 합이 이 상자와 같아
 * 바깥 상자는 마지막 방어선으로만 남는다(인용 조각의 quote 상한과 짝을 이루는 셈).
 */
const HOME_TEXT_MAX_H = QUOTE_MAX_H;

/**
 * 독후감 조각 — 점선 메모 안 제목 + 발췌 + 모노 메타 한 줄.
 *
 * 밑줄의 QuoteScrap 과 짝을 이루는 조각이다. 카드(PostCard)가 작성자·사진·액션까지
 * 다 보여 주는 자리라면, 조각은 '무슨 글인지'만 오려 붙인 종잇조각이다.
 * 쓰이는 자리마다 곁들이는 메타가 달라 variant 로 가른다.
 *
 * - `home`  — 홈 '오려둔 글' 스포트라이트. 어느 종류인지부터 알려야 해서 `독후감` 을 앞세우고,
 *             밑줄 조각의 핫 줄 자리에 좋아요·댓글 수를 얹는다. 행 높이가 못 박혀 있어
 *             글 상자를 3줄 자리로 가두고 메타는 조각 바닥에 붙인다.
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
      <View style={home ? styles.homeText : undefined}>
        <Text
          numberOfLines={TITLE_LINES}
          style={[styles.title, home && styles.homeTitle, { color: colors.text }]}
        >
          {post.title}
        </Text>
        <Text
          numberOfLines={EXCERPT_LINES[variant]}
          style={[styles.excerpt, home && styles.homeExcerpt, { color: colors.textMuted }]}
        >
          {post.excerpt}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={[typeScale.monoLabel, styles.meta, home && styles.metaBottom, { color: colors.textFaint }]}
      >
        {variant === 'home' ? (
          <>
            {/* 무엇의 조각인지부터 — 밑줄과 섞여 돌아가는 자리라 종류를 색으로도 가른다. */}
            <Text style={{ color: colors.accent }}>독후감</Text>
            {` · ${post.authorNickname} · ${post.bookTitle ?? '책 없음'}`}
          </>
        ) : variant === 'profile' ? (
          `${post.bookTitle ?? '책 없음'} · ${visibility} · 조회 ${post.viewCount}`
        ) : (
          `${post.authorNickname} · 좋아요 ${post.likeCount}`
        )}
      </Text>

      {/* 홈에서는 밑줄 조각의 핫 줄과 같은 자리에 반응 수를 세운다 — 표시 전용(누를 수 없다).
          0 이어도 그린다: 밑줄 조각도 같은 규칙이라 회전 중에 줄 수가 달라지지 않는다. */}
      {home ? (
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.hot, { color: colors.accent }]}>
          좋아요 {post.likeCount}
        </Text>
      ) : null}
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
  // 제목이 두 줄, 발췌가 길어져도 이 상자 밖으로는 한 픽셀도 안 나간다(HOME_TEXT_MAX_H 주석 참고).
  homeText: { maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  title: { ...typeScale.titleSerif, fontSize: 15, lineHeight: TITLE_LH },
  excerpt: { ...typeScale.quote, fontSize: 13, lineHeight: EXCERPT_LH },
  // numberOfLines 는 줄 수만 자를 뿐 글자 상자는 못 자른다 — 웹에서 line-clamp 가 블록으로
  // 풀리면 잘린 줄이 상자 높이만큼 그대로 그려져 아랫줄을 밀어낸다(HomeScraps 의 quote 와 같은 방어).
  homeTitle: { maxHeight: TITLE_LINES * TITLE_LH, overflow: 'hidden' },
  homeExcerpt: { maxHeight: EXCERPT_LINES.home * EXCERPT_LH, overflow: 'hidden' },
  meta: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: spacing.sm },
  // 남는 자리를 글 위로 몰아 메타·핫 줄을 조각 바닥에 붙인다 — 글 길이와 무관하게 두 줄의 y 가 같다.
  metaBottom: { marginTop: 'auto' },
  hot: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: HOT_GAP },
});
