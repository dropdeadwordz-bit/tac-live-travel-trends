import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Map as MapIcon, Calendar, TrendingUp, XCircle, EyeOff, Filter, SlidersHorizontal, ChevronDown, ChevronUp, Bed, CheckCircle, RefreshCw, Lock, Database, X, CloudUpload } from 'lucide-react';

// === FIREBASE IMPORTS ===
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// 🔐 FIREBASE INITIALISIERUNG
// ==========================================
let app, auth, db, appId;
let isFirebaseReady = false;

try {
  let config;
  if (typeof window !== 'undefined' && typeof window.__firebase_config !== 'undefined') {
    config = JSON.parse(window.__firebase_config);
    appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'tac-travel-trends';
  } else {
    config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    appId = 'tac-travel-trends';
  }

  if (config && config.apiKey) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseReady = true;
  }
} catch (error) {
  console.warn("Firebase Init übersprungen. Fallback-Daten werden genutzt.", error);
}

// --- DYNAMISCHER PFAD-BALANCER ---
const getSafeDocRef = (firestoreDb, targetAppId, collectionName, documentId) => {
  const fullPath = `artifacts/${targetAppId}/public/data/${collectionName}/${documentId}`;
  const segmentsCount = fullPath.split('/').filter(Boolean).length;
  if (segmentsCount % 2 !== 0) {
    return doc(firestoreDb, `${fullPath}/_doc`);
  }
  return doc(firestoreDb, fullPath);
};

// --- HILFSFUNKTION FÜR KALENDER-DATUM ---
const formatD = (str) => {
  if(!str) return "";
  const parts = str.split('-'); // ISO Date format: YYYY-MM-DD
  if(parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return str;
};

// Formatiert Von-Bis Daten
const formatRange = (start, end, fallback) => {
  const s = formatD(start);
  const e = formatD(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  if (e) return e;
  return fallback;
};


// ==========================================
// 🛠️ FALLBACK-DATEN (Wenn DB leer/offline)
// ==========================================
const DEFAULT_FLIGHTS_CSV = `Route,,,Last 84 Days,,Last 28 Days,,,Last 7 Days,,
Origin,Destination,Route ID,Ad Opp.,YoY,Ad Opp.,MoM,YoY,Ad Opp.,WoW,YoY
GB - London,AE - Dubai,LON-DXB,700000,0.263,200000,-0.397,0.094,30000,-0.239,-0.419
US - New York,GB - London,NYC-LON,500000,-0.008,200000,0.597,0.33,40000,-0.053,-0.126
GB - London,US - New York,LON-NYC,500000,-0.191,100000,-0.145,-0.258,30000,-0.07,-0.232
DE - Frankfurt,US - New York,FRA-NYC,200000,-0.128,60000,-0.047,-0.165,20000,0.031,-0.133
AT - Vienna,ES - Barcelona,VIE-BCN,80000,-0.115,20000,-0.052,-0.132,6000,-0.057,-0.172
CH - Zürich,ES - Barcelona,ZRH-BCN,70000,0.06,30000,0.174,0.099,7000,-0.018,0.13`;

const DEFAULT_ACC_CURRENT_CSV = `User Country,Destination Country,Destination Region,Domestic / Int'l,Ad Opp.
GB,GB,England,Domestic,7000000
US,US,Florida,Domestic,5000000
US,US,California,Domestic,5000000
US,US,Texas,Domestic,2000000
IN,IN,Maharashtra,Domestic,2000000
BR,BR,State of São Paulo,Domestic,2000000
JP,JP,Tokyo,Domestic,2000000
US,US,New York,Domestic,2000000
JP,JP,Osaka,Domestic,1000000
CA,CA,Ontario,Domestic,1000000
US,US,Tennessee,Domestic,1000000
IN,IN,Karnataka,Domestic,1000000
DE,DE,Bavaria,Domestic,1000000
GB,GB,Scotland,Domestic,1000000
ES,ES,Valencian Community,Domestic,1000000
IT,CH,Tessin,International,500000`;

const DEFAULT_ACC_PREVIOUS_CSV = `User Country,Destination Country,Destination Region,Domestic / Int'l,Ad Opp.
GB,GB,England,Domestic,6800000
US,US,Florida,Domestic,5200000
US,US,California,Domestic,4800000
US,US,Texas,Domestic,1900000
IN,IN,Maharashtra,Domestic,1500000
BR,BR,State of São Paulo,Domestic,2100000
JP,JP,Tokyo,Domestic,2000000
US,US,New York,Domestic,1800000
JP,JP,Osaka,Domestic,1100000
CA,CA,Ontario,Domestic,950000
US,US,Tennessee,Domestic,1050000
IN,IN,Karnataka,Domestic,800000
DE,DE,Bavaria,Domestic,900000
GB,GB,Scotland,Domestic,1050000
ES,ES,Valencian Community,Domestic,800000
IT,CH,Tessin,International,400000`;


// ==========================================
// 🔧 HILFSFUNKTIONEN & WÖRTERBÜCHER
// ==========================================
const getFlagImgHtml = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '';
  return `<img src="https://flagcdn.com/w20/${countryCode.toLowerCase()}.png" style="width:16px; height:auto; display:inline-block; vertical-align:middle; border-radius:2px; margin-right:4px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);" alt="${countryCode}" />`;
};

const COUNTRY_NAMES = { "DE": "Deutschland", "AT": "Österreich", "CH": "Schweiz", "US": "USA", "GB": "Großbritannien", "FR": "Frankreich", "ES": "Spanien", "IT": "Italien", "NL": "Niederlande", "TR": "Türkei", "AE": "Ver. Arab. Emirate", "TH": "Thailand", "SG": "Singapur", "CZ": "Tschechien", "PR": "Puerto Rico", "BB": "Barbados", "BE": "Belgien", "HU": "Ungarn", "IL": "Israel", "CA": "Kanada", "BG": "Bulgarien", "IE": "Irland", "MX": "Mexiko", "VE": "Venezuela", "MA": "Marokko", "IN": "Indien", "DZ": "Algerien", "EG": "Ägypten", "ZA": "Südafrika", "GR": "Griechenland", "CY": "Zypern", "HR": "Kroatien", "PT": "Portugal", "JP": "Japan", "BR": "Brasilien", "CN": "China", "RU": "Russland", "UA": "Ukraine", "ID": "Indonesien" };
const COUNTRY_TO_CONTINENT = { "DE": "Europa", "AT": "Europa", "CH": "Europa", "GB": "Europa", "FR": "Europa", "ES": "Europa", "IT": "Europa", "NL": "Europa", "CZ": "Europa", "BE": "Europa", "HU": "Europa", "BG": "Europa", "IE": "Europa", "GR": "Europa", "CY": "Europa", "MT": "Europa", "HR": "Europa", "IS": "Europa", "NO": "Europa", "SE": "Europa", "DK": "Europa", "FI": "Europa", "PL": "Europa", "RO": "Europa", "PT": "Europa", "UA": "Europa", "US": "Nord- & Mittelamerika", "CA": "Nord- & Mittelamerika", "MX": "Nord- & Mittelamerika", "PR": "Nord- & Mittelamerika", "BB": "Nord- & Mittelamerika", "BR": "Südamerika", "AR": "Südamerika", "CO": "Südamerika", "CL": "Südamerika", "TH": "Asien", "SG": "Asien", "IN": "Asien", "JP": "Asien", "CN": "Asien", "RU": "Asien", "ID": "Asien", "TR": "Naher Osten", "AE": "Naher Osten", "IL": "Naher Osten", "QA": "Naher Osten", "SA": "Naher Osten", "EG": "Afrika", "ZA": "Afrika", "MA": "Afrika", "AU": "Ozeanien", "NZ": "Ozeanien" };
const CITY_COORDS = { "Frankfurt": [8.6821, 50.1109], "Berlin": [13.4050, 52.5200], "Munich": [11.5820, 48.1351], "Vienna": [16.3738, 48.2082], "Zürich": [8.5417, 47.3769], "Barcelona": [2.1734, 41.3851], "London": [-0.1278, 51.5074], "Paris": [2.3522, 48.8566], "Amsterdam": [4.9041, 52.3676], "Dubai": [55.2708, 25.2048], "New York": [-74.0060, 40.7128], "Washington": [-77.0369, 38.9072], "San Juan": [-66.1057, 18.4655], "Prague": [14.4378, 50.0755], "İstanbul": [28.9784, 41.0082], "Bridgetown": [-59.6167, 13.0968], "Brussels": [4.3517, 50.8503], "Milan": [9.1900, 45.4642], "Budapest": [19.0402, 47.4979], "Bilbao": [-2.9350, 43.2630], "Tel Aviv-Yafo": [34.8000, 32.0833], "Bangkok": [100.5018, 13.7563] };
const COUNTRY_CENTER_COORDS = { "US": [-95.71, 37.09], "GB": [-3.43, 55.37], "IN": [78.96, 20.59], "BR": [-51.92, -14.23], "JP": [138.25, 36.20], "CA": [-106.34, 56.13], "FR": [2.21, 46.22], "ES": [-3.74, 40.46], "DE": [10.45, 51.16], "IT": [12.56, 41.87], "CH": [8.22, 46.81], "AT": [14.55, 47.51], "NL": [5.29, 52.13], "AE": [53.84, 23.68], "HR": [15.20, 45.10], "PT": [-8.22, 39.39], "BG": [25.48, 42.73], "UA": [31.16, 48.37], "ID": [113.92, -0.78], "EG": [30.80, 26.82] };
const REGION_COORDS = { "England": [-1.17, 52.35], "Florida": [-81.51, 27.66], "California": [-119.41, 36.77], "Texas": [-99.90, 31.96], "Maharashtra": [75.71, 19.75], "State of São Paulo": [-48.10, -23.55], "Tokyo": [139.69, 35.68], "New York": [-75.00, 43.00], "Osaka": [135.50, 34.69], "Ontario": [-85.32, 51.25], "Tennessee": [-86.58, 35.51], "Karnataka": [75.71, 15.31], "North Carolina": [-79.01, 35.75], "Île-de-France": [2.32, 48.84], "Tamil Nadu": [78.65, 11.12], "Valencian Community": [-0.37, 39.48], "Georgia": [-82.90, 32.16], "South Carolina": [-81.16, 33.83], "Illinois": [-89.39, 40.63], "Bavaria": [11.49, 48.79], "Scotland": [-4.20, 56.49], "Nevada": [-116.41, 38.80], "Calabria": [16.28, 38.90], "Brittany": [-2.80, 48.20], "Tessin": [8.96, 46.20], "Ticino": [8.96, 46.20] };
const PLANE_PATH = 'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z';


export default function App() {
  const [activeTab, setActiveTab] = useState('flights'); 

  // --- UI & FIREBASE STATES ---
  const [echartsReady, setEchartsReady] = useState(false);
  const [user, setUser] = useState(null);
  
  // --- ADMIN PANEL STATES ---
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminFlightDate, setAdminFlightDate] = useState("");
  const [adminFlightCsv, setAdminFlightCsv] = useState(null);
  
  // Neu: Start- und Enddatum pro Zeitraum für Admin
  const [adminAccDate1Start, setAdminAccDate1Start] = useState("");
  const [adminAccDate1End, setAdminAccDate1End] = useState("");
  const [adminAccDate2Start, setAdminAccDate2Start] = useState("");
  const [adminAccDate2End, setAdminAccDate2End] = useState("");
  
  const [adminAccCurrCsv, setAdminAccCurrCsv] = useState(null);
  const [adminAccPrevCsv, setAdminAccPrevCsv] = useState(null);
  
  // --- STATE FLÜGE ---
  const [flightsGlobalDate, setFlightsGlobalDate] = useState("Lade Daten...");
  const [flightsGlobalCsv, setFlightsGlobalCsv] = useState("");
  const [isDefaultDataFlights, setIsDefaultDataFlights] = useState(true);
  const [customFlightDate, setCustomFlightDate] = useState("");
  
  const [data, setData] = useState([]);
  const [disabledRoutes, setDisabledRoutes] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [activeCountries, setActiveCountries] = useState([]);
  const [availableDestCountries, setAvailableDestCountries] = useState([]);
  const [activeDestCountries, setActiveDestCountries] = useState([]);
  const [timeframe, setTimeframe] = useState('84d'); 
  const [trendType, setTrendType] = useState('yoy'); 
  const [minAdOppFilter, setMinAdOppFilter] = useState(''); 
  const [isDestExpanded, setIsDestExpanded] = useState(false);

  // --- STATE UNTERKÜNFTE ---
  const [accGlobalDate, setAccGlobalDate] = useState("Lade Daten...");
  const [accGlobalCurrCsv, setAccGlobalCurrCsv] = useState("");
  const [accGlobalPrevCsv, setAccGlobalPrevCsv] = useState("");
  const [isDefaultDataAcc, setIsDefaultDataAcc] = useState(true);
  const [customAccDate, setCustomAccDate] = useState("");
  
  const [accData, setAccData] = useState([]);
  const [accFilterType, setAccFilterType] = useState('All');
  const [availableAccCountries, setAvailableAccCountries] = useState([]);
  const [activeAccCountries, setActiveAccCountries] = useState([]);

  // --- TEMP USER DIY MODAL STATES ---
  const [isDiyModalOpen, setIsDiyModalOpen] = useState(false);
  const [tempFlightFile, setTempFlightFile] = useState(null);
  const [tempFlightDate, setTempFlightDate] = useState("");
  
  // Neu: Start- und Enddatum pro Zeitraum für DIY User
  const [tempAccDate1Start, setTempAccDate1Start] = useState("");
  const [tempAccDate1End, setTempAccDate1End] = useState("");
  const [tempAccDate2Start, setTempAccDate2Start] = useState("");
  const [tempAccDate2End, setTempAccDate2End] = useState("");
  
  const [tempAccCurrent, setTempAccCurrent] = useState(null);
  const [tempAccPrevious, setTempAccPrevious] = useState(null);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // ==========================================
  // 1. INIT & AUTH (FIREBASE + ECHARTS)
  // ==========================================
  useEffect(() => {
    // ECharts laden
    if (!document.getElementById('echarts-core')) {
      const script = document.createElement('script');
      script.id = 'echarts-core';
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
      script.onload = () => {
        const mapScript = document.createElement('script');
        mapScript.id = 'echarts-world';
        mapScript.src = 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js';
        mapScript.onload = () => setEchartsReady(true);
        document.head.appendChild(mapScript);
      };
      document.head.appendChild(script);
    } else if (window.echarts) {
      setEchartsReady(true);
    }

    // Firebase Auth anstoßen
    if (isFirebaseReady) {
      const initAuth = async () => {
        try {
          if (typeof window !== 'undefined' && typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
            await signInWithCustomToken(auth, window.__initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch(err) { console.error("Auth error", err); }
      };
      initAuth();

      const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
      return () => {
        unsubscribe();
      };
    } else {
      // Offline / Kein Firebase Fallback laden
      setFlightsGlobalCsv(DEFAULT_FLIGHTS_CSV);
      setFlightsGlobalDate("Demo Daten (Offline)");
      setAccGlobalCurrCsv(DEFAULT_ACC_CURRENT_CSV);
      setAccGlobalPrevCsv(DEFAULT_ACC_PREVIOUS_CSV);
      setAccGlobalDate("Demo Daten (Offline)");
    }
  }, []);

  // ==========================================
  // 2. FIREBASE DATEN LADEN (LIVE SUBSCRIPTION)
  // ==========================================
  useEffect(() => {
    if (!user || !isFirebaseReady || !appId) return;

    const flightsRef = getSafeDocRef(db, appId, 'appConfig', 'flights');
    const unsubFlights = onSnapshot(flightsRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setFlightsGlobalCsv(d.csv || DEFAULT_FLIGHTS_CSV);
        setFlightsGlobalDate(d.lastUpdated || "Unbekannt");
      } else {
        setFlightsGlobalCsv(DEFAULT_FLIGHTS_CSV);
        setFlightsGlobalDate("Start-Daten");
      }
    }, (err) => console.error("Snapshot Error Flights:", err));

    const accRef = getSafeDocRef(db, appId, 'appConfig', 'accommodations');
    const unsubAcc = onSnapshot(accRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setAccGlobalCurrCsv(d.currentCsv || DEFAULT_ACC_CURRENT_CSV);
        setAccGlobalPrevCsv(d.prevCsv || DEFAULT_ACC_PREVIOUS_CSV);
        setAccGlobalDate(d.lastUpdated || "Unbekannt");
      } else {
        setAccGlobalCurrCsv(DEFAULT_ACC_CURRENT_CSV);
        setAccGlobalPrevCsv(DEFAULT_ACC_PREVIOUS_CSV);
        setAccGlobalDate("Start-Daten");
      }
    }, (err) => console.error("Snapshot Error Acc:", err));

    return () => { unsubFlights(); unsubAcc(); };
  }, [user]);


  // ==========================================
  // 3. PARSING & UPDATE LOGIK
  // ==========================================
  const parseCSV = (csvText) => {
    if(!csvText) return [];
    const lines = csvText.trim().split('\n');
    const parsedData = [];
    const delimiter = lines[1] && lines[1].includes(';') ? ';' : ',';
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].replace(/\r/g, '').trim();
      if (!line) continue;
      const cols = line.split(delimiter);
      const originFull = cols[0];
      const destFull = cols[1];
      const originCountry = originFull.includes('-') ? originFull.split('-')[0].trim() : 'Unbekannt';
      const originCity = originFull.includes('-') ? originFull.split('-')[1].trim() : originFull;
      const destCountry = destFull.includes('-') ? destFull.split('-')[0].trim() : 'Unbekannt';
      const destCity = destFull.includes('-') ? destFull.split('-')[1].trim() : destFull;
      if (CITY_COORDS[originCity] && CITY_COORDS[destCity]) {
        parsedData.push({ originCountry, originCity, destCountry, destCity, routeId: cols[2], d84_ad: parseFloat(cols[3]) || 0, d84_yoy: parseFloat(cols[4]) || 0, d28_ad: parseFloat(cols[5]) || 0, d28_mom: parseFloat(cols[6]) || 0, d28_yoy: parseFloat(cols[7]) || 0, d7_ad: parseFloat(cols[8]) || 0, d7_wow: parseFloat(cols[9]) || 0, d7_yoy: parseFloat(cols[10]) || 0 });
      }
    }
    return parsedData;
  };

  const parseAccCSV = (text) => {
    if(!text) return [];
    const lines = text.trim().split('\n');
    const parsed = [];
    const delimiter = lines[0].includes(';') ? ';' : ',';
    for(let i=1; i<lines.length; i++) {
       const line = lines[i].replace(/\r/g, '').trim();
       if(!line) continue;
       const cols = line.split(delimiter);
       if(cols.length >= 5) {
           parsed.push({ userCountry: cols[0].trim(), destCountry: cols[1].trim(), destRegion: cols[2].trim(), type: cols[3].trim(), adOpp: parseFloat(cols[4]) || 0 });
       }
    }
    return parsed;
  };

  const mergeAccData = (currArray, prevArray) => {
    const joined = [];
    currArray.forEach(curr => {
       if(curr.adOpp < 1000) return; 
       const prev = prevArray.find(p => p.userCountry === curr.userCountry && p.destCountry === curr.destCountry && p.destRegion === curr.destRegion);
       const prevAdOpp = prev ? prev.adOpp : 0;
       let wow = 0;
       if(prevAdOpp > 0) wow = (curr.adOpp - prevAdOpp) / prevAdOpp;
       joined.push({ ...curr, prevAdOpp, trend: wow, routeId: `${curr.userCountry}-${curr.destRegion}` });
    });
    return joined;
  };

  // Extrahiert verfügbare Länder, sobald sich die Unterkunfts-Daten ändern
  useEffect(() => {
    const countries = [...new Set(accData.map(d => d.userCountry))].sort();
    setAvailableAccCountries(countries);
    setActiveAccCountries(countries);
  }, [accData]);

  // Wenn Global-Daten aktualisiert werden, neu laden
  useEffect(() => {
    if (isDefaultDataFlights && flightsGlobalCsv) {
      const parsed = parseCSV(flightsGlobalCsv);
      setData(parsed);
      setDisabledRoutes([]);
      const countries = [...new Set(parsed.map(d => d.originCountry))].sort();
      setAvailableCountries(countries);
      setActiveCountries(countries); // Alle auswählen
      const destCountries = [...new Set(parsed.map(d => d.destCountry))].sort();
      setAvailableDestCountries(destCountries);
      setActiveDestCountries(destCountries); // Alle auswählen
    }
  }, [flightsGlobalCsv, isDefaultDataFlights]);

  useEffect(() => {
    if (isDefaultDataAcc && accGlobalCurrCsv && accGlobalPrevCsv) {
      const curr = parseAccCSV(accGlobalCurrCsv);
      const prev = parseAccCSV(accGlobalPrevCsv);
      setAccData(mergeAccData(curr, prev));
    }
  }, [accGlobalCurrCsv, accGlobalPrevCsv, isDefaultDataAcc]);

  const initDefaultFlights = () => { setIsDefaultDataFlights(true); setCustomFlightDate(""); };
  const initDefaultAcc = () => { setIsDefaultDataAcc(true); setCustomAccDate(""); };


  // ==========================================
  // 4. ADMIN SPEICHERN (FIREBASE WRITE)
  // ==========================================
  const handleAdminSaveFlights = async () => {
    if (!user || !isFirebaseReady || !appId) return alert("Firebase nicht verbunden!");
    if (!adminFlightCsv) return alert("Bitte eine Datei auswählen!");
    setIsSaving(true);
    try {
      const text = await adminFlightCsv.text();
      await setDoc(getSafeDocRef(db, appId, 'appConfig', 'flights'), {
        csv: text,
        lastUpdated: formatD(adminFlightDate) || "Heute"
      });
      setIsAdminPanelOpen(false);
      setAdminFlightCsv(null);
    } catch(err) { console.error(err); alert("Fehler beim Speichern!"); }
    setIsSaving(false);
  };

  const handleAdminSaveAcc = async () => {
    if (!user || !isFirebaseReady || !appId) return alert("Firebase nicht verbunden!");
    if (!adminAccCurrCsv || !adminAccPrevCsv) return alert("Bitte BEIDE Dateien auswählen!");
    setIsSaving(true);
    try {
      const textCurr = await adminAccCurrCsv.text();
      const textPrev = await adminAccPrevCsv.text();
      
      const l1 = formatRange(adminAccDate1Start, adminAccDate1End, "Aktuell");
      const l2 = formatRange(adminAccDate2Start, adminAccDate2End, "Vorher");

      await setDoc(getSafeDocRef(db, appId, 'appConfig', 'accommodations'), {
        currentCsv: textCurr,
        prevCsv: textPrev,
        lastUpdated: `${l1} vs ${l2}`
      });
      setIsAdminPanelOpen(false);
      setAdminAccCurrCsv(null);
      setAdminAccPrevCsv(null);
    } catch(err) { console.error(err); alert("Fehler beim Speichern!"); }
    setIsSaving(false);
  };

  // --- USER DIY MODAL HANDLER ---
  const applyCustomFlights = async () => {
    if(!tempFlightFile) return;
    const text = await tempFlightFile.text();
    setIsDefaultDataFlights(false);
    setCustomFlightDate(formatD(tempFlightDate) || "Manuelles Datum");
    const parsed = parseCSV(text);
    setData(parsed);
    // UI Update Filter...
    const countries = [...new Set(parsed.map(d => d.originCountry))].sort();
    setAvailableCountries(countries);
    setActiveCountries(countries);
    const destCountries = [...new Set(parsed.map(d => d.destCountry))].sort();
    setAvailableDestCountries(destCountries);
    setActiveDestCountries(destCountries);
    setIsDiyModalOpen(false);
  };

  const applyCustomAcc = async () => {
    if(!tempAccCurrent || !tempAccPrevious) return;
    const textCurr = await tempAccCurrent.text();
    const textPrev = await tempAccPrevious.text();
    const currRaw = parseAccCSV(textCurr);
    const prevRaw = parseAccCSV(textPrev);
    setAccData(mergeAccData(currRaw, prevRaw));
    
    const l1 = formatRange(tempAccDate1Start, tempAccDate1End, "Aktuell");
    const l2 = formatRange(tempAccDate2Start, tempAccDate2End, "Vorher");
    setCustomAccDate(`${l1} vs ${l2}`);
    
    setIsDefaultDataAcc(false);
    setIsDiyModalOpen(false);
  };


  // --- BERECHNUNGEN FÜR UI ---
  const validDestCountries = useMemo(() => {
    const valid = new Set();
    data.forEach(row => { if (activeCountries.includes(row.originCountry)) valid.add(row.destCountry); });
    return Array.from(valid);
  }, [data, activeCountries]);

  const destByContinent = useMemo(() => {
    const groups = {};
    availableDestCountries.forEach(country => {
      const cont = COUNTRY_TO_CONTINENT[country] || 'Sonstige';
      if (!groups[cont]) groups[cont] = [];
      groups[cont].push(country);
    });
    return groups;
  }, [availableDestCountries]);

  const maxPossibleAdOpp = useMemo(() => {
    if (data.length === 0) return 100000;
    let max = 0;
    data.forEach(d => {
      let val = timeframe === '84d' ? d.d84_ad : (timeframe === '28d' ? d.d28_ad : d.d7_ad);
      if (val > max) max = val;
    });
    return max > 0 ? Math.ceil(max / 10000) * 10000 : 100000;
  }, [data, timeframe]);

  const getTrendColor = (trend) => {
    if (trend <= -0.20) return '#dc2626'; 
    if (trend < 0) return '#fca5a5';      
    if (trend === 0) return '#94a3b8';    
    if (trend <= 0.20) return '#6ee7b7';  
    return '#10b981';                     
  };

  // --- ECHARTS RENDERING ---
  useEffect(() => {
    if (!echartsReady || !chartRef.current) return;
    if (!chartInstance.current) chartInstance.current = window.echarts.init(chartRef.current);

    let option = {};

    if (activeTab === 'flights' && data.length > 0) {
      const activeDataRaw = data.filter(r => !disabledRoutes.includes(r.routeId) && activeCountries.includes(r.originCountry) && activeDestCountries.includes(r.destCountry));
      let minAd = Infinity, maxAd = -Infinity;
      const activeMinAdOpp = Number(minAdOppFilter) || 0;

      const currentData = activeDataRaw.map(row => {
        let adOpp, trend, trendLabel;
        if (timeframe === '84d') { adOpp = row.d84_ad; trend = row.d84_yoy; trendLabel = 'Vorjahr (YoY)'; } 
        else if (timeframe === '28d') { adOpp = row.d28_ad; trend = trendType === 'yoy' ? row.d28_yoy : row.d28_mom; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorperiode (MoM)'; } 
        else { adOpp = row.d7_ad; trend = trendType === 'yoy' ? row.d7_yoy : row.d7_wow; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorwoche (WoW)'; }
        if (adOpp < minAd) minAd = adOpp;
        if (adOpp > maxAd) maxAd = adOpp;
        return { ...row, currentAdOpp: adOpp, currentTrend: trend, trendLabel };
      }).filter(row => row.currentAdOpp > 0 && row.currentAdOpp >= activeMinAdOpp); 

      if (minAd === maxAd) minAd = 0;

      const lineData = currentData.map(row => {
        const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.currentAdOpp - minAd) / (maxAd - minAd))) : 3;
        return { coords: [CITY_COORDS[row.originCity], CITY_COORDS[row.destCity]], lineStyle: { width: width, color: getTrendColor(row.currentTrend), curveness: 0.2 }, details: row };
      });

      const scatterData = [];
      currentData.forEach(row => {
        if (!scatterData.find(s => s.name === row.originCity)) scatterData.push({ name: row.originCity, value: CITY_COORDS[row.originCity] });
        if (!scatterData.find(s => s.name === row.destCity)) scatterData.push({ name: row.destCity, value: CITY_COORDS[row.destCity] });
      });

      option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item', enterable: true, hideDelay: 1500, confine: true,
          backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' },
          formatter: (params) => {
            if (params.seriesType === 'lines') {
              const d = params.data.details;
              const trendPercent = (d.currentTrend * 100).toFixed(1);
              const sign = d.currentTrend > 0 ? '+' : '';
              const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(d.originCity)}%20to%20${encodeURIComponent(d.destCity)}`;
              return `<div style="font-weight:600; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center;">${getFlagImgHtml(d.originCountry)}<span style="vertical-align:middle;">${d.originCity}</span><span style="margin: 0 6px;">➔</span>${getFlagImgHtml(d.destCountry)}<span style="vertical-align:middle;">${d.destCity}</span></div><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:#94a3b8; margin-right: 12px;">Interesse:</span><span style="font-weight:bold">${d.currentAdOpp.toLocaleString('de-DE')}</span></div><div style="display:flex; justify-content:space-between; margin-bottom: 8px;"><span style="color:#94a3b8; margin-right: 12px;">Trend (${d.trendLabel}):</span><span style="font-weight:bold; color:${getTrendColor(d.currentTrend)}">${sign}${trendPercent}%</span></div><div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #334155; text-align: center;"><a href="${googleFlightsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 500;">✈️ Aktuelle Preise prüfen</a></div>`;
            }
            return params.name;
          }
        },
        geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 } },
        series: [
          { type: 'lines', coordinateSystem: 'geo', zlevel: 2, effect: { show: true, period: 6, trailLength: 0, symbol: PLANE_PATH, symbolSize: 15 }, lineStyle: { opacity: 0.6 }, data: lineData },
          { type: 'scatter', coordinateSystem: 'geo', zlevel: 3, symbolSize: 5, silent: true, itemStyle: { color: '#cbd5e1' }, label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#94a3b8', fontSize: 10 } }, data: scatterData }
        ]
      };

    } else if (activeTab === 'accommodations' && accData.length > 0) {
      // 🛏️ ACCOMMODATIONS
      const filteredData = accData.filter(r => 
        (accFilterType === 'All' || r.type === accFilterType) &&
        activeAccCountries.includes(r.userCountry)
      );
      
      let minAd = Infinity, maxAd = -Infinity;
      filteredData.forEach(row => { if (row.adOpp < minAd) minAd = row.adOpp; if (row.adOpp > maxAd) maxAd = row.adOpp; });
      if (minAd === maxAd) minAd = 0;

      const lineData = [];
      const originScatter = [];
      const regionAgg = {};

      filteredData.forEach(row => {
        const originCoord = COUNTRY_CENTER_COORDS[row.userCountry] || [0,0];
        const destCoord = REGION_COORDS[row.destRegion] || COUNTRY_CENTER_COORDS[row.destCountry] || [0,0];
        
        if(originCoord[0] !== 0 && destCoord[0] !== 0) {
          const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.adOpp - minAd) / (maxAd - minAd))) : 3;
          lineData.push({ coords: [originCoord, destCoord], lineStyle: { width: width, color: getTrendColor(row.trend), curveness: 0.2 }, details: row });
          if (!originScatter.find(s => s.name === row.userCountry)) originScatter.push({ name: row.userCountry, value: originCoord });

          if(!regionAgg[row.destRegion]) regionAgg[row.destRegion] = { country: row.destCountry, coord: destCoord, adOpp: 0, prevAdOpp: 0 };
          regionAgg[row.destRegion].adOpp += row.adOpp;
          regionAgg[row.destRegion].prevAdOpp += row.prevAdOpp;
        }
      });

      const destHotspots = Object.keys(regionAgg).map(reg => {
         const data = regionAgg[reg];
         const regWow = data.prevAdOpp > 0 ? (data.adOpp - data.prevAdOpp) / data.prevAdOpp : 0;
         return { name: reg, value: data.coord, country: data.country, adOpp: data.adOpp, trend: regWow, isDest: true };
      });

      option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item', enterable: true, hideDelay: 1500, confine: true,
          backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' },
          formatter: (params) => {
            if (params.seriesType === 'effectScatter' && params.data.isDest) {
              const d = params.data;
              const trendPercent = (d.trend * 100).toFixed(1);
              const sign = d.trend > 0 ? '+' : '';
              return `<div style="font-weight:600; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #334155; padding-bottom: 8px;">📍 Region: <span style="color: #818cf8;">${d.name}</span> (${getFlagImgHtml(d.country)}${COUNTRY_NAMES[d.country] || d.country})</div><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:#94a3b8; margin-right: 12px;">Interesse (Gesamt):</span><span style="font-weight:bold">${d.adOpp.toLocaleString('de-DE')}</span></div><div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span style="color:#94a3b8; margin-right: 12px;">Regionaler Trend:</span><span style="font-weight:bold; color:${getTrendColor(d.trend)}">${sign}${trendPercent}%</span></div>`;
            }
            if (params.seriesType === 'lines') {
              const d = params.data.details;
              const trendPercent = (d.trend * 100).toFixed(1);
              const sign = d.trend > 0 ? '+' : '';
              return `<div style="font-weight:600; margin-bottom: 8px; font-size: 12px; display: flex; align-items: center;">${getFlagImgHtml(d.userCountry)}<span style="vertical-align:middle;">${COUNTRY_NAMES[d.userCountry] || d.userCountry}</span><span style="margin: 0 6px;">➔</span>${getFlagImgHtml(d.destCountry)}<span style="vertical-align:middle;">${d.destRegion}</span></div><div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size: 11px;"><span style="color:#94a3b8; margin-right: 12px;">Interesse:</span><span style="font-weight:bold">${d.adOpp.toLocaleString('de-DE')}</span></div><div style="display:flex; justify-content:space-between; font-size: 11px;"><span style="color:#94a3b8; margin-right: 12px;">Trend:</span><span style="font-weight:bold; color:${getTrendColor(d.trend)}">${sign}${trendPercent}%</span></div>`;
            }
            return params.name;
          }
        },
        geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 } },
        series: [
          { type: 'lines', coordinateSystem: 'geo', zlevel: 2, effect: { show: true, period: 6, trailLength: 0, symbol: 'circle', symbolSize: 4 }, lineStyle: { opacity: 0.6 }, data: lineData },
          { type: 'scatter', coordinateSystem: 'geo', zlevel: 3, symbolSize: 5, silent: true, itemStyle: { color: '#94a3b8' }, label: { show: true, position: 'left', formatter: '{b}', textStyle: { color: '#64748b', fontSize: 9 } }, data: originScatter },
          { type: 'effectScatter', coordinateSystem: 'geo', zlevel: 4, symbolSize: (val, params) => { if(maxAd === minAd) return 10; return 8 + 15 * ((params.data.adOpp - minAd) / (maxAd - minAd)); }, itemStyle: { color: (params) => getTrendColor(params.data.trend), shadowBlur: 10, shadowColor: '#000' }, label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold', textShadowColor: '#000', textShadowBlur: 3 } }, data: destHotspots }
        ]
      };
    } else {
      option = { backgroundColor: 'transparent', geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 } } };
    }

    chartInstance.current.setOption(option, { replaceMerge: ['series'] }); 
    chartInstance.current.off('click'); 
    if (activeTab === 'flights') {
      chartInstance.current.on('click', function(params) {
        if (params.componentType === 'series' && params.seriesType === 'lines') {
          const routeId = params.data.details.routeId;
          if (!disabledRoutes.includes(routeId)) setDisabledRoutes(prev => [...prev, routeId]);
        }
      });
    }

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, timeframe, trendType, echartsReady, disabledRoutes, activeCountries, activeDestCountries, minAdOppFilter, activeTab, accData, accFilterType, activeAccCountries]);

  const toggleDisabledRoute = (routeId) => setDisabledRoutes(prev => prev.filter(id => id !== routeId));
  const toggleCountry = (country) => setActiveCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const toggleDestCountry = (country) => setActiveDestCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const toggleAccCountry = (country) => setActiveAccCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const setContinentAll = (countriesInContinent) => setActiveDestCountries(prev => { const newSet = new Set(prev); countriesInContinent.forEach(c => newSet.add(c)); return Array.from(newSet); });
  const setContinentNone = (countriesInContinent) => setActiveDestCountries(prev => prev.filter(c => !countriesInContinent.includes(c)));

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-sans relative overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col z-10 shadow-xl">
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* LOGO: NEUER GEHEIMER ADMIN-ZUGANG (Doppelklick) */}
          <div 
            className="flex items-center gap-3 mb-4 cursor-pointer select-none" 
            onDoubleClick={() => setIsAdminPanelOpen(true)}
            title=" "
          >
            <MapIcon className="text-blue-400 w-8 h-8 shrink-0" />
            <h1 className="text-xl font-bold text-white leading-tight">TAC<br/><span className="text-sm font-normal text-slate-400">Travel Trends</span></h1>
          </div>

          {/* HERAUSGESTELLTES DATUM (STICHTAG / ZEITRAUM) */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 mb-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${!isFirebaseReady ? 'bg-red-500' : 'bg-blue-500'}`}></div>
            <div className="flex justify-between items-start pl-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                  {activeTab === 'flights' ? 'Analyse-Stichtag' : 'Analyse-Zeitraum'}
                </p>
                <p className="text-sm font-medium text-slate-200">
                  {activeTab === 'flights' 
                    ? (isDefaultDataFlights ? flightsGlobalDate : customFlightDate)
                    : (isDefaultDataAcc ? accGlobalDate : customAccDate)
                  }
                </p>
              </div>
              {((activeTab === 'flights' && !isDefaultDataFlights) || (activeTab === 'accommodations' && !isDefaultDataAcc)) && (
                <button onClick={activeTab === 'flights' ? initDefaultFlights : initDefaultAcc} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1.5 rounded transition-colors" title="Zurück zu Standard-Daten">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!isFirebaseReady && <p className="text-[9px] text-red-400 mt-2 pl-2">Datenbank (Firebase) offline/nicht konfiguriert. Prüfe Vercel Env Vars.</p>}
          </div>

          {/* TAB-STEUERUNG */}
          <div className="flex bg-slate-900 rounded-lg p-1 mb-6 border border-slate-700">
            <button onClick={() => setActiveTab('flights')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'flights' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <span>✈️</span> Flüge
            </button>
            <button onClick={() => setActiveTab('accommodations')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'accommodations' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <Bed className="w-4 h-4" /> Unterkünfte
            </button>
          </div>
          
          {/* FILTER BEREICH (FLÜGE) */}
          {activeTab === 'flights' && (
            <>
              {availableCountries.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Filter className="w-4 h-4" /> Abflugland</h2>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveCountries([...availableCountries])} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">Alle</button>
                      <span className="text-[10px] text-slate-500">|</span>
                      <button onClick={() => setActiveCountries([])} className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors">Keines</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {availableCountries.map(country => (
                      <button key={country} onClick={() => toggleCountry(country)} title={COUNTRY_NAMES[country] || country} className={`w-full flex justify-center items-center py-1.5 rounded transition-colors border ${activeCountries.includes(country) ? 'bg-blue-600/20 border-blue-500 opacity-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-50 grayscale'}`}>
                        <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableDestCountries.length > 0 && (
                <div className="mb-6 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => setIsDestExpanded(!isDestExpanded)}>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Filter className="w-4 h-4" /> Zielland</h2>
                    {isDestExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                  {isDestExpanded && (
                    <div className="p-3 pt-0 border-t border-slate-700/50 mt-1">
                      {Object.keys(destByContinent).sort().map(continent => (
                        <div key={continent} className="mb-4 last:mb-0">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-semibold text-slate-300">{continent}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setContinentAll(destByContinent[continent])} className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">Alle</button>
                              <span className="text-[10px] text-slate-500">|</span>
                              <button onClick={() => setContinentNone(destByContinent[continent])} className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors">Keines</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {destByContinent[continent].map(country => {
                              const isValid = validDestCountries.includes(country); 
                              return (
                                <button key={`dest-${country}`} onClick={() => isValid && toggleDestCountry(country)} title={!isValid ? `${COUNTRY_NAMES[country] || country} (Keine Routen)` : (COUNTRY_NAMES[country] || country)} className={`w-full flex justify-center items-center py-1.5 rounded transition-colors border ${!isValid ? 'opacity-10 cursor-not-allowed bg-slate-900 border-slate-800 grayscale' : activeDestCountries.includes(country) ? 'bg-emerald-600/20 border-emerald-500 opacity-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-50 grayscale'}`}>
                                  <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Min. Interesse</h2>
                <div className="flex items-center gap-2 mb-3">
                  <input type="number" min="0" value={minAdOppFilter} onChange={(e) => setMinAdOppFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10).toString())} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors" placeholder="Exakter Wert..." />
                </div>
                <div className="flex flex-col gap-2">
                  <input type="range" min="0" max={maxPossibleAdOpp} step="5000" value={minAdOppFilter === '' ? 0 : minAdOppFilter} onChange={(e) => setMinAdOppFilter(e.target.value)} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1"><span>0</span><span>Max: {maxPossibleAdOpp.toLocaleString('de-DE')}</span></div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Zeitraum</h2>
                <div className="flex flex-col gap-2">
                  {[{ id: '84d', label: 'Letzte 84 Tage' }, { id: '28d', label: 'Letzte 28 Tage' }, { id: '7d', label: 'Letzte 7 Tage' }].map(opt => (
                    <button key={opt.id} onClick={() => setTimeframe(opt.id)} className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${timeframe === opt.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Vergleichszeitraum</h2>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setTrendType('yoy')} className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${trendType === 'yoy' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>Vorjahr (YoY)</button>
                  <button onClick={() => setTrendType('mom_wow')} disabled={timeframe === '84d'} className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${timeframe === '84d' ? 'opacity-50 cursor-not-allowed bg-slate-800/50 text-slate-500 border-slate-800' : trendType === 'mom_wow' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>Vorperiode (MoM / WoW)</button>
                </div>
              </div>

              {disabledRoutes.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><EyeOff className="w-4 h-4" /> Ausgeblendete Routen</h2>
                  <div className="flex flex-col gap-1.5">
                    {disabledRoutes.map(routeId => (
                      <button key={routeId} onClick={() => toggleDisabledRoute(routeId)} className="flex items-center justify-between px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-300 transition-colors group">
                        <span>{routeId}</span><XCircle className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* FILTER BEREICH (UNTERKÜNFTE) */}
          {activeTab === 'accommodations' && accData.length > 0 && (
            <>
              {availableAccCountries.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Filter className="w-4 h-4" /> Ursprungsland</h2>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveAccCountries([...availableAccCountries])} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Alle</button>
                      <span className="text-[10px] text-slate-500">|</span>
                      <button onClick={() => setActiveAccCountries([])} className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors">Keines</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {availableAccCountries.map(country => (
                      <button key={country} onClick={() => toggleAccCountry(country)} title={COUNTRY_NAMES[country] || country} className={`w-full flex justify-center items-center py-1.5 rounded transition-colors border ${activeAccCountries.includes(country) ? 'bg-indigo-600/20 border-indigo-500 opacity-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-50 grayscale'}`}>
                        <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Filter className="w-4 h-4" /> Reisetyp</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setAccFilterType('All')} className={`text-[10px] transition-colors ${accFilterType === 'All' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-300'}`}>Alle</button>
                    <span className="text-[10px] text-slate-500">|</span>
                    <button onClick={() => setAccFilterType('Domestic')} className={`text-[10px] transition-colors ${accFilterType === 'Domestic' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-300'}`}>Domestic</button>
                    <span className="text-[10px] text-slate-500">|</span>
                    <button onClick={() => setAccFilterType('International')} className={`text-[10px] transition-colors ${accFilterType === 'International' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-300'}`}>International</button>
                  </div>
                </div>
              </div>
              
              <div className="text-center p-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg mb-6">
                <p className="text-sm text-emerald-400 font-semibold">
                  {accData.filter(r => (accFilterType === 'All' || r.type === accFilterType) && activeAccCountries.includes(r.userCountry)).length} Routen berechnet
                </p>
                <p className="text-xs text-slate-400 mt-1">Gehe mit der Maus über die pulsierenden Regionen, um Details zu sehen.</p>
              </div>
            </>
          )}

          {/* Gemeinsame Legende */}
          <div className="mt-6 mb-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Legende</h2>
            <div className="mb-4">
              <p className="text-xs text-slate-300 mb-2">Trend (Farbe)</p>
              <div className="flex h-3 w-full rounded-full overflow-hidden">
                <div className="bg-[#dc2626] flex-1"></div>
                <div className="bg-[#fca5a5] flex-1"></div>
                <div className="bg-[#94a3b8] flex-1"></div>
                <div className="bg-[#6ee7b7] flex-1"></div>
                <div className="bg-[#10b981] flex-1"></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>Negativ</span><span>Neutral</span><span>Positiv</span></div>
            </div>
            <div>
              <p className="text-xs text-slate-300 mb-2">Interesse (Dicke)</p>
              <div className="flex items-center gap-2">
                <div className="h-[1.5px] w-8 bg-slate-400 rounded-full"></div>
                <span className="text-[10px] text-slate-400 flex-1 text-center">bis</span>
                <div className="h-[5px] w-12 bg-slate-400 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* PRO WORKSPACE (Versteckt als kleines Badge) */}
        <div className="p-3 border-t border-slate-700 bg-slate-800/80 flex justify-between items-center mt-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-medium">TAC Data Core</span>
            <button 
              onClick={() => setIsDiyModalOpen(true)} 
              className="w-2.5 h-2.5 rounded-full bg-orange-500/80 hover:bg-orange-400 hover:shadow-[0_0_8px_rgba(249,115,22,0.8)] cursor-pointer transition-all" 
              title="Pro Workspace (DIY Analytics)"
            />
          </div>
          <span className="text-[10px] text-slate-600">v1.3</span>
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div className="flex-1 relative">
        {!echartsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
            <div className="text-center animate-pulse text-indigo-400 flex flex-col items-center">
              <MapIcon className="w-12 h-12 mb-3" />
              <p>Lade Weltkarte & Visualisierung...</p>
            </div>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" style={{ visibility: echartsReady ? 'visible' : 'hidden' }} />
      </div>


      {/* ========================================== */}
      {/* 🚀 ADMIN PANEL (Geheim: Doppelklick aufs Logo) */}
      {/* ========================================== */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            
            <div className="flex justify-between items-center p-5 border-b border-red-900/50 bg-red-950/20">
              <div className="flex items-center gap-3">
                <Lock className="text-red-500 w-6 h-6" />
                <h2 className="text-xl font-bold text-white">Live-Daten aktualisieren (Admin)</h2>
              </div>
              <button onClick={() => setIsAdminPanelOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
              {!isFirebaseReady ? (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded text-red-200 text-sm">
                  <strong>⚠️ Firebase ist nicht konfiguriert.</strong> Du musst erst deine Umgebungsvariablen in Vercel hinterlegen, bevor du Daten live speichern kannst.
                </div>
              ) : (
                <>
                  {/* FLÜGE ADMIN */}
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-4"><span>✈️</span> Flüge (Datenbank)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Neuer Stichtag</label>
                        <input type="date" value={adminFlightDate} onChange={(e) => setAdminFlightDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">Neue CSV Datei</label>
                        <label className={`flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded cursor-pointer transition-colors ${adminFlightCsv ? 'border-emerald-500 bg-emerald-500/10' : 'border-blue-500/50 hover:border-blue-400 hover:bg-slate-700'}`}>
                          {adminFlightCsv ? (
                            <div className="flex items-center gap-2 text-emerald-400">
                              <CheckCircle className="w-5 h-5" />
                              <span className="text-xs font-medium">{adminFlightCsv.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-300">
                              <Upload className="w-5 h-5 text-blue-400" />
                              <span className="text-xs font-medium">Klicken zum Auswählen</span>
                            </div>
                          )}
                          <input type="file" accept=".csv" className="hidden" onChange={(e) => setAdminFlightCsv(e.target.files[0])} />
                        </label>
                      </div>
                      <button onClick={handleAdminSaveFlights} disabled={isSaving || !adminFlightCsv} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded flex items-center justify-center gap-2 transition-colors">
                        <CloudUpload className="w-4 h-4"/> Für alle Nutzer speichern
                      </button>
                    </div>
                  </div>

                  {/* UNTERKÜNFTE ADMIN */}
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2 mb-4"><Bed className="w-5 h-5"/> Unterkünfte (Datenbank)</h3>
                    <div className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Zeitraum Aktuell (Current)</label>
                          <div className="flex gap-2 mb-3">
                             <input type="date" value={adminAccDate1Start} onChange={(e) => setAdminAccDate1Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Von" />
                             <input type="date" value={adminAccDate1End} onChange={(e) => setAdminAccDate1End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Bis" />
                          </div>
                          <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${adminAccCurrCsv ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-500/50 hover:border-indigo-400 hover:bg-slate-700'}`}>
                            {adminAccCurrCsv ? (
                              <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-[10px] font-medium break-all px-1">{adminAccCurrCsv.name}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-300">
                                <Upload className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-medium">CSV Datei wählen</span>
                              </div>
                            )}
                            <input type="file" accept=".csv" className="hidden" onChange={(e) => setAdminAccCurrCsv(e.target.files[0])} />
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Zeitraum Vorher (Previous)</label>
                          <div className="flex gap-2 mb-3">
                             <input type="date" value={adminAccDate2Start} onChange={(e) => setAdminAccDate2Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Von" />
                             <input type="date" value={adminAccDate2End} onChange={(e) => setAdminAccDate2End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Bis" />
                          </div>
                          <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${adminAccPrevCsv ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-500/50 hover:border-indigo-400 hover:bg-slate-700'}`}>
                            {adminAccPrevCsv ? (
                              <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-[10px] font-medium break-all px-1">{adminAccPrevCsv.name}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-300">
                                <Upload className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-medium">CSV Datei wählen</span>
                              </div>
                            )}
                            <input type="file" accept=".csv" className="hidden" onChange={(e) => setAdminAccPrevCsv(e.target.files[0])} />
                          </label>
                        </div>
                      </div>
                      <button onClick={handleAdminSaveAcc} disabled={isSaving || !adminAccCurrCsv || !adminAccPrevCsv} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded flex items-center justify-center gap-2 transition-colors">
                        <CloudUpload className="w-4 h-4"/> Für alle Nutzer speichern
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ========================================== */}
      {/* 🚀 USER DIY MODAL (Pro Workspace)            */}
      {/* ========================================== */}
      {isDiyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-3">
                <Database className="text-orange-400 w-6 h-6" />
                <h2 className="text-xl font-bold text-white">Eigene Daten analysieren</h2>
              </div>
              <button onClick={() => setIsDiyModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <p className="text-sm text-slate-400 mb-6">Hier kannst du temporär eigene CSV-Exporte hochladen und auswerten. Die ausgewählten Kalenderdaten dienen lediglich der Beschriftung im Dashboard.</p>
              
              {activeTab === 'flights' ? (
                <div className="space-y-5">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">1. Stichtag auswählen</label>
                    <input type="date" value={tempFlightDate} onChange={(e) => setTempFlightDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2" />
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">2. CSV-Datei hochladen</label>
                    <label className={`flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded cursor-pointer transition-colors ${tempFlightFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-orange-500/50 hover:border-orange-400 hover:bg-slate-700'}`}>
                      {tempFlightFile ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">{tempFlightFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-300">
                          <Upload className="w-5 h-5 text-orange-400" />
                          <span className="text-xs font-medium">Klicken zum Auswählen</span>
                        </div>
                      )}
                      <input type="file" accept=".csv" className="hidden" onChange={(e) => setTempFlightFile(e.target.files[0])} />
                    </label>
                  </div>
                  <button onClick={applyCustomFlights} disabled={!tempFlightFile} className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors mt-4">Daten laden</button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <label className="block text-sm font-semibold text-slate-300 mb-1">Zeitraum Aktuell (Current)</label>
                      <div className="flex gap-2 mb-3">
                         <input type="date" value={tempAccDate1Start} onChange={(e) => setTempAccDate1Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Von" />
                         <input type="date" value={tempAccDate1End} onChange={(e) => setTempAccDate1End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Bis" />
                      </div>
                      <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${tempAccCurrent ? 'border-emerald-500 bg-emerald-500/10' : 'border-orange-500/50 hover:border-orange-400 hover:bg-slate-700'}`}>
                        {tempAccCurrent ? (
                          <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-[10px] font-medium break-all px-1">{tempAccCurrent.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-300">
                            <Upload className="w-4 h-4 text-orange-400" />
                            <span className="text-[10px] font-medium">CSV Datei wählen</span>
                          </div>
                        )}
                        <input type="file" accept=".csv" className="hidden" onChange={(e) => setTempAccCurrent(e.target.files[0])} />
                      </label>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <label className="block text-sm font-semibold text-slate-300 mb-1">Zeitraum Vorher (Previous)</label>
                      <div className="flex gap-2 mb-3">
                         <input type="date" value={tempAccDate2Start} onChange={(e) => setTempAccDate2Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Von" />
                         <input type="date" value={tempAccDate2End} onChange={(e) => setTempAccDate2End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-2" title="Bis" />
                      </div>
                      <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${tempAccPrevious ? 'border-emerald-500 bg-emerald-500/10' : 'border-orange-500/50 hover:border-orange-400 hover:bg-slate-700'}`}>
                        {tempAccPrevious ? (
                          <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-[10px] font-medium break-all px-1">{tempAccPrevious.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-300">
                            <Upload className="w-4 h-4 text-orange-400" />
                            <span className="text-[10px] font-medium">CSV Datei wählen</span>
                          </div>
                        )}
                        <input type="file" accept=".csv" className="hidden" onChange={(e) => setTempAccPrevious(e.target.files[0])} />
                      </label>
                    </div>
                  </div>
                  <button onClick={applyCustomAcc} disabled={!tempAccCurrent || !tempAccPrevious} className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors">Berechnung starten</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; filter: invert(0.8); }
      `}} />
    </div>
  );
}
