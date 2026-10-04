import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey } from '@/api/postCache';
import type { Post, PostVisibility } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import type { PickedBook } from '@/components/book/BookPicker';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { PhotoStrip } from '@/components/post/PhotoStrip';
import { PostBody } from '@/components/post/PostBody';
import type { PhotoSource } from '@/components/post/PostPhoto';
import {
  POST_TITLE_MAX, defaultVisibility, visibilityCaption, visibilityOptions,
} from '@/components/post/postFormat';
import {
  finalizePhotoLines, photoMarker, placeLoosePhotos, removePhotoLines, type PhotoRef,
} from '@/components/post/postPhotos';
import { insertBlock, pageSource, postBodyOf, quoteBlock } from '@/components/post/postQuotes';
import { useQuoteDraft } from '@/components/post/QuoteDraftFields';
import { QuoteInsertSheet } from '@/components/post/QuoteInsertSheet';
import { POST_IMAGE_MAX, usePhotoUploads } from '@/components/post/usePhotoUploads';
import { Button, Card, EmptyState, Eyebrow, Field, Segmented, linkLabel } from '@/components/ui';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 제목 길이 상한 — 서버 계약과 같은 값. */
const TITLE_MAX = POST_TITLE_MAX;
/** 하단 띠의 대략 높이(46px 제출 버튼 + 위아래 여백) — 본문 아래 여백을 이만큼 더 준다. */
const BOTTOM_BAR_HEIGHT = 70;

/**
 * 독후감 쓰기·고치기 — 광장 `+ 독후감`(빈 글), 책 상세(`bookId`, 그 책이 골라진 글),
 * 상세 `고치기`(`id`)에서 들어온다.
 *
 * 폼 상태는 안쪽 PostForm 이 마운트될 때 한 번에 시드한다 — 그래서 이 바깥 화면은 고칠 글·책을 먼저 받아
 * 오고 나서야 폼을 세운다(useBookPicker 의 initial 도 마운트 때 한 번만 읽힌다). 로딩·404·남의 글은 여기서 거른다.
 */
export default function PostEditorScreen() {
  const { id, bookId, clubId } = useLocalSearchParams<{
    id?: string; bookId?: string; clubId?: string;
  }>();
  const { colors } = useTheme();
  const postId = id ? Number(id) : NaN;
  const editing = Number.isFinite(postId);
  const bookParam = bookId ? Number(bookId) : NaN;
  const fromBook = !editing && Number.isFinite(bookParam);
  const category = editing ? '독후감 고치기' : '독후감 쓰기';
  const clubParam = clubId ? Number(clubId) : NaN;

  // 꺼진 쿼리에도 키는 있어야 한다 — NaN 을 키에 넣으면 서로 다른 화면이 한 자리를 나눠 쓰게 되므로 자리 키를 둔다.
  const post = useQuery({
    queryKey: editing ? postKey(postId) : ['post', 'pending'],
    queryFn: () => postApi.get(postId),
    enabled: editing,
  });
  // 책 상세와 같은 키 — 거기서 받아 둔 책이면 다시 부르지 않는다.
  const book = useQuery({
    queryKey: fromBook ? ['book', bookParam] : ['book', 'pending'],
    queryFn: () => bookApi.detail(bookParam),
    enabled: fromBook,
  });

  if ((editing && post.isLoading) || (fromBook && book.isLoading)) {
    return (
      <Shell category={category}>
        <View style={styles.skeleton}>
          <View style={[styles.skeletonBlock, { backgroundColor: colors.surface }]} />
        </View>
      </Shell>
    );
  }
  // 쿼리 객체 너머로는 좁혀지지 않아 한 번 꺼내 둔다 — 아래 분기가 전부 이 값으로 판단한다.
  const loaded = post.data;
  if (editing && !loaded) {
    // 지워졌거나 남의 글인 것(404·403)과 그냥 못 받은 것은 다른 이야기다 — 뒤엣것에는 다시 시도를 준다.
    const gone = post.error instanceof ApiError && (post.error.status === 404 || post.error.status === 403);
    return (
      <Shell category={category}>
        {gone ? (
          <EmptyState title="독후감을 불러오지 못했어요" description="지워졌거나 볼 수 없는 글이에요." />
        ) : (
          <EmptyState
            title="독후감을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={(
              <Pressable
                onPress={() => post.refetch()}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                style={styles.retry}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
              </Pressable>
            )}
          />
        )}
      </Shell>
    );
  }
  if (loaded && !loaded.mine) {
    return (
      <Shell category={category}>
        <EmptyState title="고칠 수 없는 글입니다" description="내가 쓴 글만 고칠 수 있어요." />
      </Shell>
    );
  }

  // 수정: 글의 책(없으면 '책 없음') · 책 상세에서: 그 책 · 그 밖: 기본값(읽는 중인 첫 책). 책 상세를 못 받았으면 기본값으로 간다.
  const initialBook: PickedBook | null | undefined = loaded
    ? loaded.bookId != null
      ? { bookId: loaded.bookId, title: loaded.bookTitle ?? '', coverUrl: loaded.bookCoverUrl }
      : null
    : fromBook && book.data
      ? {
          bookId: book.data.book.id,
          title: book.data.book.title,
          coverUrl: book.data.book.coverUrl,
          recordId: book.data.myRecordId,
        }
      : undefined;

  // 클럽 글인지 — 고치기는 글의 클럽(바꿀 수 없다), 새 글은 파라미터.
  const formClubId = loaded ? loaded.clubId : Number.isFinite(clubParam) ? clubParam : undefined;

  return (
    <PostForm key={editing ? `edit-${postId}` : 'new'} post={loaded} initialBook={initialBook} clubId={formClubId} />
  );
}

/** 폼 앞뒤의 셸 — 로딩·빈 상태도 같은 헤더 아래 놓인다. */
function Shell({ category, children }: { category: string; children: ReactNode }) {
  return (
    <PaperScreen>
      <SubHeader category={category} />
      {children}
    </PaperScreen>
  );
}

/**
 * 폼 본체 — `post` 가 있으면 고치기. 시드는 마운트 때 한 번(부모가 key 로 다시 세운다).
 * clubId 가 있으면 클럽 독후감 — 공개 범위가 클럽만·광장에도 둘이 되고, 새 글은 clubId 를 싣는다.
 */
function PostForm({ post, initialBook, clubId }: { post?: Post; initialBook?: PickedBook | null; clubId?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const editing = post != null;

  const picker = useBookPicker({ initial: initialBook });
  const book = picker.selected;
  // 수정 중인 글에 책이 있으면 바꿀 수만 있고 없앨 수 없다(서버 규칙) — '책 빼기'를 두지 않는다.
  const bookLocked = editing && post.bookId != null;

  const [title, setTitle] = useState(post?.title ?? '');
  // 옛 글은 밑줄 표시와 표시 없이 엮여만 있던 밑줄을 문장 조각 글로 바꿔 시작한다 — 초안을 만들 때 한 번만(마운트 시드).
  // 저장하면 밑줄 연결은 풀리고(quoteIds 빈 목록) 문장은 본문의 글로 남는다.
  // 사진을 따로 붙이던 옛 글은 그 사진을 글 맨 앞의 사진 줄로 넣어 시작한다 — 상세가 본문 앞에 그리던 자리와 같다.
  const [seed] = useState(() => {
    const quotes = post ? postBodyOf(post) : { text: '', moved: 0 };
    const photos = post ? placeLoosePhotos(quotes.text, post.images) : { text: quotes.text, placed: 0 };
    return { text: photos.text, moved: quotes.moved, placedPhotos: photos.placed };
  });
  const [bodyMd, setBodyMd] = useState(seed.text);
  const [mode, setMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const inClub = clubId != null;
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? defaultVisibility(inClub));
  const [quoting, setQuoting] = useState(false);
  // 문장 넣기 초안 — 시트 밖에 둬서, 바탕을 잘못 눌러 시트가 닫혀도 다시 열면 쓰던 문장이 그대로 있다.
  const quoteDraft = useQuoteDraft();
  // 문장을 넣을 자리 — 본문 칸에서 마지막으로 커서가 있던 곳. 기본은 글 끝이다.
  const [caret, setCaret] = useState<number | null>(null);
  // 문장을 넣은 직후 한 번만 실제 캐럿을 옮기려고 잡아 두는 자리. 평소에는 null(비제어)이다.
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const uploads = usePhotoUploads(post?.images ?? [], POST_IMAGE_MAX);

  // 사진 고르기는 비동기다 — 창이 닫힌 뒤에도 최신 본문·커서에 넣도록 ref 로 본다.
  const latest = useRef({ bodyMd, caret });
  latest.current = { bodyMd, caret };

  // 커서 자리에 묶음(문장 조각·사진 줄)을 넣는다. 본문을 갈아 끼우면 실제 캐럿은 글 끝으로 튄다 —
  // 넣은 묶음 다음 자리로 되돌려 이어 쓰기와 다음에 넣을 자리를 화면과 맞춘다.
  const insertAtCaret = (block: string) => {
    const { bodyMd: current, caret: at } = latest.current;
    const { text, cursor } = insertBlock(current, at ?? current.length, block);
    setBodyMd(text);
    setCaret(cursor);
    setPendingSelection({ start: cursor, end: cursor });
  };

  // 시트에서 옮겨 적은 문장을 커서 자리에 조각 글(`>` 묶음)로 넣는다 — 그다음부터는 본문의 글이라 고치기·빼기도 본문에서 한다.
  const insertQuote = () => {
    insertAtCaret(quoteBlock(quoteDraft.body, pageSource(quoteDraft.pageValue)));
    quoteDraft.setContent('');
    quoteDraft.setPageText('');
    // 닫기는 여기서 한다 — 열림 상태를 이 화면이 쥐고 있고, 넣기와 닫기가 한 흐름이라 한자리에서 끝낸다.
    setQuoting(false);
  };

  // 사진을 골라 커서 자리에 사진 줄로 넣는다 — 상세에서도 그 자리에 선다. 올라가기를 기다리지 않고 자리부터 잡는다.
  const insertPhotos = async () => {
    const keys = await uploads.pick();
    if (keys.length === 0) return;
    insertAtCaret(keys.map((key) => photoMarker({ kind: 'upload', key })).join('\n\n'));
  };

  // 사진을 떼면 본문의 그 사진 줄도 함께 걷는다 — 올라가는 중(`upload:`)이든 이미 붙어 있던 사진(`image:`)이든.
  const removePhoto = (key: string) => {
    const id = uploads.photos.find((photo) => photo.key === key)?.image?.id;
    uploads.remove(key);
    setBodyMd((md) => removePhotoLines(md, (ref) => (ref.kind === 'upload' ? ref.key === key : ref.id === id)));
  };

  // 미리보기의 사진 줄 → 타일. 올라가는 중이면 고른 파일을, 올라갔으면 서버 사진을 그린다.
  const photoOf = (ref: PhotoRef): PhotoSource | null => {
    const photo = uploads.photos.find((p) => (ref.kind === 'upload' ? p.key === ref.key : p.image?.id === ref.id));
    const uri = photo?.image?.url ?? photo?.localUri;
    if (!photo || !uri) return null;
    return { uri, width: photo.image?.width ?? photo.width, height: photo.image?.height ?? photo.height };
  };
  // 고르기 창이 떠 있거나, 서버가 사진을 못 받거나, 장수가 찼으면 '+ 사진'을 잠근다.
  const photoLocked = uploads.picking || !uploads.retryable || uploads.photos.length >= POST_IMAGE_MAX;

  // 올라가는 중인 사진만 붙잡는다 — 실패한 타일까지 막으면 저장소가 꺼진 동안 글을 아예 못 올린다.
  // 실패한 사진은 imageIds 에 안 들어가므로 그대로 올리면 사진 없이 실린다.
  const canSubmit = title.trim().length > 0 && bodyMd.trim().length > 0 && !uploads.busy;

  const submit = useMutation({
    mutationFn: () => {
      // 공개 범위는 늘 명시한다 — 서버 기본값에 기대지 않는다.
      // 밑줄은 엮지 않는다 — 문장은 본문의 글이다. 고치기에서도 빈 목록을 보내 옛 글의 밑줄 연결을 푼다.
      // 사진 줄은 서버 사진 id 로 굳히고, 사진은 본문에 나온 차례대로 붙인다(첫 사진이 카드 포스터가 된다).
      const photos = finalizePhotoLines(bodyMd, uploads.photos);
      const base = {
        bookId: book?.bookId,
        title: title.trim(),
        bodyMd: photos.bodyMd,
        visibility,
        tags: [],
        imageIds: photos.imageIds,
        quoteIds: [],
      };
      return editing
        ? postApi.update(post.id, base)
        : postApi.create({ ...base, readingRecordId: book?.recordId, clubId });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(postKey(saved.id), saved);
      invalidatePostLists(queryClient);
      if (!editing) {
        router.replace(`/post/${saved.id}`);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/post/${post.id}`);
      }
    },
  });
  const errorMessage = submit.isError && !submit.isPending
    ? submit.error instanceof ApiError ? submit.error.message : '올리지 못했어요 · 다시 시도'
    : null;

  const visibilityChoices = visibilityOptions(inClub, post?.visibility);

  const submitLabel = editing ? '저장' : '올리기';

  return (
    <PaperScreen>
      <SubHeader category={editing ? '독후감 고치기' : '독후감 쓰기'} />

      <KeyboardArea>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          {/* ① 책 — 없어도 된다. */}
          <View style={styles.section}>
            <Eyebrow>책</Eyebrow>
            <BookPicker picker={picker} />
            {book == null ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>책 없이 써도 돼요</Text>
            ) : !bookLocked ? (
              <Pressable
                onPress={() => picker.pick(null)}
                accessibilityRole="button"
                accessibilityLabel="책 빼기"
                style={({ pressed }) => [styles.unpick, pressed ? pressedStyle : null]}
              >
                <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>책 빼기</Text>
              </Pressable>
            ) : null}
          </View>

          {/* ② 제목 */}
          <Field
            label="제목"
            value={title}
            onChangeText={setTitle}
            placeholder="한 줄로 남기는 제목"
            maxLength={TITLE_MAX}
            accessibilityLabel="제목"
          />

          {/* ③ 본문 — 쓰기 / 미리보기 */}
          <View style={styles.section}>
            <Eyebrow>본문</Eyebrow>
            <Segmented
              options={[{ value: 'WRITE', label: '쓰기' }, { value: 'PREVIEW', label: '미리보기' }]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'WRITE' ? (
              <>
                {/*
                  selection 은 문장을 넣은 직후에만 준다 — 늘 물고 있으면 한글 조합(IME)이
                  글자마다 확정돼 끊기고, 되돌리기 자리도 어긋난다. 캐럿이 한 번 옮겨 가면
                  (onSelectionChange) 곧바로 놓아 비제어로 돌아간다. 사용자가 바로 타이핑해
                  그 알림이 오지 않는 경우를 대비해 onChangeText 에서도 놓아 준다.
                */}
                <TextInput
                  value={bodyMd}
                  selection={pendingSelection ?? undefined}
                  onChangeText={(text) => {
                    setBodyMd(text);
                    setPendingSelection(null);
                  }}
                  onSelectionChange={(e) => {
                    setCaret(e.nativeEvent.selection.start);
                    setPendingSelection(null);
                  }}
                  multiline
                  placeholder="이 책을 읽고 남은 생각을 적어 보세요. 마크다운을 쓸 수 있어요."
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="본문"
                  style={[styles.bodyInput, {
                    backgroundColor: colors.surface, borderColor: colors.line, color: colors.text,
                  }]}
                />
                {/* 옛 글을 열었을 때만 — 아래에 모아 두던 밑줄을 본문 끝으로 옮겼다고 알린다. */}
                {seed.moved > 0 ? (
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                    아래 모아 두었던 문장 {seed.moved}개를 본문 끝으로 옮겼어요 · 원하는 자리로 옮겨 보세요
                  </Text>
                ) : null}
                {/* 사진을 따로 붙이던 옛 글을 열었을 때만 — 그 사진을 사진 줄로 글 맨 앞에 넣었다고 알린다. */}
                {seed.placedPhotos > 0 ? (
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                    사진 {seed.placedPhotos}장을 본문 맨 앞에 넣었어요 · 원하는 자리로 옮겨 보세요
                  </Text>
                ) : null}
                {/* 문장 조각은 `>` 묶음이다 — 아래 '+ 문장'으로 넣거나 직접 써도 같다. */}
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  **굵게** · _기울임_ · # 제목 · - 목록 · {'>'} 문장
                </Text>
              </>
            ) : (
              <Card>
                {bodyMd.trim() ? (
                  <PostBody md={bodyMd} photoOf={photoOf} />
                ) : (
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>미리볼 내용이 없어요</Text>
                )}
              </Card>
            )}
          </View>

          {/* ④ 사진 — 넣기는 하단 띠의 '+ 사진'(커서 자리)이 맡는다. 여기는 붙은 사진의 올라가는 상태·다시·떼기를
              보는 자리라, 붙은 사진도 알릴 것도 없으면 숨긴다. 떼면 본문의 사진 줄도 함께 빠진다. */}
          {uploads.photos.length > 0 || uploads.notice ? (
            <View style={styles.section}>
              <Eyebrow>사진 {uploads.photos.length}/{POST_IMAGE_MAX}</Eyebrow>
              <PhotoStrip
                photos={uploads.photos}
                onRetry={uploads.retry}
                onRemove={removePhoto}
                max={POST_IMAGE_MAX}
                retryable={uploads.retryable}
                notice={uploads.notice}
              />
            </View>
          ) : null}

          {/* ⑤ 공개 범위 */}
          <View style={styles.section}>
            <Eyebrow>공개 범위</Eyebrow>
            <Segmented options={visibilityChoices} value={visibility} onChange={setVisibility} />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>{visibilityCaption(visibility, inClub)}</Text>
          </View>
        </ScrollView>

        {/*
          하단 띠 — 댓글 입력 바와 같은 자리(ScrollView 의 형제)라 키보드가 뜨면 그 위에 붙고,
          글이 길어져도 늘 손에 닿는다. 제출은 엄지가 닿는 여기 오른쪽에 둔다(UX 철칙 Fitts).
          '+ 문장'·'+ 사진'은 커서 자리에 문장 조각·사진을 끼워 넣는다 — 미리보기에는 넣을 커서가 없으니 쓰기일 때만 그린다.
          실패 안내도 제출 버튼 바로 위에 붙인다(UX 철칙 Proximity).
        */}
        <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          {errorMessage ? (
            <Text style={[typeScale.caption, { color: colors.danger }]}>{errorMessage}</Text>
          ) : null}
          <View style={styles.bottomRow}>
            {mode === 'WRITE' ? (
              <View style={styles.tools}>
                <Pressable
                  onPress={() => setQuoting(true)}
                  accessibilityRole="button"
                  accessibilityLabel="문장 넣기"
                  style={({ pressed }) => [styles.tool, pressed ? pressedStyle : null]}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.text }]}>+ 문장</Text>
                </Pressable>
                <Pressable
                  onPress={insertPhotos}
                  disabled={photoLocked}
                  accessibilityRole="button"
                  accessibilityLabel="사진 넣기"
                  accessibilityState={{ disabled: photoLocked }}
                  style={({ pressed }) => [styles.tool, pressed ? pressedStyle : null]}
                >
                  <Text style={[typeScale.monoLabel, { color: photoLocked ? colors.textFaint : colors.text }]}>+ 사진</Text>
                </Pressable>
              </View>
            ) : null}
            <Button
              label={submitLabel}
              onPress={() => submit.mutate()}
              disabled={!canSubmit}
              loading={submit.isPending}
              style={styles.submit}
            />
          </View>
        </KeyboardDock>
      </KeyboardArea>

      {quoting ? <QuoteInsertSheet draft={quoteDraft} onInsert={insertQuote} onClose={() => setQuoting(false)} /> : null}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // 아래 여백은 띠 높이만큼 더 둔다 — 키보드가 올라와 보이는 자리가 줄어도 마지막 칸을 띠 위로 밀어 올릴 수 있게.
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + BOTTOM_BAR_HEIGHT },
  section: { gap: spacing.md },
  // 하단 고정 띠 — 댓글 입력 바와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  // 화면의 유일한 악센트 — 띠 오른쪽 끝에 붙인다.
  submit: { marginLeft: 'auto' },
  // 본문 칸 — 바탕·테두리·모서리는 바로 위 제목 칸(Field)과 같다. 활자는 문장 넣기 시트의 문장 칸과 같은
  // quote 토큰 15/25, 길게 쓰는 글이라 높이만 키운다.
  bodyInput: {
    minHeight: 220,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typeScale.quote,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  // 모노 한 줄 — 44pt 상자로 키우고 같은 만큼 음수 마진으로 리듬은 그대로 둔다.
  unpick: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginVertical: -spacing.sm },
  // 커서 자리에 넣는 도구 둘 — 터치 상자(좌우로 sm 씩 넓힌다)끼리 sm 이상 떨어지게 xl 간격.
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  // 11px 모노 라벨이라 글자 상자만으로는 손가락이 닿지 않는다 — 웹은 hitSlop 을 무시하므로 여백으로 44pt 상자를 만든다.
  tool: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 44pt 상자를 만든다.
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  skeleton: { ...layout.content, padding: spacing.lg },
  skeletonBlock: { height: 240, borderRadius: radius.md },
});
