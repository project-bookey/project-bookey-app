import { Children, Component, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type PagerViewOnPageSelectedEvent = { nativeEvent: { position: number } };

type PageScrollEvent = { nativeEvent: { position: number; offset: number } };

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  initialPage?: number;
  onPageScroll?: (event: PageScrollEvent) => void;
  onPageSelected?: (event: PagerViewOnPageSelectedEvent) => void;
  // 네이티브 전용 옵션 — 웹에서는 무시한다.
  offscreenPageLimit?: number;
  overdrag?: boolean;
  scrollEnabled?: boolean;
};

/**
 * 웹용 PagerView 대체 구현. 스와이프 없이 현재 페이지만 보여 주고,
 * 나머지 페이지는 마운트를 유지한 채 숨겨서 탭을 오가도 화면 상태가 남게 한다.
 * setPage / setPageWithoutAnimation은 네이티브와 같은 이벤트를 흘려 준다.
 */
export default class PagerView extends Component<Props, { page: number }> {
  state = { page: this.props.initialPage ?? 0 };

  setPage(page: number) {
    if (page === this.state.page) return;
    this.setState({ page });
    this.props.onPageScroll?.({ nativeEvent: { position: page, offset: 0 } });
    this.props.onPageSelected?.({ nativeEvent: { position: page } });
  }

  setPageWithoutAnimation(page: number) {
    this.setPage(page);
  }

  render() {
    return (
      <View style={this.props.style}>
        {Children.toArray(this.props.children).map((child, index) => (
          <View key={index} style={{ flex: 1, display: index === this.state.page ? 'flex' : 'none' }}>
            {child}
          </View>
        ))}
      </View>
    );
  }
}
