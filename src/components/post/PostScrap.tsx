import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { VISIBILITY_LABEL } from '@/components/post/PostCard';
import { spacing, typeScale, useTheme } from '@/theme';

/** 발췌 줄 수 — 홈은 한 줄만 흘리고, 책·프로필은 더 읽힌다. */
const EXCERPT_LINES = { home: 1, book: 2, profile: 3 } as const;

/** 메타(모노) 조판 — 밑줄 조각·홈 스포트라이트와 같은 값. */
const META_SIZE = 10;
const META_LH = 14;
/** 핫 줄과 메타 사이 간격(px). */
const HOT_GAP = 3;

/**
 * 홈 조각의 글 상자(제목+발췌) 높이 상한(px).
 *
 * 홈 스포트라이트는 밑줄 조각과 독후감 조각을 번갈아 세우므로 둘의 글 상자가 같은 자리를
 * 써야 행이 출렁이지 않는다. 밑줄 쪽은 인용 3줄(HomeScraps 의 QUOTE_MAX_H)이라 여기서도
 * 숫자를 베끼지 않고 같은 토큰에서 셈한다 — 인용 토큰이 바뀌면 둘이 함께 움직인다.
 * (HomeScraps 에서 import 하면 서로를 가져오는 순환이 된다.)
 */
const HOME_TEXT_MAX_H = 3 * typeScale.quote.lineHeight;

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
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const home = variant === 'home';
  const visibility = post.visibility === 'PUBLIC' ? '공개' : VISIBILITY_LABEL[post.visibility];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${post.authorNickname}의 독후감 ${post.title}`}
      style={home ? styles.fill : undefined}
    >
      <MemoScrap rotate={rotate} style={home ? styles.homeCard : undefined}>
        <View style={home ? styles.homeText : undefined}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
            {post.title}
          </Text>
          <Text
            numberOfLines={EXCERPT_LINES[variant]}
            style={[styles.excerpt, { color: colors.textMuted }]}
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
            `${post.authorNickname} · 좋아요 ${post.likeCount} · 댓글 ${post.commentCount}`
          )}
        </Text>

        {/* 홈에서는 밑줄 조각의 핫 줄과 같은 자리에 반응 수를 세운다 — 표시 전용(누를 수 없다). */}
        {home ? (
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.hot, { color: colors.accent }]}>
            좋아요 {post.likeCount} · 댓글 {post.commentCount}
          </Text>
        ) : null}
      </MemoScrap>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 홈은 높이가 못 박힌 행 안에 들어간다 — 조각이 그 행을 꽉 채워야 밑줄 조각과 같은 크기로 보인다.
  fill: { flex: 1 },
  homeCard: { flex: 1, overflow: 'hidden' },
  // 제목이 두 줄, 발췌가 길어져도 이 상자 밖으로는 한 픽셀도 안 나간다(HOME_TEXT_MAX_H 주석 참고).
  homeText: { maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  title: { ...typeScale.titleSerif, fontSize: 15, lineHeight: 22 },
  excerpt: { ...typeScale.quote, fontSize: 13, lineHeight: 20 },
  meta: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: spacing.sm },
  // 남는 자리를 글 위로 몰아 메타·핫 줄을 조각 바닥에 붙인다 — 글 길이와 무관하게 두 줄의 y 가 같다.
  metaBottom: { marginTop: 'auto' },
  hot: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: HOT_GAP },
});
