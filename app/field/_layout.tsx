import { Stack } from 'expo-router'

export default function FieldLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0D1B2A' },
        headerTintColor: '#F5F0E8',
        headerTitleStyle: { fontFamily: 'serif', letterSpacing: 0.5 },
        headerBackTitle: 'Field',
        contentStyle: { backgroundColor: '#0D1B2A' },
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
