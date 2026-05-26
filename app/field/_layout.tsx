import { Stack } from 'expo-router'
import { palette } from '../../lib/colors'

export default function FieldLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.navy },
        headerTintColor: palette.cream,
        headerTitleStyle: { fontFamily: 'serif' },
        headerBackTitle: 'Field',
        contentStyle: { backgroundColor: palette.navy },
      }}
    >
      <Stack.Screen name="scan" options={{ title: 'Scan Visitor' }} />
      <Stack.Screen name="lookup" options={{ title: 'Visitor Lookup' }} />
      <Stack.Screen name="acknowledge" options={{ title: 'Acknowledge' }} />
      <Stack.Screen name="accolade" options={{ title: 'Give Accolade' }} />
      <Stack.Screen name="recommend" options={{ title: 'Recommend a Book' }} />
    </Stack>
  )
}
