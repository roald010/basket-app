import { Stack } from 'expo-router';

/**
 * Nested Stack inside the single formSheet-presented "capture" route (see root
 * _layout.tsx) -- Capture and, from M3 onward, Review live here as steps of one
 * sheet that grows taller per step, per Expo Router's documented formSheet pattern.
 */
export default function CaptureLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
