import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { iconStroke, useTheme } from '@/theme';
import { spacing, typeScale } from '@/theme/tokens';

import { ICON_SIZE, IconButton } from './IconButton';

/** 좌우 슬롯의 최소 폭 — 뒤로 버튼의 44pt 터치 상자. */
const MIN_SIDE = 44;

/**
 * 서브 화면 헤더 — 배경 없이 종이 위에 얹힌다(PaperScreen 안에서 쓴다).
 * 우측은 슬롯이며 기본값은 비어 있다 — 동작 없는 ⋯ 버튼을 만들지 않는다.
 */
export function SubHeader({ category, right, onBack, floating = false }: {
  /** 가운데 카테고리 표기 — 모노 아이브로우. */
  category?: string;
  /** 우측 슬롯 — 없으면 자리만 비워 좌우 균형을 맞춘다. */
  right?: ReactNode;
  /** 기본 동작은 뒤로 가기 — 돌아갈 곳이 없으면 서가로. */
  onBack?: () => void;
  /** 사진 같은 배경 위에 떠 있는 머리(클럽 홈) — 뒤로를 유리 원으로 그린다. 오른쪽 슬롯도 IconButton glass 를 쓴다. */
  floating?: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // 우측 슬롯이 44pt 보다 넓으면(아이콘 두 개 등) 왼쪽도 같은 폭을 비워 가운데 카테고리가 실제 중앙에 오게 한다.
  const [rightWidth, setRightWidth] = useState(MIN_SIDE);

  // 딥링크·웹 새로고침으로 이 화면이 스택의 첫 화면이면 back() 이 아무 일도 하지
  // 않아 뒤로 버튼이 막다른 골목이 된다. 그때는 서가로 보낸다.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={[styles.side, { minWidth: rightWidth }]}>
          {/* 뒤로 — 글자 '←' 대신 각진 획의 화살표 아이콘(2026-10-05 사용자 결정). */}
          <View style={[styles.back, !floating && styles.backPlain]}>
            <IconButton onPress={onBack ?? goBack} accessibilityLabel="뒤로" glass={floating}>
              <ArrowLeft size={floating ? ICON_SIZE.glass : ICON_SIZE.plain} color={colors.text} {...iconStroke} />
            </IconButton>
          </View>
        </View>

        <Text numberOfLines={1} style={[typeScale.monoEyebrow, styles.category, { color: colors.textFaint }]}>
          {category ?? ''}
        </Text>

        <View
          style={[styles.side, styles.rightSlot]}
          onLayout={(e) => setRightWidth(Math.max(MIN_SIDE, Math.round(e.nativeEvent.layout.width)))}
        >
          {right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: 'transparent' },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  // 좌우 슬롯 폭을 맞춰 가운데 카테고리가 실제 중앙에 오게 한다(왼쪽은 우측 슬롯 폭을 따라간다).
  side: { minWidth: MIN_SIDE, justifyContent: 'center' },
  rightSlot: { alignItems: 'flex-end' },
  // 왼쪽 슬롯이 넓어져도 뒤로 버튼의 터치 상자는 그대로 44pt.
  back: { minWidth: MIN_SIDE, alignSelf: 'flex-start', justifyContent: 'center' },
  // 상자 없는 화살표는 터치 상자(44) 안에서 가운데라, 상자를 왼쪽으로 내밀어 화살표를 화면 여백 선에 맞춘다.
  backPlain: { marginLeft: -(44 - ICON_SIZE.plain) / 2 },
  category: { flexShrink: 1 },
});
