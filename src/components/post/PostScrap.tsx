import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { ScrapAuthor } from '@/components/home/ScrapAuthor';
import { META_LH, META_SIZE, QUOTE_MAX_H } from '@/components/home/scrapMetrics';
import { VISIBILITY_LABEL } from '@/components/post/PostByline';
import { LikeCount } from '@/components/post/LikeCount';
import { ViewCount } from '@/components/post/ViewCount';
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
 * 홈 스포트라이트의 행 높이가 표지에 못 박혀 있어 글 상자는 인용 토큰 한 줄 자리다 —
 * 그 상한을 공용 상수(scrapMetrics)에서 그대로 받아 쓴다(인용 토큰이 바뀌면 함께 움직인다).
 *
 * 안쪽 제목 줄(22)도 제 상한을 갖는다 — 이 상자보다 작아 바깥 상자는 마지막 방어선으로만 남는다.
 */
const HOME_TEXT_MAX_H = QUOTE_MAX_H;

/**
 * 독후감 조각 — 점선 메모 안 제목 + 발췌 + 모노 메타 한 줄.
 *
 * 카드(PostCard)가 작성자·사진·액션까지 다 보여 주는 자리라면, 조각은 '무슨 글인지'만
 * 오려 붙인 종잇조각이다. 쓰이는 자리마다 곁들이는 메타가 달라 variant 로 가른다.
 *
 * - `home`  — 홈 '오늘의 글' 스포트라이트. 머리에 작성자 행(ScrapAuthor: 아바타·닉네임·책)을
 *             세우고, 오른쪽 열에 `독후감` 태그와 좋아요(하트 + n)를 얹는다. 행 높이가 표지와 같게
 *             못 박혀 있어 글 상자는 인용 토큰 한 줄 자리다 — 그 한 줄은 제목이 쓰고 발췌는 빠진다.
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
  const metaText = [typeScale.monoLabel, styles.meta, { color: colors.textFaint }];

  const memo = (
    <MemoScrap rotate={rotate} style={home ? styles.homeCard : undefined}>
      {/* 홈은 작성자 행으로 시작한다 — 6초마다 다른 글로 바뀌어도 첫 줄 모양이 같다.
          좋아요는 표시 전용(누를 수 없다). 0 이어도 쓴다 — 비우면 회전할 때 오른쪽 열이 들쭉날쭉하다. */}
      {home ? (
        <ScrapAuthor
          nickname={post.authorNickname}
          avatarUrl={post.authorAvatarUrl}
          where={post.bookTitle ?? '책 없음'}
          kind="독후감"
          likes={post.likeCount}
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
        {/* 글이 없는 노트 독후감은 발췌가 비어 있다 — 그땐 제목만 선다. */}
        {EXCERPT_LINES[variant] > 0 && post.excerpt.length > 0 ? (
          <Text
            numberOfLines={EXCERPT_LINES[variant]}
            style={[styles.excerpt, { color: colors.textMuted }]}
          >
            {post.excerpt}
          </Text>
        ) : null}
      </View>

      {/* 홈은 작성자·책·좋아요를 머리 행이 이미 보여 줘 메타 줄이 없다 — 못 박힌 행 높이 안에 들어간다. */}
      {/* 프로필·책 메타는 조회(눈)·좋아요(하트) 아이콘을 끼우므로 행으로 잇는다 — 길어지면 글자 쪽만 줄어든다. */}
      {home ? null : variant === 'profile' ? (
        <View style={[styles.metaRow, styles.metaGap]}>
          <Text numberOfLines={1} style={[metaText, styles.shrink]}>{post.bookTitle ?? '책 없음'}</Text>
          <Text style={metaText}> · {visibility} · </Text>
          <ViewCount count={post.viewCount} textStyle={metaText} />
        </View>
      ) : (
        <View style={[styles.metaRow, styles.metaGap]}>
          <Text numberOfLines={1} style={[metaText, styles.shrink]}>{post.authorNickname}</Text>
          <Text style={metaText}> · </Text>
          <LikeCount count={post.likeCount} textStyle={metaText} />
        </View>
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
  // 홈은 높이가 못 박힌 행 안에 들어간다 — 조각이 그 행을 꽉 채워야 옆 표지와 같은 높이로 보인다.
  fill: { flex: 1 },
  homeCard: { flex: 1, overflow: 'hidden' },
  // 제목이 길어져도 이 상자 밖으로는 한 픽셀도 안 나간다(HOME_TEXT_MAX_H 주석 참고).
  homeText: { maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  title: { ...typeScale.titleSerif, fontSize: 15, lineHeight: TITLE_LH },
  excerpt: { ...typeScale.quote, fontSize: 13, lineHeight: EXCERPT_LH },
  // numberOfLines 는 줄 수만 자를 뿐 글자 상자는 못 자른다 — 웹에서 line-clamp 가 블록으로
  // 풀리면 잘린 줄이 상자 높이만큼 그대로 그려져 아랫줄을 밀어낸다(scrapMetrics 의 QUOTE_MAX_H 참고).
  // 홈 제목은 글 상자(28) 한 줄을 통째로 쓴다 — 줄높이를 상자에 맞춰 글자가 상자 가운데에 앉는다.
  homeTitle: { lineHeight: HOME_TEXT_MAX_H, maxHeight: HOME_TEXT_MAX_H, overflow: 'hidden' },
  meta: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH },
  metaGap: { marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
