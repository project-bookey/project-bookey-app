import { Alert, Platform } from 'react-native';

/**
 * 모임 화면 공용 대화상자 — 웹은 브라우저 기본, 네이티브는 Alert.
 * 컴포넌트를 띄우지 않고 Promise 로 답을 받으므로 mutation 앞에 그대로 await 한다.
 */

/** 한 줄 알림. */
export function notify(message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
}

/** 확인/취소 — 확인이면 true. 되돌리기 어려운 동작(나가기·내보내기·종료) 앞에 쓴다. */
export function confirmAsync(message: string, okLabel = '확인'): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert(
      '',
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
