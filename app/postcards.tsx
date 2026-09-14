import { Redirect } from 'expo-router';

/** 엽서함은 메신저 구역의 한 칸이 됐다 — 옛 경로로 들어오면 그 칸으로 보낸다. */
export default function PostcardsRedirect() {
  return <Redirect href={{ pathname: '/messenger', params: { pane: 'inbox' } }} />;
}
