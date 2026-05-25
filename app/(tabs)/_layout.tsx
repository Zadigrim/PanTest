import { Tabs } from 'expo-router'
import { Compass, Library, User, Tag } from 'lucide-react-native'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'

// Land on My Passports after login (splash → login → my passports).
export const unstable_settings = { initialRouteName: 'my-passports' }

export default function TabsLayout() {
  const { isEmployee, employeeMode } = useEmployeeContext()
  const showField = isEmployee && employeeMode

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: palette.navy, borderTopColor: '#1a2d44' },
        headerStyle: { backgroundColor: palette.navy },
        headerTintColor: palette.cream,
        headerTitleStyle: { fontWeight: '600', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="my-passports"
        options={{
          title: 'My Passports',
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="field"
        options={{
          title: 'Field',
          href: showField ? undefined : null,
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
