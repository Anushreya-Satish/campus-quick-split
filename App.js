import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  SafeAreaView,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseProvider, useExpenses } from './src/context/ExpenseContext';

const CATEGORY_META = {
  Food: 'fast-food-outline',
  Cab: 'car-outline',
  Bills: 'receipt-outline',
  Other: 'grid-outline',
};

// SPLASH SCREEN
function SplashScreen({ theme, onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
      Animated.delay(650),
    ]).start(() => onFinish());
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>⚡</Text>
        <Text style={[styles.heading, { color: theme.primary, fontSize: 30, marginTop: 10 }]}>
          Campus QuickSplit
        </Text>
        <Text style={{ color: theme.subText, marginTop: 6, fontSize: 13 }}>
          Split fast. Settle faster.
        </Text>
        <ActivityIndicator style={{ marginTop: 26 }} color={theme.primary} />
      </Animated.View>
    </SafeAreaView>
  );
}

// ONBOARDING SCREEN
function OnboardingScreen() {
  const [name, setName] = useState('');
  const { loginUser, theme } = useExpenses();

  const handleStart = () => {
    if (!name.trim()) {
      Alert.alert('Hold up!', 'Please enter a name or tag to continue.');
      return;
    }
    loginUser(name);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', padding: 24 }]}>
      <Text style={{ fontSize: 48, marginBottom: 8 }}>⚡</Text>
      <Text style={[styles.heading, { color: theme.primary, fontSize: 32 }]}>Campus QuickSplit</Text>
      <Text style={[styles.subText, { color: theme.subText, marginBottom: 32 }]}>
        Frictionless, local-first expense tracking for your squad.
      </Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
        placeholder="Enter your name..."
        placeholderTextColor={theme.subText}
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary, marginTop: 12 }]} onPress={handleStart}>
        <Text style={styles.btnText}>Start Splitting 🎉</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// MAIN DASHBOARD & HAMBURGER MENU
function DashboardScreen() {
  const {
    currentUser,
    logout,
    theme,
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
  } = useExpenses();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null); 
  const [newMember, setNewMember] = useState('');
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [splitMode, setSplitMode] = useState('UNIFORM'); 
  const [payersMap, setPayersMap] = useState({});
  const [customSharesMap, setCustomSharesMap] = useState({});

  const categories = [
    { label: 'Food', icon: CATEGORY_META.Food },
    { label: 'Cab', icon: CATEGORY_META.Cab },
    { label: 'Bills', icon: CATEGORY_META.Bills },
    { label: 'Other', icon: CATEGORY_META.Other },
  ];

  const handleAddMember = () => {
    if (!newMember.trim()) return;
    addMember(newMember.trim());
    setNewMember('');
  };

  const handleSaveExpense = () => {
    // ---- INPUT SANITIZATION ----
    if (members.length === 0) {
      Alert.alert('Invalid Group', 'You need at least one member to log an expense.');
      return;
    }

    const parsedTotal = parseFloat(totalAmount);
    if (!title.trim() || !totalAmount.trim() || isNaN(parsedTotal) || parsedTotal <= 0) {
      Alert.alert('Validation Error', 'Provide a valid title and amount > 0.');
      return;
    }

    const hasNegativePayer = Object.values(payersMap).some((v) => v !== '' && parseFloat(v) < 0);
    if (hasNegativePayer) {
      Alert.alert('Validation Error', 'Paid amounts cannot be negative.');
      return;
    }

    const totalPaidSum = Object.values(payersMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    if (Math.abs(totalPaidSum - parsedTotal) > 0.01) {
      Alert.alert('Payer Allocation Error', `Upfront paid sum (₹${totalPaidSum}) must equal total (₹${parsedTotal}).`);
      return;
    }

    if (splitMode !== 'UNIFORM') {
      const hasNegativeShare = Object.values(customSharesMap).some((v) => v !== '' && parseFloat(v) < 0);
      if (hasNegativeShare) {
        Alert.alert('Validation Error', 'Shares/percentages cannot be negative.');
        return;
      }
    }

    let finalShares = {};
    if (splitMode === 'UNIFORM') {
      const count = members.length;
      const base = Math.floor((parsedTotal / count) * 100) / 100;
      let remainder = Number((parsedTotal - base * count).toFixed(2));

      members.forEach((m) => {
        let s = base;
        if (remainder > 0.001) {
          s = Number((s + 0.01).toFixed(2));
          remainder = Number((remainder - 0.01).toFixed(2));
        }
        finalShares[m.name] = s;
      });
    } else if (splitMode === 'SPECIFIC') {
      const assignedSum = Object.values(customSharesMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
      if (Math.abs(assignedSum - parsedTotal) > 0.01) {
        Alert.alert('Split Error', `Assigned shares sum (₹${assignedSum}) must equal total (₹${parsedTotal}).`);
        return;
      }
      members.forEach((m) => (finalShares[m.name] = parseFloat(customSharesMap[m.name] || 0)));
    } else if (splitMode === 'RATIO') {
      const pctSum = Object.values(customSharesMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
      if (Math.abs(pctSum - 100) > 0.01) {
        Alert.alert('Split Error', `Percentages sum (${pctSum}%) must cap at exactly 100%.`);
        return;
      }
      members.forEach((m) => {
        const pct = parseFloat(customSharesMap[m.name] || 0);
        finalShares[m.name] = Number(((parsedTotal * pct) / 100).toFixed(2));
      });
    }

    const cleanPayers = {};
    Object.entries(payersMap).forEach(([k, v]) => {
      if (parseFloat(v) > 0) cleanPayers[k] = parseFloat(v);
    });

    const newTx = {
      id: Date.now().toString(),
      title: title.trim(),
      totalAmount: parsedTotal,
      category,
      mode: splitMode,
      payers: cleanPayers,
      shares: finalShares,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: new Date().toLocaleDateString([], { day: '2-digit', month: 'short' }),
    };

    addExpense(newTx);
    setTitle('');
    setTotalAmount('');
    setPayersMap({});
    setCustomSharesMap({});
    Alert.alert('Success ✨', 'Expense logged!');
  };

  const confirmDeleteExpense = (id, expTitle) => {
    Alert.alert('Delete Expense', `Remove "${expTitle}" from the log?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
    ]);
  };

  const balances = getNetBalances();
  const settlements = getOptimizedSettlements();

  const totalSpend = expenses.reduce((acc, e) => acc + e.totalAmount, 0);
  const categorySums = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.totalAmount;
    return acc;
  }, {});

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* APP BAR WITH HAMBURGER BUTTON */}
      <View style={[styles.appBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Ionicons name="menu-outline" size={28} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.heading, { color: theme.primary, fontSize: 18 }]}>QuickSplit ⚡</Text>
          <Text style={{ color: theme.subText, fontSize: 11 }}>Logged as {currentUser}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={theme.negative} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* MEMBERS CARD */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Squad Members</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
              placeholder="Add friend..."
              placeholderTextColor={theme.subText}
              value={newMember}
              onChangeText={setNewMember}
            />
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.primary }]} onPress={handleAddMember}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {members.map((m) => (
              <View key={m.id} style={[styles.chip, { backgroundColor: theme.chipBg }]}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{m.name}</Text>
                <TouchableOpacity onPress={() => deleteMember(m.id)}>
                  <Ionicons name="close-circle" size={16} color={theme.negative} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* LOG EXPENSE CARD */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Log Expense</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.label}
                style={[
                  styles.chip,
                  { backgroundColor: category === c.label ? theme.primary : theme.chipBg, marginRight: 6 },
                ]}
                onPress={() => setCategory(c.label)}
              >
                <Ionicons name={c.icon} size={14} color={category === c.label ? '#FFF' : theme.text} />
                <Text style={{ color: category === c.label ? '#FFF' : theme.text, fontSize: 12, fontWeight: '600' }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            placeholder="Title"
            placeholderTextColor={theme.subText}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            placeholder="Total Amount (₹)"
            placeholderTextColor={theme.subText}
            keyboardType="decimal-pad"
            value={totalAmount}
            onChangeText={setTotalAmount}
          />

          <Text style={[styles.label, { color: theme.subText, marginTop: 4 }]}>WHO PAID UPFRONT?</Text>
          {members.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ width: 80, color: theme.text, fontWeight: '600' }}>{m.name}</Text>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
                placeholder="₹ Paid"
                placeholderTextColor={theme.subText}
                keyboardType="decimal-pad"
                value={payersMap[m.name] || ''}
                onChangeText={(v) => setPayersMap({ ...payersMap, [m.name]: v })}
              />
            </View>
          ))}

          <Text style={[styles.label, { color: theme.subText, marginTop: 10 }]}>SPLIT STRATEGY</Text>
          <View style={{ flexDirection: 'row', backgroundColor: theme.inputBg, borderRadius: 8, padding: 3, marginBottom: 10 }}>
            {['UNIFORM', 'SPECIFIC', 'RATIO'].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.tab, { backgroundColor: splitMode === mode ? theme.primary : 'transparent' }]}
                onPress={() => {
                  setSplitMode(mode);
                  setCustomSharesMap({});
                }}
              >
                <Text style={{ color: splitMode === mode ? '#FFF' : theme.text, fontSize: 11, fontWeight: 'bold' }}>
                  {mode === 'UNIFORM' ? 'Equal' : mode === 'SPECIFIC' ? 'Exact' : '% Ratio'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {splitMode !== 'UNIFORM' &&
            members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ width: 80, color: theme.text, fontWeight: '600' }}>{m.name}</Text>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border, marginBottom: 0 }]}
                  placeholder={splitMode === 'SPECIFIC' ? '₹ Share' : '% Share'}
                  placeholderTextColor={theme.subText}
                  keyboardType="decimal-pad"
                  value={customSharesMap[m.name] || ''}
                  onChangeText={(v) => setCustomSharesMap({ ...customSharesMap, [m.name]: v })}
                />
              </View>
            ))}

          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary, marginTop: 10 }]} onPress={handleSaveExpense}>
            <Text style={styles.btnText}>Save Expense 💾</Text>
          </TouchableOpacity>
        </View>

        {/* NET BALANCES */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Net Balances</Text>
          {Object.entries(balances).map(([person, amt]) => (
            <View key={person} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>{person}</Text>
              <Text style={{ fontWeight: 'bold', color: amt >= 0 ? theme.positive : theme.negative }}>
                {amt >= 0 ? `+₹${amt.toFixed(2)}` : `-₹${Math.abs(amt).toFixed(2)}`}
              </Text>
            </View>
          ))}
        </View>

        {/* OPTIMIZED SETTLEMENTS */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Optimized Debt Routes</Text>
          {settlements.length === 0 ? (
            <Text style={{ color: theme.subText, fontSize: 13 }}>All debts are settled! 🎉</Text>
          ) : (
            settlements.map((s, idx) => (
              <View key={idx} style={[styles.settleBox, { backgroundColor: theme.chipBg }]}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>{s.from} ➔ {s.to}</Text>
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>₹{s.amount.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        {/* SPEND ANALYTICS */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Spend Analytics</Text>
          <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 8 }}>Total Spend: ₹{totalSpend.toFixed(2)}</Text>
          {Object.entries(categorySums).map(([cat, amt]) => {
            const pct = totalSpend > 0 ? amt / totalSpend : 0;
            return (
              <View key={cat} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{cat}</Text>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
                    ₹{amt.toFixed(2)} ({(pct * 100).toFixed(1)}%)
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: theme.inputBg, borderRadius: 3 }}>
                  <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: theme.primary, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* HISTORY LOG */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Activity Log</Text>
          {expenses.length === 0 ? (
            <Text style={{ color: theme.subText, fontSize: 13 }}>No expenses logged yet.</Text>
          ) : (
            expenses.map((e) => (
              <TouchableOpacity
                key={e.id}
                activeOpacity={0.7}
                onPress={() => setSelectedExpense(e)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={[styles.logIconWrap, { backgroundColor: theme.chipBg }]}>
                    <Ionicons name={CATEGORY_META[e.category] || 'grid-outline'} size={16} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={{ color: theme.text, fontWeight: 'bold' }}>{e.title}</Text>
                    <Text style={{ color: theme.subText, fontSize: 11 }}>
                      {e.dateLabel ? `${e.dateLabel} • ` : ''}{e.timestamp} • {e.category}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: theme.text, fontWeight: 'bold' }}>₹{e.totalAmount.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.subText} />
                  <TouchableOpacity onPress={() => confirmDeleteExpense(e.id, e.title)}>
                    <Ionicons name="trash-outline" size={18} color={theme.negative} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* FOOTER */}
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <Text style={{ color: theme.subText, fontSize: 12 }}>Made with ❤️ for Campus Squads</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://github.com/Anushreya-Satish')}>
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
              GitHub
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* HAMBURGER MENU */}
      <Modal visible={drawerOpen} transparent animationType="slide">
        <View style={styles.drawerOverlay}>
          <View style={[styles.drawerContent, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Menu</Text>
              <TouchableOpacity onPress={() => setDrawerOpen(false)}>
                <Ionicons name="close-outline" size={26} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.subText, marginBottom: 12 }]}>THEME PREFERENCE</Text>

            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: themeKey === 'light' ? theme.primary : theme.inputBg }]}
              onPress={() => {
                changeTheme('light');
                setDrawerOpen(false);
              }}
            >
              <Ionicons name="sunny-outline" size={20} color={themeKey === 'light' ? '#FFF' : theme.text} />
              <Text style={{ color: themeKey === 'light' ? '#FFF' : theme.text, fontWeight: 'bold' }}>Light Mode</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: themeKey === 'dark' ? theme.primary : theme.inputBg }]}
              onPress={() => {
                changeTheme('dark');
                setDrawerOpen(false);
              }}
            >
              <Ionicons name="moon-outline" size={20} color={themeKey === 'dark' ? '#FFF' : theme.text} />
              <Text style={{ color: themeKey === 'dark' ? '#FFF' : theme.text, fontWeight: 'bold' }}>Dark Mode</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SPLIT HISTORY DETAILS*/}
      <Modal visible={!!selectedExpense} transparent animationType="fade" onRequestClose={() => setSelectedExpense(null)}>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {selectedExpense && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{selectedExpense.title}</Text>
                    <Text style={{ color: theme.subText, fontSize: 11, marginTop: 2 }}>
                      {selectedExpense.dateLabel ? `${selectedExpense.dateLabel} • ` : ''}
                      {selectedExpense.timestamp} • {selectedExpense.category}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedExpense(null)}>
                    <Ionicons name="close-outline" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={{ alignItems: 'center', marginVertical: 14 }}>
                  <Text style={{ color: theme.subText, fontSize: 11 }}>TOTAL BILL</Text>
                  <Text style={{ color: theme.primary, fontSize: 30, fontWeight: '800' }}>
                    ₹{selectedExpense.totalAmount.toFixed(2)}
                  </Text>
                  <View style={[styles.chip, { backgroundColor: theme.chipBg, marginTop: 6 }]}>
                    <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                      {selectedExpense.mode === 'UNIFORM' ? 'Equal Split' : selectedExpense.mode === 'SPECIFIC' ? 'Exact Amounts' : '% Ratio Split'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.label, { color: theme.subText, marginBottom: 8 }]}>WHO PAID</Text>
                {Object.keys(selectedExpense.payers || {}).length === 0 ? (
                  <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 12 }}>No upfront payers recorded.</Text>
                ) : (
                  Object.entries(selectedExpense.payers).map(([name, amt]) => (
                    <View key={name} style={styles.detailRow}>
                      <Text style={{ color: theme.text, fontWeight: '600' }}>{name}</Text>
                      <Text style={{ color: theme.positive, fontWeight: 'bold' }}>paid ₹{Number(amt).toFixed(2)}</Text>
                    </View>
                  ))
                )}

                <Text style={[styles.label, { color: theme.subText, marginTop: 14, marginBottom: 8 }]}>WHO OWES</Text>
                {Object.entries(selectedExpense.shares || {}).map(([name, amt]) => (
                  <View key={name} style={styles.detailRow}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>{name}</Text>
                    <Text style={{ color: theme.negative, fontWeight: 'bold' }}>owes ₹{Number(amt).toFixed(2)}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.negative, marginTop: 18 }]}
                  onPress={() => {
                    setSelectedExpense(null);
                    confirmDeleteExpense(selectedExpense.id, selectedExpense.title);
                  }}
                >
                  <Text style={styles.btnText}>Delete This Expense</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ROOT ENTRY POINT
export default function App() {
  return (
    <SafeAreaProvider>
      <ExpenseProvider>
        <MainRouter />
      </ExpenseProvider>
    </SafeAreaProvider>
  );
}

function MainRouter() {
  const { currentUser, loading, theme } = useExpenses();
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <SplashScreen theme={theme} onFinish={() => setSplashDone(true)} />;
  }
  if (loading) return null; 
  return currentUser ? <DashboardScreen /> : <OnboardingScreen />;
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontWeight: '800' },
  subText: { fontSize: 14, marginTop: 4 },
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10, fontSize: 13 },
  btn: { height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  smallBtn: { paddingHorizontal: 14, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 6 },
  label: { fontSize: 10, fontWeight: '700', marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  settleBox: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 10, marginTop: 6 },
  logIconWrap: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  drawerContent: { width: '75%', height: '100%', padding: 20, paddingTop: 50 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 10 },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  detailCard: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});