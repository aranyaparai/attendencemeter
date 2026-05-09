import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";

// --- Types ---
interface ClassSchedule { day: string; time: string; }
interface AttendanceEntry { id: number; date: string; present: boolean; }
interface Subject {
  id: number;
  name: string;
  color: string;
  classes: ClassSchedule[];
  held: number;
  attended: number;
  history: AttendanceEntry[];
}

const { width } = Dimensions.get("window");
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];
const TABS = ["Home", "Subjects", "Goal", "History", "Notes"];
const TAB_ICONS = ["🏠", "📚", "🎯", "📋", "📝"];

// --- Gauge Component ---
function GaugeChart({ percentage, goal = 75 }: { percentage: number; goal: number }) {
  const r = 70, cx = 90, cy = 90;
  const circumference = Math.PI * r;
  const filled = (percentage / 100) * circumference;
  const goalAngle = (goal / 100) * Math.PI;
  const gx = cx - r * Math.cos(Math.PI - goalAngle);
  const gy = cy - r * Math.sin(goalAngle);
  const color = percentage >= 85 ? "#10b981" : percentage >= 75 ? "#06b6d4" : percentage >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <View style={styles.gaugeContainer}>
      <Svg width="200" height="110" viewBox="0 0 180 100">
        <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
        <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${filled}, ${circumference}`} />
        <Line x1={gx} y1={gy} x2={gx + (gx > cx ? 10 : -10)} y2={gy} stroke="#94a3b8" strokeWidth="2" />
      </Svg>
      <View style={styles.gaugeTextWrapper}>
        <Text style={styles.gaugePctText}>{percentage}%</Text>
        <Text style={[styles.gaugeStatusText, { color }]}>● {percentage >= goal ? 'GOOD' : 'AT RISK'}</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState("Home");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [goal, setGoal] = useState(75);
  const [notes, setNotes] = useState("");
  const [markModal, setMarkModal] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#06b6d4");

  // Load Data on Startup
  useEffect(() => {
    const loadData = async () => {
      const savedSubs = await AsyncStorage.getItem('@subjects');
      const savedGoal = await AsyncStorage.getItem('@goal');
      const savedNotes = await AsyncStorage.getItem('@notes');
      if (savedSubs) setSubjects(JSON.parse(savedSubs));
      if (savedGoal) setGoal(Number(savedGoal));
      if (savedNotes) setNotes(savedNotes);
    };
    loadData();
  }, []);

  // Save Data on Change
  useEffect(() => {
    AsyncStorage.setItem('@subjects', JSON.stringify(subjects));
    AsyncStorage.setItem('@goal', goal.toString());
    AsyncStorage.setItem('@notes', notes);
  }, [subjects, goal, notes]);

  const totalHeld = subjects.reduce((a, s) => a + s.held, 0);
  const totalAttended = subjects.reduce((a, s) => a + s.attended, 0);
  const overallPct = totalHeld === 0 ? 0 : Math.round((totalAttended / totalHeld) * 100);

  const markAttendance = (subId: number, present: boolean) => {
    const now = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    setSubjects(prev => prev.map(s => s.id === subId ? {
      ...s,
      held: s.held + 1,
      attended: s.attended + (present ? 1 : 0),
      history: [...s.history, { id: Date.now(), date: now, present }]
    } : s));
    setMarkModal(null);
  };

  const addSubject = () => {
    if (!newSubName.trim()) return;
    setSubjects([...subjects, { id: Date.now(), name: newSubName, color: newSubColor, classes: [], held: 0, attended: 0, history: [] }]);
    setNewSubName("");
  };

  const deleteSubject = (id: number) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Logo */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image 
            source={require("../../assets/images/logo.png")} 
            style={styles.logo} 
            defaultSource={require("../../assets/images/icon.png")} // Fallback if logo.png isn't there yet
          />
          <View>
            <Text style={styles.headerSub}>ATTENDANCE MANAGER</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === "Home" && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>OVERALL PROGRESS</Text>
              <GaugeChart percentage={overallPct} goal={goal} />
              <View style={styles.statRow}>
                <View style={styles.statBox}><Text style={styles.statNum}>{totalHeld}</Text><Text style={styles.statLab}>HELD</Text></View>
                <View style={styles.statBox}><Text style={styles.statNum}>{totalAttended}</Text><Text style={styles.statLab}>ATTENDED</Text></View>
              </View>
            </View>
            <Text style={styles.sectionTitle}>MY SUBJECTS</Text>
            {subjects.length === 0 ? <Text style={styles.empty}>Go to 'Subjects' tab to add your first course!</Text> : 
              subjects.map(s => {
                const p = s.held === 0 ? 0 : Math.round((s.attended / s.held) * 100);
                return (
                  <View key={s.id} style={styles.subjectCard}>
                    <View style={styles.flexRow}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <View style={[styles.colorDot, {backgroundColor: s.color, width: 10, height: 10}]} />
                        <Text style={styles.subjectName}>{s.name}</Text>
                      </View>
                      <Text style={[styles.subjectPct, { color: p >= goal ? "#10b981" : "#ef4444" }]}>{p}%</Text>
                    </View>
                    <TouchableOpacity style={[styles.markBtn, { backgroundColor: s.color }]} onPress={() => setMarkModal(s.id)}>
                      <Text style={styles.markBtnText}>Mark Today's Class</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            }
          </View>
        )}

        {tab === "Subjects" && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>ADD NEW SUBJECT</Text>
              <TextInput style={styles.input} placeholder="Enter subject name..." value={newSubName} onChangeText={setNewSubName} />
              <View style={styles.colorPicker}>
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setNewSubColor(c)} style={[styles.colorDot, { backgroundColor: c, borderWidth: newSubColor === c ? 3 : 0, borderColor: '#000' }]} />
                ))}
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={addSubject}><Text style={styles.addBtnText}>Create Subject</Text></TouchableOpacity>
            </View>
            {subjects.map(s => (
              <View key={s.id} style={[styles.subjectCard, {flexDirection: 'row', justifyContent: 'space-between'}]}>
                <Text style={styles.subjectName}>{s.name}</Text>
                <TouchableOpacity onPress={() => deleteSubject(s.id)}><Text style={{color: '#ef4444', fontWeight: 'bold'}}>Delete</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === "Goal" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>MINIMUM ATTENDANCE TARGET</Text>
            <Text style={styles.hugeText}>{goal}%</Text>
            <View style={[styles.flexRow, {justifyContent: 'center', gap: 30}]}>
              <TouchableOpacity onPress={() => setGoal(g => Math.max(50, g - 5))} style={styles.adjBtn}><Text style={styles.adjBtnT}>-</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setGoal(g => Math.min(100, g + 5))} style={styles.adjBtn}><Text style={styles.adjBtnT}>+</Text></TouchableOpacity>
            </View>
            <Text style={{color: '#94a3b8', marginTop: 15, fontSize: 12}}>Recommended: 75% or higher</Text>
          </View>
        )}

        {tab === "History" && (
          subjects.map(s => (
            <View key={s.id} style={styles.card}>
              <Text style={[styles.subjectName, {marginBottom: 10}]}>{s.name} Logs</Text>
              {s.history.length === 0 ? <Text style={styles.empty}>No attendance marked yet.</Text> : 
               s.history.slice().reverse().map(h => (
                 <View key={h.id} style={styles.histRow}>
                   <Text style={{color: '#64748b'}}>{h.date}</Text>
                   <Text style={{ color: h.present ? "#10b981" : "#ef4444", fontWeight: '700' }}>{h.present ? "PRESENT" : "ABSENT"}</Text>
                 </View>
               ))}
            </View>
          ))
        )}

        {tab === "Notes" && (
          <View style={styles.card}>
             <Text style={styles.cardSectionTitle}>PERSONAL STUDY NOTES</Text>
             <TextInput 
              style={styles.notesInput} 
              multiline 
              placeholder="Type homework or reminders here..." 
              value={notes} 
              onChangeText={setNotes} 
            />
          </View>
        )}
      </ScrollView>

      {/* --- Attendance Modal --- */}
      <Modal visible={markModal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Mark</Text>
            <Text style={{marginBottom: 20, color: '#64748b'}}>{subjects.find(s => s.id === markModal)?.name}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.pBtn} onPress={() => markModal && markAttendance(markModal, true)}><Text style={styles.btnT}>Present</Text></TouchableOpacity>
              <TouchableOpacity style={styles.aBtn} onPress={() => markModal && markAttendance(markModal, false)}><Text style={styles.btnT}>Absent</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setMarkModal(null)}><Text style={styles.cancel}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Bottom Navigation --- */}
      <View style={styles.nav}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.navBtn}>
            <Text style={{ fontSize: 20 }}>{TAB_ICONS[i]}</Text>
            <Text style={[styles.navLab, { color: tab === t ? "#06b6d4" : "#94a3b8" }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  header: { backgroundColor: "#0f172a", padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 40 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#1e293b' },
  headerSub: { color: "#94a3b8", fontSize: 10, fontWeight: "bold" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  scroll: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  cardLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "bold", marginBottom: 15, letterSpacing: 1 },
  gaugeContainer: { alignItems: "center" },
  gaugeTextWrapper: { position: 'absolute', top: 55, alignItems: 'center' },
  gaugePctText: { fontSize: 36, fontWeight: "800", color: "#1e293b" },
  gaugeStatusText: { fontSize: 11, fontWeight: "bold" },
  statRow: { flexDirection: 'row', marginTop: 20, gap: 10, width: '100%' },
  statBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  statLab: { fontSize: 9, color: '#94a3b8', fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 12, marginLeft: 5 },
  subjectCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, width: '100%', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  flexRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: '100%' },
  subjectName: { fontSize: 16, fontWeight: "700", color: '#1e293b' },
  subjectPct: { fontSize: 18, fontWeight: "800" },
  markBtn: { marginTop: 15, padding: 14, borderRadius: 12, alignItems: "center" },
  markBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  input: { backgroundColor: '#f8fafc', width: '100%', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, justifyContent: 'center' },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  addBtn: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, width: '100%', alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  hugeText: { fontSize: 64, fontWeight: '800', color: '#1e293b', marginVertical: 10 },
  adjBtn: { backgroundColor: '#f1f5f9', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  adjBtnT: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  empty: { color: '#94a3b8', marginVertical: 20, textAlign: 'center', fontSize: 13 },
  notesInput: { width: '100%', height: 250, textAlignVertical: 'top', fontSize: 16, lineHeight: 24, color: '#1e293b' },
  nav: { flexDirection: "row", height: 85, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#f1f5f9", paddingBottom: Platform.OS === 'ios' ? 25 : 10 },
  navBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLab: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", width: 300, borderRadius: 28, padding: 25, alignItems: "center" },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 5, color: '#1e293b' },
  modalBtns: { flexDirection: "row", gap: 12, marginBottom: 20, marginTop: 10 },
  pBtn: { backgroundColor: "#10b981", padding: 18, borderRadius: 16, flex: 1, alignItems: "center" },
  aBtn: { backgroundColor: "#ef4444", padding: 18, borderRadius: 16, flex: 1, alignItems: "center" },
  btnT: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  cancel: { color: "#94a3b8", fontWeight: '600' },
  cardSectionTitle: { fontWeight: '800', marginBottom: 15, fontSize: 14, color: '#1e293b', alignSelf: 'flex-start' }
});