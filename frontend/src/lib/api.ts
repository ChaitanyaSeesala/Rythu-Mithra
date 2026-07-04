/**
 * Shared design tokens & backend helper.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const COLORS = {
  brand: "#1E8A3E",
  brandDark: "#0F5D2A",
  brandLight: "#D3E8D9",
  surface: "#F7F9F7",
  card: "#FFFFFF",
  text: "#111C14",
  textMuted: "#5A6B60",
  border: "#E1E9E2",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  success: "#16A34A",
  successBg: "#DCFCE7",
  info: "#3B82F6",
  chipBg: "#F1F5F2",
};

export const RADIUS = { sm: 6, md: 12, lg: 16, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const TOKEN_KEY = "rm_token";

export async function saveToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function loadToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = init.body instanceof FormData;
  if (!isForm && init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return data as T;
}

// ---------------- i18n ----------------
export type Lang = "en" | "te" | "hi";

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    welcome_back: "Welcome Back",
    sign_in_sub: "Sign in to monitor your farm",
    mobile: "Mobile Number",
    password: "Password",
    forgot: "Forgot Password?",
    login: "Login",
    create_account: "Create Account",
    signup: "Sign Up",
    full_name: "Full Name",
    email: "Email",
    good_morning: "GOOD MORNING",
    good_afternoon: "GOOD AFTERNOON",
    good_evening: "GOOD EVENING",
    iot_device: "IoT Device",
    connected: "Connected",
    disconnected: "Disconnected",
    connect_device: "Connect Device",
    no_device: "No Device Connected",
    no_device_desc: "Connect your RythuMitra device to view live soil data",
    live_sensor_data: "Live Sensor Data",
    nitrogen: "Nitrogen (N)",
    phosphorus: "Phosphorus (P)",
    potassium: "Potassium (K)",
    soil_moisture: "Soil Moisture",
    fertilizer_advice: "Fertilizer Advice",
    advice_sub: "AI-powered soil nutrition plan",
    configure_query: "CONFIGURE QUERY",
    recommendation_type: "Recommendation Type",
    ai_model: "AI Model / API",
    field: "Field",
    get_plan: "Get Fertilizer Plan",
    soil_health: "SOIL HEALTH STATUS",
    activity_planner: "Activity Planner",
    duration: "DURATION",
    today: "TODAY",
    overall_progress: "Overall Progress",
    daily_reminders: "Daily Reminders",
    full_timeline: "Full Timeline",
    mark_done: "Mark Done",
    voice_guide: "Voice Guide",
    personal_details: "PERSONAL DETAILS",
    farm_details: "FARM DETAILS",
    device_info: "DEVICE INFORMATION",
    settings: "SETTINGS",
    language: "Language",
    logout: "Log Out",
    fields: "Fields",
    acres: "Acres",
    score: "Score",
    completed: "Completed",
    upcoming: "Upcoming",
    good: "Good",
    low: "Low",
    high: "High",
    normal: "Normal",
    running: "Running",
    paused: "Paused",
    stopped: "Stopped",
    idle: "Idle",
  },
  te: {
    welcome_back: "తిరిగి స్వాగతం",
    sign_in_sub: "మీ పొలాన్ని పర్యవేక్షించడానికి సైన్ ఇన్ చేయండి",
    mobile: "మొబైల్ నంబర్",
    password: "పాస్‌వర్డ్",
    forgot: "పాస్‌వర్డ్ మర్చిపోయారా?",
    login: "లాగిన్",
    create_account: "ఖాతా సృష్టించండి",
    signup: "సైన్ అప్",
    full_name: "పూర్తి పేరు",
    email: "ఇమెయిల్",
    good_morning: "శుభోదయం",
    good_afternoon: "శుభ మధ్యాహ్నం",
    good_evening: "శుభ సాయంత్రం",
    iot_device: "IoT పరికరం",
    connected: "కనెక్ట్ అయింది",
    disconnected: "డిస్‌కనెక్ట్",
    connect_device: "పరికరాన్ని కనెక్ట్ చేయండి",
    no_device: "పరికరం కనెక్ట్ కాలేదు",
    no_device_desc: "లైవ్ డేటా కోసం మీ RythuMitra పరికరాన్ని కనెక్ట్ చేయండి",
    live_sensor_data: "లైవ్ సెన్సార్ డేటా",
    nitrogen: "నత్రజని (N)",
    phosphorus: "భాస్వరం (P)",
    potassium: "పొటాషియం (K)",
    soil_moisture: "నేల తేమ",
    fertilizer_advice: "ఎరువుల సలహా",
    advice_sub: "AI-ఆధారిత నేల పోషణ ప్రణాళిక",
    configure_query: "ప్రశ్నను కాన్ఫిగర్ చేయండి",
    recommendation_type: "సిఫారసు రకం",
    ai_model: "AI మోడల్",
    field: "పొలం",
    get_plan: "ఎరువుల ప్రణాళిక పొందండి",
    soil_health: "నేల ఆరోగ్య స్థితి",
    activity_planner: "కార్యాచరణ ప్రణాళిక",
    duration: "వ్యవధి",
    today: "ఈరోజు",
    overall_progress: "మొత్తం పురోగతి",
    daily_reminders: "రోజువారీ రిమైండర్లు",
    full_timeline: "పూర్తి కాలక్రమం",
    mark_done: "పూర్తయినట్లు గుర్తు",
    voice_guide: "వాయిస్ గైడ్",
    personal_details: "వ్యక్తిగత వివరాలు",
    farm_details: "వ్యవసాయ వివరాలు",
    device_info: "పరికర సమాచారం",
    settings: "సెట్టింగులు",
    language: "భాష",
    logout: "లాగ్ అవుట్",
    fields: "పొలాలు",
    acres: "ఎకరాలు",
    score: "స్కోర్",
    completed: "పూర్తయింది",
    upcoming: "రాబోయేవి",
    good: "బాగుంది",
    low: "తక్కువ",
    high: "ఎక్కువ",
    normal: "సాధారణ",
    running: "నడుస్తోంది",
    paused: "నిలిపారు",
    stopped: "ఆగింది",
    idle: "ఖాళీ",
  },
  hi: {
    welcome_back: "वापस स्वागत है",
    sign_in_sub: "अपने खेत की निगरानी के लिए साइन इन करें",
    mobile: "मोबाइल नंबर",
    password: "पासवर्ड",
    forgot: "पासवर्ड भूल गए?",
    login: "लॉगिन",
    create_account: "खाता बनाएं",
    signup: "साइन अप",
    full_name: "पूरा नाम",
    email: "ईमेल",
    good_morning: "सुप्रभात",
    good_afternoon: "नमस्कार",
    good_evening: "शुभ संध्या",
    iot_device: "IoT डिवाइस",
    connected: "जुड़ा है",
    disconnected: "कट गया",
    connect_device: "डिवाइस कनेक्ट करें",
    no_device: "कोई डिवाइस नहीं जुड़ा",
    no_device_desc: "लाइव मिट्टी डेटा देखने के लिए अपना RythuMitra डिवाइस कनेक्ट करें",
    live_sensor_data: "लाइव सेंसर डेटा",
    nitrogen: "नाइट्रोजन (N)",
    phosphorus: "फास्फोरस (P)",
    potassium: "पोटैशियम (K)",
    soil_moisture: "मृदा नमी",
    fertilizer_advice: "उर्वरक सलाह",
    advice_sub: "AI आधारित मृदा पोषण योजना",
    configure_query: "प्रश्न कॉन्फ़िगर करें",
    recommendation_type: "अनुशंसा प्रकार",
    ai_model: "AI मॉडल",
    field: "खेत",
    get_plan: "उर्वरक योजना पाएं",
    soil_health: "मृदा स्वास्थ्य स्थिति",
    activity_planner: "गतिविधि योजनाकार",
    duration: "अवधि",
    today: "आज",
    overall_progress: "कुल प्रगति",
    daily_reminders: "दैनिक अनुस्मारक",
    full_timeline: "पूर्ण समयरेखा",
    mark_done: "पूर्ण चिन्हित करें",
    voice_guide: "आवाज़ गाइड",
    personal_details: "व्यक्तिगत विवरण",
    farm_details: "कृषि विवरण",
    device_info: "डिवाइस जानकारी",
    settings: "सेटिंग्स",
    language: "भाषा",
    logout: "लॉग आउट",
    fields: "खेत",
    acres: "एकड़",
    score: "स्कोर",
    completed: "पूर्ण",
    upcoming: "आगामी",
    good: "अच्छा",
    low: "कम",
    high: "अधिक",
    normal: "सामान्य",
    running: "चालू",
    paused: "रुका",
    stopped: "बंद",
    idle: "निष्क्रिय",
  },
};

// simple singleton store for language + user
type Listener = () => void;
class Store {
  lang: Lang = "en";
  user: any = null;
  private listeners = new Set<Listener>();
  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
  async init() {
    const l = (await AsyncStorage.getItem("rm_lang")) as Lang | null;
    if (l && ["en", "te", "hi"].includes(l)) this.lang = l;
  }
  async setLang(l: Lang) {
    this.lang = l;
    await AsyncStorage.setItem("rm_lang", l);
    this.emit();
  }
  setUser(u: any) {
    this.user = u;
    this.emit();
  }
  t(key: string): string {
    return STRINGS[this.lang][key] || STRINGS.en[key] || key;
  }
}
export const store = new Store();
