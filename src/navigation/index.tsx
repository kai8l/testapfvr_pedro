import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Splash, Login, Register, RecoverEmail, RecoverCode, RecoverPhone, RecoverPhoneCode } from '../screens/auth';
import { Tasks, TaskForm } from '../screens/tasks';
import { Agenda, CalendarScreen, ReminderForm } from '../screens/agenda';
import { Finance, ExpenseForm } from '../screens/finance';
import { Goals, GoalForm } from '../screens/goals';
import { Focus } from '../screens/focus';
import { Menu, Achievements, Stats, Tips, HowTo, FAQ, Legal, Thanks } from '../screens/menu';
import { Settings, Profile, AccountData, ChangeEmail, ChangePassword, Preferences, Accessibility, Notifications, ReportProblem, Premium, Payment, VerifyPhone } from '../screens/account';

const Stack = createNativeStackNavigator();

export default function Navigation() {
  const { session, loading, recovering } = useAuth();
  if (loading) return <Splash />;
  const logged = session && !recovering;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {logged ? (
          <>
            <Stack.Screen name="Menu" component={Menu} />
            <Stack.Screen name="Tasks" component={Tasks} />
            <Stack.Screen name="TaskForm" component={TaskForm} />
            <Stack.Screen name="Agenda" component={Agenda} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="ReminderForm" component={ReminderForm} />
            <Stack.Screen name="Finance" component={Finance} />
            <Stack.Screen name="ExpenseForm" component={ExpenseForm} />
            <Stack.Screen name="Goals" component={Goals} />
            <Stack.Screen name="GoalForm" component={GoalForm} />
            <Stack.Screen name="Achievements" component={Achievements} />
            <Stack.Screen name="Stats" component={Stats} />
            <Stack.Screen name="Tips" component={Tips} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="AccountData" component={AccountData} />
            <Stack.Screen name="ChangeEmail" component={ChangeEmail} />
            <Stack.Screen name="ChangePassword" component={ChangePassword} />
            <Stack.Screen name="Preferences" component={Preferences} />
            <Stack.Screen name="Accessibility" component={Accessibility} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="ReportProblem" component={ReportProblem} />
            <Stack.Screen name="HowTo" component={HowTo} />
            <Stack.Screen name="FAQ" component={FAQ} />
            <Stack.Screen name="Premium" component={Premium} />
            <Stack.Screen name="Payment" component={Payment} />
            <Stack.Screen name="VerifyPhone" component={VerifyPhone} />
            <Stack.Screen name="Focus" component={Focus} />
            <Stack.Screen name="Thanks" component={Thanks} />
            <Stack.Screen name="Legal" component={Legal} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="RecoverEmail" component={RecoverEmail} />
            <Stack.Screen name="RecoverCode" component={RecoverCode} />
            <Stack.Screen name="RecoverPhone" component={RecoverPhone} />
            <Stack.Screen name="RecoverPhoneCode" component={RecoverPhoneCode} />
            <Stack.Screen name="Legal" component={Legal} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
