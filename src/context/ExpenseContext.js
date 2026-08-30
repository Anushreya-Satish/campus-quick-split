import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simplifyDebts } from '../utils/debtMinimizer';

export const THEMES = {
  light: {
    bg: '#E8F1F2',
    card: '#FFFFFF',
    text: '#1F2937',
    subText: '#6B7280',
    primary: '#005F73',
    secondary: '#0A9396',
    border: '#E5E7EB',
    chipBg: '#E0F2FE',
    inputBg: '#E9ECEF',
    positive: '#0F9D58',
    negative: '#D64545',
  },
  dark: {
    bg: '#0E1A1C',
    card: '#152528',
    text: '#EAF4F4',
    subText: '#8FA6A8',
    primary: '#4FD1C5',
    secondary: '#2FA3A0',
    border: '#243B3E',
    chipBg: '#1C2E31',
    inputBg: '#132022',
    positive: '#4ADE80',
    negative: '#F87171',
  },
};

const STORAGE_KEYS = {
  user: 'qs_user',
  theme: 'qs_theme',
  members: 'qs_members',
  expenses: 'qs_expenses',
};

const ExpenseContext = createContext();

export const ExpenseProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [themeKey, setThemeKey] = useState('light');
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [userStr, themeStr, membersStr, expensesStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.theme),
        AsyncStorage.getItem(STORAGE_KEYS.members),
        AsyncStorage.getItem(STORAGE_KEYS.expenses),
      ]);

      if (userStr) setCurrentUser(userStr);
      if (themeStr && THEMES[themeStr]) setThemeKey(themeStr);
      if (membersStr) setMembers(JSON.parse(membersStr));
      if (expensesStr) setExpenses(JSON.parse(expensesStr));
    } catch (e) {
      console.error('Failed to load local data', e);
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCurrentUser(trimmed);
    await AsyncStorage.setItem(STORAGE_KEYS.user, trimmed);
    if (!members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      addMember(trimmed);
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.user);
  };

  const changeTheme = async (key) => {
    if (!THEMES[key]) return;
    setThemeKey(key);
    await AsyncStorage.setItem(STORAGE_KEYS.theme, key);
  };

  const persistMembers = async (updated) => {
    setMembers(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.members, JSON.stringify(updated));
  };

  const persistExpenses = async (updated) => {
    setExpenses(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(updated));
  };

  const addMember = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate Member', `${trimmed} is already in the squad.`);
      return;
    }
    persistMembers([...members, { id: Date.now().toString(), name: trimmed }]);
  };

  const deleteMember = (id) => {
    if (members.length <= 1) {
      Alert.alert('Action Denied', 'Group must have at least 1 member.');
      return;
    }
    persistMembers(members.filter((m) => m.id !== id));
  };

  const addExpense = (expense) => {
    persistExpenses([expense, ...expenses]);
  };

  const deleteExpense = (id) => {
    persistExpenses(expenses.filter((e) => e.id !== id));
  };

  const getNetBalances = () => {
    const balances = {};
    members.forEach((m) => (balances[m.name] = 0));

    expenses.forEach((exp) => {
      Object.entries(exp.payers || {}).forEach(([payer, amt]) => {
        if (balances[payer] !== undefined) balances[payer] += parseFloat(amt || 0);
      });
      Object.entries(exp.shares || {}).forEach(([person, share]) => {
        if (balances[person] !== undefined) balances[person] -= parseFloat(share || 0);
      });
    });

    return balances;
  };

  const getOptimizedSettlements = () => simplifyDebts(getNetBalances());

  return (
    <ExpenseContext.Provider
      value={{
        currentUser,
        loginUser,
        logout,
        theme: THEMES[themeKey] || THEMES.light,
        themeKey,
        changeTheme,
        members,
        addMember,
        deleteMember,
        expenses,
        addExpense,
        deleteExpense,
        getNetBalances,
        getOptimizedSettlements,
        loading,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => useContext(ExpenseContext);