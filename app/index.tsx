import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading } from '@/components/ui';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { useAuth } from '@/store/auth';

export default function Index() {
  const status = useAuth((s) => s.status);
  /** null = 확인 중. 비로그인일 때만 온보딩 여부를 따진다. */
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding().then(setSeen);
  }, []);

  if (status === 'authenticated') {
    return <Redirect href="/home" />;
  }
  if (seen === null) {
    return <Loading />;
  }
  return <Redirect href={seen ? '/login' : '/onboarding'} />;
}
