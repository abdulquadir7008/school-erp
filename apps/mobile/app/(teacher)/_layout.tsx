import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useAuthStore } from "../../src/store/auth";

const ACTIVE = "#0D9488";
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
      style={{ width: 46, height: 30, backgroundColor: focused ? "#CCFBF1" : "transparent" }}
    >
      <Ionicons name={name} color={color} size={22} />
    </View>
  );
}

export default function TeacherTabs() {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (role !== "TEACHER") return <Redirect href="/" />;

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
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "people" : "people-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "checkmark-circle" : "checkmark-circle-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          title: "Homework",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "create" : "create-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "person" : "person-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="students" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="timetable" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="exams" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
