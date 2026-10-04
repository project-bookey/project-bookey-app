import { Alert, Platform } from 'react-native';

/**
 * 공용 대화상자(클럽 화면에서 시작해 설정의 계정 삭제도 쓴다) — 웹은 브라우저 기본, 네이티브는 Alert.
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

/**
 * 확인/취소 — 확인이면 true. 되돌리기 어려운 동작(나가기·내보내기·종료) 앞에 쓴다.
 * 알릴 것이 여러 줄인 경고(클럽 나가기)는 `title`에 묻는 말을 두고 `message`에 결과를 적는다.
 */
export function confirmAsync(message: string, okLabel = '확인', title = ''): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(title ? `${title}\n\n${message}` : message));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
