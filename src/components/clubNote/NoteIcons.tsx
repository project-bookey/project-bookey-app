import type { LucideIcon } from 'lucide-react-native';

import { iconStroke } from '@/theme/tokens';

/** 노트 크롬의 선 아이콘 — lucide 아이콘에 콜라주 획(각진 캡·모서리)을 펼친다. */
export function ToolIcon({ icon: Icon, size = 22, color }: { icon: LucideIcon; size?: number; color: string }) {
  return <Icon size={size} color={color} {...iconStroke} />;
}
