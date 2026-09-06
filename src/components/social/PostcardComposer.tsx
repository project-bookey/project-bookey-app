import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi, walletApi } from '@/api/endpoints';
import { countGraphemes } from '@/lib/graphemes';
import { Button, Card, Toggle } from '@/components/ui';
import { hairline, radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 엽서 본문 최대 글자 수 — 서버 정책과 같은 값 (§14.9: 한글 완성형 글자 기준). */
const MAX_GRAPHEMES = 16;

/**
 * 엽서 컴포저 (§14.2) — 16글자로 자신을 어필하는 유일한 연결 요청.
 * 우표 동봉을 켜면 내 우표 1개를 부담해 상대가 무료로 답장할 수 있다.
 */
export function PostcardComposer({ toUserId, toNickname, postId, postTitle, onDone }: {
  toUserId: number;
  toNickname: string;
  postId?: number;
  postTitle?: string | null;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [attachStamp, setAttachStamp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const used = countGraphemes(body);
  const over = used > MAX_GRAPHEMES;

  const send = useMutation({
    mutationFn: () =>
      postcardApi.send({ toUserId, postId, body: body.trim(), attachStamp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
      setSentMessage('엽서를 보냈어요. 답장이 오면 서로 팔로우됩니다.');
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '엽서를 보내지 못했어요.'),
  });

  if (sentMessage) {
    return (
      <Card>
        <Text style={[typeScale.body, { color: colors.text }]}>{sentMessage}</Text>
        <View style={{ marginTop: spacing.md }}>
          <Button label="닫기" variant="ghost" onPress={onDone} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={[typeScale.label, { color: colors.textMuted }]}>
        {toNickname}에게 엽서 보내기
      </Text>
      {postTitle ? (
        <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
          『{postTitle}』 독후감을 보고
        </Text>
      ) : null}

      <TextInput
        style={[styles.input, {
          borderColor: over ? colors.danger : colors.lineStrong,
          backgroundColor: colors.surface,
          color: colors.text,
        }]}
        value={body}
        onChangeText={(next) => { setBody(next); setError(null); }}
        placeholder="딱 16글자로 나를 어필하세요"
        placeholderTextColor={colors.textFaint}
        multiline
        accessibilityLabel="엽서 본문"
      />
      <Text style={[typeScale.monoLabel, styles.counter, { color: over ? colors.danger : colors.textFaint }]}>
        {used} / {MAX_GRAPHEMES}
      </Text>

      <View style={[styles.stampRow, { borderTopColor: colors.line }]}>
        <Toggle
          label="우표 동봉"
          description={`내 우표 1개를 붙여 상대가 무료로 답장하게 합니다 (보유 ${wallet.data?.stampBalance ?? 0}개)`}
          value={attachStamp}
          onChange={setAttachStamp}
        />
      </View>

      {wallet.data ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          오늘 무료 엽서 {wallet.data.freePostcardsLeftToday}장 · 보유 엽서 {wallet.data.postcardBalance}장
        </Text>
      ) : null}

      {error ? (
        <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="취소" variant="ghost" onPress={onDone} />
        <Button
          label={send.isPending ? '보내는 중…' : '엽서 보내기'}
          onPress={() => send.mutate()}
          disabled={send.isPending || over || body.trim().length === 0}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.md,
    marginTop: spacing.md,
    fontFamily: sans.regular,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: spacing.xs },
  stampRow: { borderTopWidth: hairline, paddingTop: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
});
