import { Children, forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// react-native-pager-view 는 네이티브 전용이라 웹에서는 번들되지 않는다.
// 웹 미리보기에서는 스와이프 없이 현재 페이지 하나만 그린다.
export type PagerViewOnPageSelectedEvent = { nativeEvent: { position: number } };

type Props = {
  initialPage?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onPageSelected?: (event: PagerViewOnPageSelectedEvent) => void;
};

export type PagerViewHandle = {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
};

const PagerView = forwardRef<PagerViewHandle, Props>(function PagerView(
  { initialPage = 0, style, children, onPageSelected },
  ref,
) {
  const [page, setPageState] = useState(initialPage);

  useImperativeHandle(ref, () => {
    const go = (index: number) => {
      setPageState(index);
      onPageSelected?.({ nativeEvent: { position: index } });
    };
    return { setPage: go, setPageWithoutAnimation: go };
  }, [onPageSelected]);

  return <View style={style}>{Children.toArray(children)[page]}</View>;
});

export default PagerView;
