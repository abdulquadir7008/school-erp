import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useAuthStore } from "../../src/store/auth";

const ACTIVE = "#4F46E5";
const INACTIVE = "#9AA3B2";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: any;
  focused: boolean;
}) {
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{
        width: 46,
        height: 30,
        backgroundColor: focused ? "#EEF2FF" : "transparent",
      }}
    >
      <Ionicons name={name} color={color} size={22} />
    </View>
  );
}

export default function StudentTabs() {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (role !== "STUDENT") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 14,
          borderTopWidth: 1,
          borderTopColor: "#EDEEF4",
          backgroundColor: "#FFFFFF",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="academics"
        options={{
          title: "Learn",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "book" : "book-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "trophy" : "trophy-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "person" : "person-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="fees" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="library" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="transport" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="homework" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="exams" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
