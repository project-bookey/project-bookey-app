import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/*
 * 키보드 다루기 공용 부품 — 입력 화면은 모두 여기를 거친다.
 *
 * 안드로이드는 엣지투엣지(app.json edgeToEdgeEnabled)라 키보드가 떠도 창이 줄지 않는다. 예전처럼
 * KeyboardAvoidingView 의 behavior 를 iOS 에만 주면 안드로이드에서는 하단 바·입력줄·시트가 키보드 밑에 깔린다.
 * 그래서 두 플랫폼 모두 '키보드와 겹친 만큼 아래를 비운다'. 겹침은 키보드가 움직일 때마다 이 상자를 창 기준으로
 * 재서 구하므로, 화면 맨 위에서 시작하지 않는 곳(iOS 시트로 뜨는 타이머, 모달 시트)도 맞고, 창이 줄어드는
 * 환경이면 겹침이 0 이 되어 두 번 비우지 않는다.
 */

// iOS 는 키보드가 움직이기 전(Will)에 알려 줘 같이 움직일 수 있고, 안드로이드는 다 뜬 뒤(Did)에만 알려 준다.
const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** 키보드가 떠 있는지. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(SHOW, () => setOpen(true));
    const hide = Keyboard.addListener(HIDE, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/** 이 KeyboardArea 가 지금 키보드만큼 비우고 있는지 — 하단 바가 홈 인디케이터 몫을 거둘 때 본다. */
const KeyboardLiftContext = createContext(false);

/** 키보드와 같은 길이·곡선으로 다음 배치를 움직인다(iOS). 안드로이드 Did 이벤트는 길이가 0 이라 그냥 바뀐다. */
function animateWith(event: KeyboardEvent | null) {
  if (!event?.duration) return;
  const duration = Math.max(event.duration, 10);
  LayoutAnimation.configureNext({
    duration,
    update: { duration, type: LayoutAnimation.Types[event.easing] ?? LayoutAnimation.Types.keyboard },
  });
}

/**
 * 키보드와 겹친 만큼 아래를 비우는 상자(flex 1). 하단 고정 바·입력줄은 이 안에서 스크롤의 형제로 두면
 * 키보드 바로 위에 붙는다. style 은 키보드 위 남은 자리를 채우는 안쪽 상자에 걸린다(시트는 justifyContent 로 아래에,
 * 대화상자는 가운데에).
 */
export function KeyboardArea({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const boxRef = useRef<View>(null);
  const lastEvent = useRef<KeyboardEvent | null>(null);
  const liftRef = useRef(0);
  const [lift, setLift] = useState(0);

  const apply = useCallback((next: number, event: KeyboardEvent | null) => {
    if (liftRef.current === next) return;
    liftRef.current = next;
    animateWith(event);
    setLift(next);
  }, []);

  const update = useCallback(() => {
    const event = lastEvent.current;
    const box = boxRef.current;
    if (!event || !box) {
      apply(0, null);
      return;
    }
    box.measureInWindow((_x, y, _width, height) => {
      const keyboardTop = event.endCoordinates.screenY;
      // iOS '크로스 페이드 전환' 설정에서는 키보드 위치가 0 으로 온다 — 그때는 비우지 않는다(RN KAV 와 같은 처리).
      apply(keyboardTop > 0 ? Math.max(y + height - keyboardTop, 0) : 0, event);
    });
  }, [apply]);

  useEffect(() => {
    // 이미 키보드가 떠 있는 채로 열린 경우(입력 중 시트를 띄움)도 맞춘다.
    const metrics = Keyboard.isVisible() ? Keyboard.metrics?.() : undefined;
    if (metrics) {
      lastEvent.current = { duration: 0, easing: 'keyboard', endCoordinates: metrics } as KeyboardEvent;
      update();
    }
    const show = Keyboard.addListener(SHOW, (event) => {
      lastEvent.current = event;
      update();
    });
    const hide = Keyboard.addListener(HIDE, (event) => {
      lastEvent.current = null;
      apply(0, event ?? null);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [apply, update]);

  return (
    // 바깥 상자 크기는 부모가 정한다 — 비우는 여백은 가운데 상자에만 주므로 다시 재도 겹침이 흔들리지 않고,
    // 쓰는 쪽 style(제 padding·가운데 맞춤 포함)은 그 안쪽 상자에 그대로 걸린다.
    <View ref={boxRef} style={styles.fill} onLayout={update}>
      <View style={[styles.fill, { paddingBottom: lift }]}>
        <View style={[styles.fill, style]}>
          <KeyboardLiftContext.Provider value={lift > 0}>{children}</KeyboardLiftContext.Provider>
        </View>
      </View>
    </View>
  );
}

/**
 * 하단 바의 아래 여백. 키보드 위에 붙어 있을 때는 홈 인디케이터 몫을 비울 이유가 없어 min 만 두고,
 * 평소에는 홈 인디케이터를 피한다 — 바는 둘 중 큰 쪽(max), 시트처럼 인디케이터 위에 여백을 더 얹는 곳은 stacked.
 * KeyboardArea 안에서 써야 한다.
 */
export function useBottomBarPadding(min: number = spacing.lg, stacked = false): number {
  const insets = useSafeAreaInsets();
  const lifted = useContext(KeyboardLiftContext);
  if (lifted) return min;
  return stacked ? insets.bottom + min : Math.max(insets.bottom, min);
}

/**
 * 화면(또는 시트) 아래에 붙는 상자 — 하단 고정 바·시트 몸통. 아래 여백을 useBottomBarPadding 으로 준다.
 * 쓰는 화면의 훅은 KeyboardArea 바깥이라 문맥을 못 읽으므로, 바는 이 부품으로 KeyboardArea 안에 둔다.
 */
export function KeyboardDock({ style, min = spacing.lg, stacked = false, children }: {
  style?: StyleProp<ViewStyle>;
  min?: number;
  stacked?: boolean;
  children: ReactNode;
}) {
  const paddingBottom = useBottomBarPadding(min, stacked);
  return <View style={[style, { paddingBottom }]}>{children}</View>;
}

type Reveal = (target: RefObject<View | null>) => void;
type ScrollGetter = () => ScrollView | null | undefined;

/** reveal 의 본체 — getScroll 이 돌려주는 스크롤을 움직인다. */
function useRevealWith(getScroll: ScrollGetter): Reveal {
  const pending = useRef<{ remove: () => void } | null>(null);
  const getScrollRef = useRef(getScroll);
  getScrollRef.current = getScroll;

  useEffect(() => () => pending.current?.remove(), []);

  return useCallback<Reveal>((target) => {
    if (Platform.OS === 'web') return; // 웹에는 소프트 키보드 이벤트가 없다
    const run = () => {
      const box = target.current;
      const scroll = getScrollRef.current();
      const keyboard = Keyboard.metrics?.();
      const native = scroll?.getNativeScrollRef();
      if (!box || !scroll || !keyboard || !native) return;
      box.measureInWindow((_x, y, _width, height) => {
        if (y + height + spacing.md <= keyboard.screenY) return; // 이미 보인다 — 움직이지 않는다
        // RN 계산은 스크롤이 창 맨 위에서 시작한다고 보므로, 스크롤의 창 y 만큼 더 올려 상자 아랫단을 키보드 바로 위에 맞춘다.
        native.measureInWindow((_sx, scrollY) => {
          scroll.scrollResponderScrollNativeHandleToKeyboard(box, scrollY + spacing.md, true);
        });
      });
    };
    pending.current?.remove();
    pending.current = null;
    // KeyboardArea 가 아래를 비워 스크롤 창이 줄어든 뒤에 재야 끝까지 올릴 수 있다. 안드로이드는 키보드가 다 뜬 뒤에야
    // 비우기 시작하므로 조금 더 기다린다.
    const settle = Platform.OS === 'android' ? 160 : 0;
    if (Keyboard.isVisible()) {
      setTimeout(run, settle);
      return;
    }
    pending.current = Keyboard.addListener('keyboardDidShow', () => {
      pending.current?.remove();
      pending.current = null;
      setTimeout(run, settle);
    });
  }, []);
}

/**
 * 스크롤 안 입력 묶음을 키보드 위로 끌어올린다 — 입력창만 보이고 그 밑 '보내기'·'남기기'가 키보드에 묻히지 않게.
 * 입력창 onFocus 에서 입력창과 버튼을 함께 감싼 상자를 넘긴다(`onFocus={() => reveal(boxRef)}`). 상자가 이미 보이면
 * 움직이지 않는다. 스크롤은 KeyboardScroll(또는 KeyboardArea 안의 스크롤)이어야 끝까지 올라간다.
 *
 * 스크롤을 가진 화면에서 직접 쓸 때 — 스크롤 ref 를 넘긴다.
 */
export function useScrollReveal(scrollRef: RefObject<ScrollView | null>): Reveal {
  return useRevealWith(() => scrollRef.current);
}

const RevealContext = createContext<Reveal>(() => {});

/** 안쪽 부품(엽서 쓰기·답장 칸 등)에서 쓸 때 — 감싼 KeyboardScroll/KeyboardRevealProvider 가 없으면 아무것도 안 한다. */
export function useKeyboardReveal(): Reveal {
  return useContext(RevealContext);
}

/** 안쪽 부품의 reveal 이 움직일 스크롤을 내려 준다. FlatList 는 getScrollResponder() 로 안쪽 ScrollView 를 넘긴다. */
export function KeyboardRevealProvider({ getScroll, children }: { getScroll: ScrollGetter; children: ReactNode }) {
  const reveal = useRevealWith(getScroll);
  return <RevealContext.Provider value={reveal}>{children}</RevealContext.Provider>;
}

/**
 * 입력이 있는 스크롤 화면 — KeyboardArea + ScrollView + 안쪽 부품용 reveal. 키보드가 떠도 끝까지 스크롤해 버튼에 닿고,
 * 키보드가 떠 있을 때 버튼 첫 탭이 키보드만 닫지 않도록 keyboardShouldPersistTaps="handled" 가 기본이다.
 * 하단 고정 바가 있는 화면은 KeyboardArea 안에 ScrollView 와 KeyboardDock 을 나란히 두고 useScrollReveal 을 쓴다.
 */
export function KeyboardScroll({ ref, areaStyle, ...props }: ScrollViewProps & {
  ref?: Ref<ScrollView>;
  /** 바깥 KeyboardArea 의 안쪽 상자 스타일 */
  areaStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const setRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: ScrollView | null }).current = node;
    },
    [ref],
  );
  const getScroll = useCallback(() => scrollRef.current, []);
  return (
    <KeyboardArea style={areaStyle}>
      <KeyboardRevealProvider getScroll={getScroll}>
        <ScrollView ref={setRef} keyboardShouldPersistTaps="handled" {...props} />
      </KeyboardRevealProvider>
    </KeyboardArea>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
