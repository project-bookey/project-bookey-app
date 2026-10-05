import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubCommunityApi } from '@/api/endpoints';
import type { ActivityCard, BookSummary } from '@/api/types';
import { BookeyPackTabs } from '@/components/chat/BookeyPackTabs';
import { BOOKEY_STICKER_PACKS } from '@/components/chat/bookeyStickers';
import { Button, Loading, Segmented, formatClock, linkLabel } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { NoteSheet } from './NoteSheet';
import { ActivityCardFace, snapshotOf } from './elements/ActivityCardFace';
import { BookStickerFace } from './elements/BookStickerFace';
import { BOOK_STICKER_RATIO } from './noteDoc';
import { EMOJI_STICKERS, STICKER_PACK } from './stickerPack';

type Tab = 'bookey' | 'emoji' | 'pack' | 'book';

const TABS: { value: Tab; label: string }[] = [
  { value: 'bookey', label: '이모티콘' },
  { value: 'emoji', label: '이모지' },
  { value: 'pack', label: '그림' },
  { value: 'book', label: '책·카드' },
];

/** 카드 미리보기 한 변 — 시트 격자에서 두 장씩 놓인다. */
const CARD_PREVIEW = 132;
/** 책 표지 미리보기 폭 — 카드와 같은 높이가 되게. */
const BOOK_PREVIEW = CARD_PREVIEW / BOOK_STICKER_RATIO;

/**
 * 스티커로 붙일 책 — 모임 노트는 그 모임의 책을, 책을 고르지 않은 모임이면 클럽이 지금 읽는 책을 넘긴다.
 * label 은 어느 쪽 책인지 알려 주는 머리말이다.
 */
export type StickerBook =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'none' }
  | { state: 'ready'; book: BookSummary; label: string };

/**
 * 스티커 고르기 — Bookey 이모티콘(채팅과 같은 묶음) / 이모지 24종 / 그림 팩 12종 /
 * 책·카드(모임의 책 표지 + 내 함께 독서 기록 카드: 모든 클럽, 최근 50장).
 * 한 번 누르면 바로 붙이고 닫힌다. 카드 목록은 책·카드 탭을 열 때만 받는다.
 */
export function StickerSheet({ visible, book, onPick, onPickBook, onPickCard, onClose }: {
  visible: boolean;
  book: StickerBook;
  onPick: (kind: 'emoji' | 'pack' | 'bookey', value: string) => void;
  onPickBook: (book: BookSummary) => void;
  onPickCard: (card: ActivityCard) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('bookey');
  const [packId, setPackId] = useState(BOOKEY_STICKER_PACKS[0].id);
  const pack = BOOKEY_STICKER_PACKS.find((p) => p.id === packId) ?? BOOKEY_STICKER_PACKS[0];
  const cards = useQuery({
    queryKey: ['activityCards', 'mine'],
    queryFn: clubCommunityApi.myActivityCards,
    enabled: visible && tab === 'book',
  });

  let body: ReactNode;
  switch (tab) {
    case 'bookey':
      body = pack.stickers.map((s) => (
        <Pressable
          key={s.code}
          onPress={() => onPick('bookey', s.code)}
          accessibilityRole="button"
          accessibilityLabel={`스티커 ${s.label}`}
          style={({ pressed }) => [styles.bookeyCell, { borderColor: colors.line }, pressed ? pressedStyle : null]}
        >
          <Image source={s.source} style={styles.bookeyThumb} resizeMode="contain" />
        </Pressable>
      ));
      break;
    case 'emoji':
      body = EMOJI_STICKERS.map((e) => (
        <Pressable
          key={e}
          onPress={() => onPick('emoji', e)}
          accessibilityRole="button"
          accessibilityLabel={`스티커 ${e}`}
          style={({ pressed }) => [styles.emojiCell, pressed ? pressedStyle : null]}
        >
          <Text style={styles.emoji}>{e}</Text>
        </Pressable>
      ));
      break;
    case 'pack':
      body = STICKER_PACK.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => onPick('pack', s.key)}
          accessibilityRole="button"
          accessibilityLabel={`스티커 ${s.label}`}
          style={({ pressed }) => [styles.packCell, { borderColor: colors.line }, pressed ? pressedStyle : null]}
        >
          {s.render(44, colors)}
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>{s.label}</Text>
        </Pressable>
      ));
      break;
    case 'book':
      body = (
        <>
          <Section title={book.state === 'ready' ? book.label : '이 모임의 책'}>
            <BookPick book={book} onPick={onPickBook} />
          </Section>
          <Section title="내 기록 카드">
            <CardPicks cards={cards} onPick={onPickCard} />
          </Section>
        </>
      );
      break;
  }

  return (
    <NoteSheet visible={visible} title="스티커" onClose={onClose}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'bookey' ? <BookeyPackTabs value={pack.id} onChange={setPackId} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={tab === 'book' ? styles.sections : styles.grid}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    </NoteSheet>
  );
}

/** 책·카드 탭의 묶음 하나 — 머리말 바로 밑에 붙는 격자. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{title}</Text>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

/** 책 표지 — 로딩 / 오류(다시 시도) / 고른 책 없음 / 표지 한 장. */
function BookPick({ book, onPick }: { book: StickerBook; onPick: (book: BookSummary) => void }) {
  const { colors } = useTheme();
  switch (book.state) {
    case 'loading':
      return <Loading />;
    case 'error':
      return (
        <View style={styles.cardNote}>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>책을 불러오지 못했어요.</Text>
          <Button label={linkLabel('다시 시도', 'action')} size="sm" variant="outline" onPress={book.retry} />
        </View>
      );
    case 'none':
      return (
        <Text style={[typeScale.caption, styles.cardNote, { color: colors.textMuted }]}>
          아직 고른 책이 없어요. 모임에 책을 고르면 표지를 스티커로 붙일 수 있어요.
        </Text>
      );
    case 'ready': {
      const { title, author, coverUrl } = book.book;
      return (
        <Pressable
          onPress={() => onPick(book.book)}
          accessibilityRole="button"
          accessibilityLabel={`${title} 표지 붙이기`}
          style={({ pressed }) => (pressed ? pressedStyle : null)}
        >
          <BookStickerFace book={{ title, author, coverUrl }} size={BOOK_PREVIEW} />
        </Pressable>
      );
    }
  }
}

/** 기록 카드 — 로딩 / 오류(다시 시도) / 빈 상태 / 카드 면 격자. */
function CardPicks({ cards, onPick }: {
  cards: { data?: ActivityCard[]; isLoading: boolean; isError: boolean; refetch: () => unknown };
  onPick: (card: ActivityCard) => void;
}) {
  const { colors } = useTheme();
  if (cards.isLoading) return <Loading />;
  if (cards.isError) {
    return (
      <View style={styles.cardNote}>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>기록 카드를 불러오지 못했어요.</Text>
        <Button label={linkLabel('다시 시도', 'action')} size="sm" variant="outline" onPress={() => cards.refetch()} />
      </View>
    );
  }
  const list = cards.data ?? [];
  if (list.length === 0) {
    return (
      <Text style={[typeScale.caption, styles.cardNote, { color: colors.textMuted }]}>
        아직 기록 카드가 없어요. 클럽 모임에서 같이 읽기를 끝내면 카드가 생겨요.
      </Text>
    );
  }
  return (
    <>
      {list.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onPick(c)}
          accessibilityRole="button"
          accessibilityLabel={`${c.clubName ?? '클럽'} 같이 읽기 ${formatClock(c.durationSec)} 카드 붙이기`}
          style={({ pressed }) => (pressed ? pressedStyle : null)}
        >
          <ActivityCardFace card={snapshotOf(c)} size={CARD_PREVIEW} />
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cardNote: { width: '100%', paddingVertical: spacing.md, alignItems: 'flex-start', gap: spacing.xs },
  scroll: { maxHeight: 320 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // 머리말↔격자는 붙이고(xs), 묶음 사이는 띄운다(lg).
  sections: { gap: spacing.lg },
  section: { gap: spacing.xs },
  // 채팅 이모티콘 칸과 같은 크기.
  bookeyCell: {
    width: 72,
    height: 72,
    borderWidth: hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookeyThumb: { width: 66, height: 66 },
  emojiCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  emoji: { fontSize: 28, lineHeight: 36 },
  packCell: {
    width: 76,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
});
