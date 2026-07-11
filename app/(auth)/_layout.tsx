import { Stack } from 'expo-router'

// Nested navigator for the auth group (login / register). Without this file
// Expo Router flattens login.tsx and register.tsx into the ROOT stack as
// "(auth)/login" / "(auth)/register" — so the root layout's
// <Stack.Screen name="(auth)" options={{ headerShown: false }} /> matches
// nothing (hence the "No route named (auth) exists" warning), and each screen
// falls through to the default stack header showing its route path
// ("(auth)/login"). Declaring the group's own Stack here makes "(auth)" a real
// route and hides the header for every screen inside it.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
