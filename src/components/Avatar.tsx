import { StyleSheet, View } from 'react-native';
import { CachedImage as Image } from '@/components/CachedImage';

import { hairline, radius, useTheme } from '@/theme';

/**
 * 작성자 아바타 지름(px) — 앱 어디서나 같은 크기다.
 * 홈 '오늘의 글'에서 누가 썼는지가 먼저 보여야 한다는 피드백으로 40 까지 키운 뒤(2026-09-08),
 * 광장·상세·댓글·방문자 등 다른 자리도 여기에 맞췄다 — 화면마다 사람 크기가 다르면 같은 사람이
 * 다른 사람처럼 보인다. 옆에 닉네임(15/20) + 메타 한 줄(10/14) = 36 이 서면 위아래가 딱 맞는다.
 */
export const AVATAR_SIZE = 40;

/**
 * 사진 없는 사람의 기본 그림 — 원(머리)과 위가 둥근 판(어깨)으로 그린 실루엣.
 * 어깨는 아바타 아래로 넘겨 잘리게 둔다 — 증명사진처럼 보이라고.
 *
 * 닉네임 첫 글자 대신 실루엣을 쓴다(2026-09-08, 시안 D): 사진을 올린 사람과 안 올린 사람이
 * 한눈에 갈리고, 첫 글자가 기호·이모지인 닉네임에서도 지저분해지지 않는다.
 * 아바타를 직접 그리는 화면(나·프로필 수정·유저 마이페이지·방문자·엽서·채팅)도 이걸 가져다 쓴다 —
 * 사진 없는 모습이 화면마다 다르면 같은 사람이 다른 사람처럼 보인다.
 * 비율이 전부 지름에 매여 있어 40px 목록이든 112px 프로필이든 같은 얼굴이 나온다.
 */
export function PersonGlyph({ size, color }: { size: number; color: string }) {
  const head = Math.round(size * 0.27);
  const bodyW = Math.round(size * 0.52);
  const bodyH = Math.round(size * 0.4);
  return (
    <View style={[styles.glyph, { width: size, height: size }]} pointerEvents="none">
      <View style={{
        width: head,
        height: head,
        borderRadius: head / 2,
        backgroundColor: color,
        marginTop: Math.round(size * 0.22),
      }} />
      <View style={{
        width: bodyW,
        height: bodyH,
        backgroundColor: color,
        borderTopLeftRadius: bodyW / 2,
        borderTopRightRadius: bodyW / 2,
        marginTop: Math.round(size * 0.05),
      }} />
    </View>
  );
}

/**
 * 작성자 아바타(기본 AVATAR_SIZE) — 독후감·리뷰·완독 카드와 댓글 행, 홈 조각, 모임 화면이 같이 쓴다.
 * 사진이 없으면 빈 원이 아니라 종이 판 위에 실루엣을 세운다(PersonGlyph).
 */
export function Avatar({ uri, nickname, size = AVATAR_SIZE }: {
  uri?: string | null;
  /** 사진을 읽어 줄 이름. 실루엣만 설 때는 옆 닉네임 글자가 이미 읽히므로 라벨을 달지 않는다. */
  nickname: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, backgroundColor: colors.surfaceRaised, borderColor: colors.line },
    ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.avatarImage}
          resizeMode="cover"
          accessibilityLabel={`${nickname} 프로필 사진`}
        />
      ) : (
        <PersonGlyph size={size} color={colors.textFaint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.round,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  // 실루엣 두 조각(머리·어깨)을 세로로 쌓는 상자 — 넘치는 어깨는 잘라 낸다.
  glyph: { alignItems: 'center', overflow: 'hidden' },
});
