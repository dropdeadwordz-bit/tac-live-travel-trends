import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Map as MapIcon, Calendar, TrendingUp, TrendingDown, XCircle, EyeOff, Filter, SlidersHorizontal, ChevronDown, ChevronUp, Bed, CheckCircle, RefreshCw, Lock, Database, X, CloudUpload, Search, Trophy, Info } from 'lucide-react';

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

const getSafeDocRef = (firestoreDb, targetAppId, collectionName, documentId) => {
  const fullPath = `artifacts/${targetAppId}/public/data/${collectionName}/${documentId}`;
  const segmentsCount = fullPath.split('/').filter(Boolean).length;
  if (segmentsCount % 2 !== 0) return doc(firestoreDb, `${fullPath}/_doc`);
  return doc(firestoreDb, fullPath);
};

// --- HILFSFUNKTIONEN FÜR DATEN & KOORDINATEN ---
const formatD = (str) => {
  if(!str) return "";
  const parts = str.split('-'); 
  if(parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return str;
};

const formatRange = (start, end, fallback) => {
  const s = formatD(start);
  const e = formatD(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  if (e) return e;
  return fallback;
};

const getPreviousWeekDates = (weeksAgo) => {
  const d = new Date();
  const day = d.getDay() === 0 ? 7 : d.getDay(); 
  d.setDate(d.getDate() - day); 
  d.setDate(d.getDate() - (weeksAgo - 1) * 7); 
  const end = new Date(d);
  const start = new Date(d);
  start.setDate(start.getDate() - 6); 
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

const get30DayDates = () => {
  const d = new Date();
  const day = d.getDay() === 0 ? 7 : d.getDay(); 
  d.setDate(d.getDate() - day); 
  const end1 = new Date(d);
  const start1 = new Date(d);
  start1.setDate(start1.getDate() - 29);
  
  const end2 = new Date(start1);
  end2.setDate(end2.getDate() - 1);
  const start2 = new Date(end2);
  start2.setDate(start2.getDate() - 29);
  
  return {
    cStart: start1.toISOString().split('T')[0],
    cEnd: end1.toISOString().split('T')[0],
    pStart: start2.toISOString().split('T')[0],
    pEnd: end2.toISOString().split('T')[0]
  };
};

const lastWeekDates = getPreviousWeekDates(1);
const twoWeeksAgoDates = getPreviousWeekDates(2);
const dates30 = get30DayDates();

const getFallbackCoord = (str, baseCoord) => {
  if(!str) return baseCoord || [0,0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  if (baseCoord) {
    const offsetLon = ((Math.abs(hash) % 100) / 250) - 0.2; 
    const offsetLat = (((Math.abs(hash) >> 5) % 100) / 250) - 0.2;
    return [baseCoord[0] + offsetLon, baseCoord[1] + offsetLat];
  }
  const lon = -40 + (Math.abs(hash) % 20); 
  const lat = 10 + ((Math.abs(hash) >> 5) % 30);
  return [lon, lat];
};

// ==========================================
// 🛠️ FALLBACK-DATEN (Wenn DB leer/offline)
// ==========================================
const DEFAULT_FLIGHTS_CSV = `Route,,,Last 84 Days,,Last 28 Days,,,Last 7 Days,,
Origin,Destination,Route ID,Ad Opp.,YoY,Ad Opp.,MoM,YoY,Ad Opp.,WoW,YoY
GB - London,ES - Barcelona,LON-BCN,700000,0.263,200000,-0.397,0.094,30000,-0.239,-0.419
US - New York,GB - London,NYC-LON,500000,-0.008,200000,0.597,0.33,40000,-0.053,-0.126
DE - Frankfurt,ES - Palma de Mallorca,FRA-PMI,200000,-0.128,60000,-0.047,-0.165,20000,0.031,-0.133`;

const DEFAULT_ACC_CURRENT_CSV = `User Country,Destination Country,Destination Region,Domestic / Int'l,Ad Opp.
GB,GB,England,Domestic,7000000
US,ES,Andalusia,International,5000000
DE,DE,Bavaria,Domestic,1000000`;

const DEFAULT_ACC_PREVIOUS_CSV = `User Country,Destination Country,Destination Region,Domestic / Int'l,Ad Opp.
GB,GB,England,Domestic,6800000
US,ES,Andalusia,International,4800000
DE,DE,Bavaria,Domestic,900000`;

const getFlagImgHtml = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '';
  return `<img src="https://flagcdn.com/w20/${countryCode.toLowerCase()}.png" style="width:16px; height:auto; display:inline-block; vertical-align:middle; border-radius:2px; margin-right:4px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);" alt="${countryCode}" />`;
};

// ==========================================
// 🔧 GLOBALE WÖRTERBÜCHER & KOORDINATEN
// ==========================================
const COUNTRY_NAMES = {
  "DE": "Deutschland", "AT": "Österreich", "CH": "Schweiz", "US": "USA", "GB": "Großbritannien",
  "FR": "Frankreich", "ES": "Spanien", "IT": "Italien", "NL": "Niederlande", "TR": "Türkei",
  "AE": "Ver. Arab. Emirate", "TH": "Thailand", "SG": "Singapur", "CZ": "Tschechien",
  "PR": "Puerto Rico", "BB": "Barbados", "BE": "Belgien", "HU": "Ungarn", "IL": "Israel",
  "CA": "Kanada", "BG": "Bulgarien", "IE": "Irland", "MX": "Mexiko", "VE": "Venezuela",
  "MA": "Marokko", "IN": "Indien", "DZ": "Algerien", "EG": "Ägypten", "ZA": "Südafrika",
  "GR": "Griechenland", "CY": "Zypern", "HR": "Kroatien", "PT": "Portugal", "JP": "Japan",
  "BR": "Brasilien", "CN": "China", "RU": "Russland", "UA": "Ukraine", "ID": "Indonesien",
  "SK": "Slowakei", "PL": "Polen", "LU": "Luxemburg", "SE": "Schweden", "NO": "Norwegen",
  "DK": "Dänemark", "FI": "Finnland", "RO": "Rumänien", "AU": "Australien", "NZ": "Neuseeland",
  "AR": "Argentinien", "CL": "Chile", "CO": "Kolumbien", "VN": "Vietnam", "MY": "Malaysia",
  "PH": "Philippinen", "KR": "Südkorea", "EE": "Estland", "LV": "Lettland", "LT": "Litauen",
  "RS": "Serbien", "BA": "Bosnien und Herzegowina", "AL": "Albanien", "MD": "Moldau", "MK": "Nordmazedonien",
  "HK": "Hongkong", "TW": "Taiwan", "MO": "Macau", "DO": "Dominik. Rep.", "JM": "Jamaika",
  "BS": "Bahamas", "CR": "Costa Rica", "PE": "Peru", "EC": "Ecuador", "BO": "Bolivien",
  "PY": "Paraguay", "UY": "Uruguay", "QA": "Katar", "KW": "Kuwait", "BH": "Bahrain",
  "JO": "Jordanien", "LB": "Libanon", "SY": "Syrien", "IQ": "Irak", "AF": "Afghanistan",
  "PK": "Pakistan", "BD": "Bangladesch", "LK": "Sri Lanka", "MV": "Malediven", "NP": "Nepal",
  "MM": "Myanmar", "KH": "Kambodscha", "LA": "Laos", "FJ": "Fidschi", "WS": "Samoa",
  "VU": "Vanuatu", "SB": "Salomonen", "TZ": "Tansania", "UG": "Uganda", "GH": "Ghana",
  "CI": "Elfenbeinküste", "AO": "Angola", "MZ": "Mosambik", "MG": "Madagaskar", "TN": "Tunesien",
  "SD": "Sudan", "SA": "Saudi-Arabien", "KE": "Kenia", "NG": "Nigeria", "SN": "Senegal",
  "CU": "Kuba", "PA": "Panama", "GU": "Guam", "VI": "Jungferninseln", "BM": "Bermuda",
  "KY": "Kaimaninseln", "TC": "Turks- & Caicosinseln", "AW": "Aruba", "CW": "Curaçao",
  "SX": "Sint Maarten", "IS": "Island", "OM": "Oman", "AG": "Antigua & Barbuda", "SV": "El Salvador",
  "NI": "Nicaragua", "LY": "Libyen", "DJ": "Dschibuti", "IR": "Iran", "TJ": "Tadschikistan",
  "BW": "Botswana", "NR": "Nauru", "FM": "Mikronesien", "KP": "Nordkorea", "PG": "Papua-Neuguinea"
};

const COUNTRY_TO_CONTINENT = {
  "DE": "Europa", "AT": "Europa", "CH": "Europa", "GB": "Europa", "FR": "Europa", "ES": "Europa", "IT": "Europa", "NL": "Europa", "CZ": "Europa", "BE": "Europa", "HU": "Europa", "BG": "Europa", "IE": "Europa", "GR": "Europa", "CY": "Europa", "MT": "Europa", "HR": "Europa", "IS": "Europa", "NO": "Europa", "SE": "Europa", "DK": "Europa", "FI": "Europa", "PL": "Europa", "RO": "Europa", "PT": "Europa", "UA": "Europa", "LU": "Europa", "SK": "Europa", "EE": "Europa", "LV": "Europa", "LT": "Europa", "RS": "Europa", "BA": "Europa", "AL": "Europa", "MD": "Europa", "MK": "Europa",
  "US": "Nord- & Mittelamerika", "CA": "Nord- & Mittelamerika", "MX": "Nord- & Mittelamerika", "PR": "Nord- & Mittelamerika", "BB": "Nord- & Mittelamerika", "DO": "Nord- & Mittelamerika", "JM": "Nord- & Mittelamerika", "BS": "Nord- & Mittelamerika", "CR": "Nord- & Mittelamerika", "CU": "Nord- & Mittelamerika", "PA": "Nord- & Mittelamerika",
  "BR": "Südamerika", "AR": "Südamerika", "CO": "Südamerika", "CL": "Südamerika", "PE": "Südamerika", "VE": "Südamerika", "EC": "Südamerika", "BO": "Südamerika", "PY": "Südamerika", "UY": "Südamerika",
  "TH": "Asien", "SG": "Asien", "IN": "Asien", "JP": "Asien", "CN": "Asien", "RU": "Asien", "ID": "Asien", "VN": "Asien", "MY": "Asien", "PH": "Asien", "KR": "Asien", "HK": "Asien", "TW": "Asien", "MO": "Asien", "AF": "Asien", "PK": "Asien", "BD": "Asien", "LK": "Asien", "MV": "Asien", "NP": "Asien", "MM": "Asien", "KH": "Asien", "LA": "Asien",
  "TR": "Naher Osten", "AE": "Naher Osten", "IL": "Naher Osten", "QA": "Naher Osten", "SA": "Naher Osten", "KW": "Naher Osten", "BH": "Naher Osten", "JO": "Naher Osten", "LB": "Naher Osten", "SY": "Naher Osten", "IQ": "Naher Osten", "OM": "Naher Osten", "IR": "Naher Osten",
  "EG": "Afrika", "ZA": "Afrika", "MA": "Afrika", "TZ": "Afrika", "UG": "Afrika", "GH": "Afrika", "CI": "Afrika", "AO": "Afrika", "MZ": "Afrika", "MG": "Afrika", "TN": "Afrika", "SD": "Afrika", "KE": "Afrika", "NG": "Afrika", "SN": "Afrika", "LY": "Afrika",
  "AU": "Ozeanien", "NZ": "Ozeanien", "FJ": "Ozeanien", "WS": "Ozeanien", "VU": "Ozeanien", "SB": "Ozeanien"
};

const CITY_COORDS = {
  "Frankfurt": [8.6821, 50.1109], "Berlin": [13.4050, 52.5200], "Munich": [11.5820, 48.1351], "München": [11.5820, 48.1351],
  "Vienna": [16.3738, 48.2082], "Wien": [16.3738, 48.2082], "Zürich": [8.5417, 47.3769], "Zurich": [8.5417, 47.3769],
  "Barcelona": [2.1734, 41.3851], "London": [-0.1278, 51.5074], "Paris": [2.3522, 48.8566],
  "Amsterdam": [4.9041, 52.3676], "Rotterdam": [4.4777, 51.9244], "Eindhoven": [5.4697, 51.4416],
  "Dubai": [55.2708, 25.2048], "New York": [-74.0060, 40.7128], "Washington": [-77.0369, 38.9072],
  "San Juan": [-66.1057, 18.4655], "Prague": [14.4378, 50.0755], "Prag": [14.4378, 50.0755],
  "İstanbul": [28.9784, 41.0082], "Istanbul": [28.9784, 41.0082], "Antalya": [30.7133, 36.8969],
  "Bridgetown": [-59.6167, 13.0968], "Brussels": [4.3517, 50.8503], "Brüssel": [4.3517, 50.8503],
  "Milan": [9.1900, 45.4642], "Mailand": [9.1900, 45.4642], "Rome": [12.4964, 41.9028], "Rom": [12.4964, 41.9028],
  "Budapest": [19.0402, 47.4979], "Bilbao": [-2.9350, 43.2630], "Tel Aviv-Yafo": [34.8000, 32.0833], "Tel Aviv": [34.8000, 32.0833],
  "Bangkok": [100.5018, 13.7563], "Palma de Mallorca": [2.6502, 39.5696], "Palma": [2.6502, 39.5696],
  "Madrid": [-3.7038, 40.4168], "Lisbon": [-9.1393, 38.7223], "Lissabon": [-9.1393, 38.7223],
  "Porto": [-8.6291, 41.1579], "Oporto": [-8.6291, 41.1579], "Faro": [-7.9304, 37.0194],
  "Madeira": [-16.9081, 32.6496], "Funchal": [-16.9081, 32.6496], "Ponta Delgada": [-25.6687, 37.7412],
  "Athens": [23.7275, 37.9838], "Athen": [23.7275, 37.9838], "Thessaloniki": [22.9444, 40.6401],
  "Copenhagen": [12.5683, 55.6761], "Kopenhagen": [12.5683, 55.6761], "Oslo": [10.7522, 59.9139],
  "Stockholm": [18.0686, 59.3293], "Helsinki": [24.9384, 60.1695], "Warsaw": [21.0122, 52.2297], "Warschau": [21.0122, 52.2297],
  "Reykjavik": [-21.8277, 64.1283], "Geneva": [6.1432, 46.2044], "Genf": [6.1432, 46.2044],
  "Hamburg": [9.9937, 53.5511], "Düsseldorf": [6.7735, 51.2277], "Stuttgart": [9.1829, 48.7758], "Cologne": [6.9528, 50.9364], "Köln": [6.9528, 50.9364],
  "Miami": [-80.1918, 25.7617], "Los Angeles": [-118.2437, 34.0522], "San Francisco": [-122.4194, 37.7749],
  "Chicago": [-87.6298, 41.8781], "Boston": [-71.0589, 42.3601], "Las Vegas": [-115.1398, 36.1699],
  "Orlando": [-81.3792, 28.5383], "Seattle": [-122.3321, 47.6062], "Atlanta": [-84.3880, 33.7490],
  "Toronto": [-79.3832, 43.6532], "Montreal": [-73.5673, 45.5017], "Vancouver": [-123.1207, 49.2827],
  "Cancun": [-86.8515, 21.1619], "Cancún": [-86.8515, 21.1619], "Tenerife": [-16.2518, 28.2916],
  "Gran Canaria": [-15.5474, 27.9202], "Ibiza": [1.4330, 38.9067], "Menorca": [4.2658, 39.8879],
  "Lanzarote": [-13.5515, 28.9626], "Fuerteventura": [-14.0116, 28.3587],
  "Málaga": [-4.4203, 36.7213], "Malaga": [-4.4203, 36.7213], "Alicante": [-0.4815, 38.3452], "Valencia": [-0.3763, 39.4699],
  "Seville": [-5.9845, 37.3891], "Sevilla": [-5.9845, 37.3891], "Zaragoza": [-0.8810, 41.6488],
  "Naples": [14.2681, 40.8518], "Neapel": [14.2681, 40.8518], "Venice": [12.3155, 45.4408], "Venedig": [12.3155, 45.4408],
  "Florence": [11.2558, 43.7696], "Florenz": [11.2558, 43.7696], "Bologna": [11.3426, 44.4949],
  "Turin": [7.6869, 45.0703], "Genoa": [8.9463, 44.4056], "Genua": [8.9463, 44.4056],
  "Palermo": [13.3613, 38.1157], "Catania": [15.0873, 37.5079], "Pisa": [11.2558, 43.7167],
  "Edinburgh": [-3.1883, 55.9533], "Manchester": [-2.2426, 53.4808], "Birmingham": [-1.8904, 52.4862],
  "Glasgow": [-4.2518, 55.8642], "Belfast": [-5.9301, 54.5973], "Bristol": [-2.5879, 51.4545],
  "Bucharest": [26.1025, 44.4268], "Bukarest": [26.1025, 44.4268], "Sofia": [23.3219, 42.6977],
  "Belgrade": [20.4489, 44.8125], "Belgrad": [20.4489, 44.8125], "Zagreb": [15.9819, 45.8150],
  "Split": [16.4402, 43.5081], "Dubrovnik": [18.0944, 42.6507], "Zadar": [15.2262, 44.1194],
  "Krakow": [19.9450, 50.0647], "Kraków": [19.9450, 50.0647], "Krakau": [19.9450, 50.0647],
  "Riga": [24.1052, 56.9496], "Tallinn": [24.7536, 59.4370], "Vilnius": [25.2797, 54.6872],
  "Larnaca": [33.6292, 34.9153], "Paphos": [32.4245, 34.7720], "Valletta": [14.5146, 35.8989],
  "Famagusta": [33.9399, 35.1149], "Nicosia": [33.3823, 35.1856], "Limassol": [33.0420, 34.6786],
  "Rhodes": [28.2225, 36.4341], "Rhodos": [28.2225, 36.4341], "Heraklion": [25.1320, 35.3288],
  "Corfu": [19.9197, 39.6243], "Korfu": [19.9197, 39.6243], "Chania": [25.0203, 35.5138],
  "Kefalonia": [19.9197, 39.6243], "Santorini": [28.2225, 36.4341], "Mykonos": [25.3289, 36.4408],
  "Zakynthos": [20.8833, 37.7833], "Kos": [27.2885, 36.8932],
  "Pristina": [21.1655, 42.6629], "Tirana": [19.8189, 41.3275], "Sarajevo": [18.4131, 43.8563],
  "Ljubljana": [14.5058, 46.0569], "Maribor": [15.6459, 46.5547], "Bratislava": [17.1077, 48.1486],
  "Nice": [7.2620, 43.7102], "Nizza": [7.2620, 43.7102], "Lyon": [4.8357, 45.7640],
  "Marseille": [5.3698, 43.2965], "Toulouse": [1.4442, 43.6047], "Bordeaux": [-0.5792, 44.8378],
  "Nantes": [-1.5536, 47.2184], "Strasbourg": [7.7521, 48.5734], "Straßburg": [7.7521, 48.5734],
  "Lille": [3.0573, 50.6292], "Verona": [12.3155, 45.4384],
  "Bodrum": [27.4296, 37.0344], "Dalaman": [30.7133, 36.7648], "Izmir": [27.1428, 38.4237], "İzmir": [27.1428, 38.4237],
  "Ankara": [32.8597, 39.9334], "Hanover": [9.7320, 52.3705], "Hannover": [9.7320, 52.3705],
  "Leipzig": [12.3731, 51.3397], "Dresden": [13.7373, 51.0504], "Nuremberg": [11.0767, 49.4521], "Nürnberg": [11.0767, 49.4521],
  "Graz": [15.4395, 47.0707], "Innsbruck": [13.0440, 47.2692],
  "Salzburg": [13.0550, 47.8095], "Linz": [14.2861, 48.3069], "Basel": [8.5417, 47.5596],
  "Bern": [7.5886, 46.9480], "Lugano": [8.9511, 46.0037], "Gothenburg": [11.9746, 57.7089],
  "Malmö": [13.0038, 55.6049], "Bergen": [5.3221, 60.3913], "Stavanger": [5.7331, 58.9699],
  "Tromsø": [18.9553, 69.6492], "Aarhus": [10.2039, 56.1567], "Aalborg": [9.9217, 57.0488],
  "Billund": [9.1114, 55.7316], "Turku": [22.2666, 60.4518], "Tampere": [23.7600, 61.4978],
  "Oulu": [25.4682, 65.0121], "Rovaniemi": [25.7209, 66.5039], "Skopje": [21.4280, 42.0050],
  "Podgorica": [19.2636, 42.4411], "Chisinau": [28.8303, 47.0105], "Cluj-Napoca": [23.5900, 46.7712],
  "Timisoara": [21.2287, 45.7489], "Iasi": [27.5689, 47.1585], "Varna": [27.9147, 43.2141],
  "Burgas": [27.4626, 42.5048], "Plovdiv": [24.7453, 42.1354], "Ohrid": [20.8016, 41.1130],
  "Liberec": [15.0562, 50.7671]
};

const COUNTRY_CENTER_COORDS = {
  "AD": [1.5, 42.5], "AE": [53.8, 23.4], "AF": [67.7, 33.9], "AG": [-61.8, 17.0], "AI": [-63.0, 18.2], 
  "AL": [20.1, 41.1], "AM": [45.0, 40.0], "AO": [17.8, -11.2], "AR": [-63.6, -38.4], "AT": [14.5, 47.5], 
  "AU": [133.7, -25.2], "AW": [-69.9, 12.5], "AZ": [47.5, 40.1], "BA": [17.6, 43.9], "BB": [-59.5, 13.1], 
  "BD": [90.3, 23.6], "BE": [4.4, 50.5], "BF": [-1.5, 12.2], "BG": [25.4, 42.7], "BH": [50.5, 26.0], 
  "BI": [29.9, -3.3], "BJ": [2.3, 9.3], "BM": [-64.7, 32.3], "BN": [114.7, 4.5], "BO": [-63.5, -16.2], 
  "BR": [-51.9, -14.2], "BS": [-77.3, 25.0], "BT": [90.4, 27.5], "BW": [24.6, -22.3], "BY": [27.9, 53.7], 
  "BZ": [-88.9, 17.1], "CA": [-106.3, 56.1], "CD": [21.7, -4.0], "CF": [20.9, 6.6], "CG": [15.8, -0.8], 
  "CH": [8.2, 46.8], "CI": [-5.5, 7.5], "CL": [-71.5, -35.6], "CM": [12.3, 3.8], "CN": [104.1, 35.8], 
  "CO": [-74.2, 4.5], "CR": [-83.7, 9.7], "CU": [-77.7, 21.5], "CV": [-23.6, 16.0], "CW": [-68.9, 12.1], 
  "CY": [33.4, 35.1], "CZ": [15.4, 49.8], "DE": [10.4, 51.1], "DJ": [42.5, 11.8], "DK": [9.5, 56.2], 
  "DO": [-70.1, 18.7], "DZ": [1.6, 28.0], "EC": [-78.1, -1.8], "EE": [25.0, 58.5], "EG": [30.8, 26.8], 
  "ER": [39.0, 15.0], "ES": [-3.7, 40.4], "ET": [39.7, 9.1], "FI": [25.7, 61.9], "FJ": [179.4, -16.5], 
  "FM": [158.1, 7.4], "FR": [2.2, 46.2], "GA": [11.6, -0.8], "GB": [-3.4, 55.3], "GD": [-61.6, 12.1], 
  "GE": [43.3, 42.3], "GF": [-53.1, 3.9], "GH": [-1.0, 7.9], "GI": [-5.3, 36.1], "GL": [-40.0, 72.0], 
  "GM": [-15.3, 13.4], "GN": [-9.6, 9.9], "GP": [-61.5, 16.2], "GQ": [10.2, 1.6], "GR": [21.8, 39.0], 
  "GT": [-90.2, 15.7], "GU": [144.7, 13.4], "GW": [-15.1, 11.8], "GY": [-58.9, 4.8], "HK": [114.1, 22.3], 
  "HN": [-86.2, 15.1], "HR": [15.2, 45.1], "HT": [-72.2, 18.9], "HU": [19.5, 47.1], "ID": [113.9, -0.7], 
  "IE": [-8.2, 53.4], "IL": [34.8, 31.0], "IN": [78.9, 20.5], "IQ": [43.6, 33.2], "IR": [53.6, 32.4], 
  "IS": [-19.0, 64.9], "IT": [12.5, 41.8], "JM": [-77.2, 18.1], "JO": [36.2, 31.2], "JP": [138.2, 36.2], 
  "KE": [37.9, -0.0], "KG": [74.7, 41.2], "KH": [104.9, 12.5], "KP": [127.5, 40.3], "KR": [127.7, 35.9], 
  "KW": [47.4, 29.3], "KY": [-80.5, 19.3], "KZ": [67.9, 48.0], "LA": [102.4, 19.8], "LB": [35.8, 33.8], 
  "LI": [9.5, 47.1], "LK": [80.7, 7.8], "LR": [-9.4, 6.4], "LS": [28.2, -29.6], "LT": [23.8, 55.1], 
  "LU": [6.1, 49.8], "LV": [24.6, 56.8], "LY": [17.2, 26.3], "MA": [-7.0, 31.7], "MC": [7.4, 43.7], 
  "MD": [28.3, 47.4], "ME": [19.3, 42.7], "MG": [46.8, -18.7], "MK": [21.7, 41.6], "ML": [-3.9, 17.5], 
  "MM": [95.9, 21.9], "MN": [103.8, 46.8], "MO": [113.5, 22.1], "MQ": [-60.9, 14.6], "MR": [-10.9, 21.0], 
  "MT": [14.3, 35.9], "MU": [57.5, -20.3], "MV": [73.2, 3.2], "MW": [34.3, -13.2], "MX": [-102.5, 23.6], 
  "MY": [101.9, 4.2], "MZ": [35.5, -18.6], "NA": [17.0, -22.5], "NC": [165.6, -20.9], "NE": [8.0, 17.6], 
  "NG": [8.6, 9.0], "NI": [-85.2, 12.8], "NL": [5.2, 52.1], "NO": [10.7, 59.9], "NP": [84.1, 28.3], 
  "NR": [166.9, -0.5], "NZ": [174.8, -40.9], "OM": [55.9, 21.5], "PA": [-80.7, 8.5], "PE": [-75.0, -9.1], 
  "PF": [-149.4, -17.6], "PG": [143.9, -6.3], "PH": [121.7, 12.8], "PK": [69.3, 30.3], "PL": [19.1, 51.9], 
  "PR": [-66.5, 18.2], "PT": [-8.2, 39.3], "PY": [-58.4, -23.2], "QA": [51.1, 25.3], "RO": [24.9, 45.9], 
  "RS": [21.0, 44.0], "RU": [105.3, 61.5], "RW": [29.9, -1.9], "SA": [45.0, 23.8], "SB": [160.1, -9.6], 
  "SC": [55.4, -4.6], "SD": [30.2, 12.8], "SE": [18.0, 59.3], "SG": [103.8, 1.3], "SI": [14.9, 46.1], 
  "SK": [19.6, 48.6], "SL": [-11.7, 8.4], "SM": [12.4, 43.9], "SN": [-14.4, 14.4], "SO": [46.1, 5.1], 
  "SR": [-56.0, 3.9], "SS": [31.3, 6.8], "ST": [6.6, 0.1], "SV": [-88.8, 13.7], "SX": [-63.0, 18.0], 
  "SY": [38.9, 34.8], "SZ": [31.4, -26.5], "TC": [-71.7, 21.6], "TD": [18.7, 15.4], "TG": [0.8, 8.6], 
  "TH": [100.9, 15.8], "TJ": [71.2, 38.8], "TL": [125.7, -8.8], "TM": [59.5, 38.9], "TN": [9.5, 33.8], 
  "TR": [35.2, 38.9], "TT": [-61.2, 10.6], "TW": [120.9, 23.6], "TZ": [34.8, -6.3], "UA": [31.1, 48.3], 
  "UG": [32.2, 1.3], "US": [-95.7, 37.0], "UY": [-55.7, -32.5], "UZ": [64.5, 41.3], "VC": [-61.2, 13.2], 
  "VE": [-66.5, 7.1], "VG": [-64.6, 18.4], "VI": [-64.8, 18.3], "VN": [108.2, 14.0], "VU": [167.9, -16.2], 
  "WS": [-172.1, -13.7], "XK": [20.9, 42.6], "YE": [48.0, 15.5], "YT": [45.1, -12.8], "ZA": [22.9, -30.5], 
  "ZM": [27.8, -13.1], "ZW": [29.1, -19.0]
};

const REGION_COORDS = {
  "California": [-121.4944, 38.5816], "Texas": [-97.7431, 30.2672], "Florida": [-84.2807, 30.4383], "New York": [-73.7562, 42.6526],
  "Pennsylvania": [-76.8836, 40.2732], "Illinois": [-89.6501, 39.7817], "Ohio": [-82.9988, 39.9612], "Georgia": [-84.3880, 33.7490],
  "North Carolina": [-78.6382, 35.7796], "Michigan": [-84.5555, 42.7325], "New Jersey": [-74.7597, 40.2171], "Virginia": [-77.4360, 37.5407],
  "Washington": [-122.9007, 47.0379], "Arizona": [-112.0740, 33.4484], "Massachusetts": [-71.0589, 42.3601], "Tennessee": [-86.7816, 36.1627],
  "Indiana": [-86.1581, 39.7684], "Missouri": [-92.1735, 38.5767], "Maryland": [-76.4922, 38.9784], "Wisconsin": [-89.3842, 43.0731],
  "Colorado": [-104.9903, 39.7392], "Minnesota": [-93.1015, 44.9537], "South Carolina": [-81.0348, 34.0007], "Alabama": [-86.3006, 32.3668],
  "Louisiana": [-91.1403, 30.4515], "Kentucky": [-84.8733, 38.2009], "Oregon": [-123.0351, 44.9429], "Oklahoma": [-97.5164, 35.4676],
  "Connecticut": [-72.6851, 41.7658], "Utah": [-111.8910, 40.7608], "Iowa": [-93.6091, 41.5908], "Nevada": [-119.7674, 39.1638],
  "Arkansas": [-92.2896, 34.7465], "Mississippi": [-90.1848, 32.2988], "Kansas": [-95.6890, 39.0558], "New Mexico": [-105.9378, 35.6870],
  "Nebraska": [-96.6753, 40.8136], "Idaho": [-116.2023, 43.6150], "West Virginia": [-81.6326, 38.3498], "Hawaii": [-157.8583, 21.3069],
  "Ontario": [-79.3832, 43.6532], "Quebec": [-71.2080, 46.8139], "British Columbia": [-123.3656, 48.4284], "Alberta": [-113.4909, 53.5461],
  "England": [-0.1276, 51.5072], "Scotland": [-3.1883, 55.9533], "Wales": [-3.1791, 51.4816], "Northern Ireland": [-5.9301, 54.5973],
  "Bavaria": [11.5820, 48.1351], "Bayern": [11.5820, 48.1351], "North Rhine-Westphalia": [6.7735, 51.2277], "Nordrhein-Westfalen": [6.7735, 51.2277], "Baden-Württemberg": [9.1829, 48.7758], "Hesse": [8.2415, 50.0826],
  "Lower Saxony": [9.7320, 52.3705], "Rhineland-Palatinate": [8.2473, 49.9929], "Berlin": [13.4050, 52.5200], "Saxony": [13.7373, 51.0504],
  "Hamburg": [9.9937, 53.5511], "Schleswig-Holstein": [10.1228, 54.3233], "Brandenburg": [13.0645, 52.3906], "Saxony-Anhalt": [11.6276, 52.1205],
  "Thuringia": [11.0299, 50.9804], "Mecklenburg-Vorpommern": [11.4148, 53.6355], "Bremen": [8.8017, 53.0793], "Saarland": [6.9969, 49.2390],
  "Andalusia": [-5.9845, 37.3891], "Andalusien": [-5.9845, 37.3891], "Catalonia": [2.1686, 41.3874], "Katalonien": [2.1686, 41.3874], "Madrid": [-3.7038, 40.4168], "Valencian Community": [-0.3763, 39.4699], "Valencia": [-0.3763, 39.4699],
  "Galicia": [-8.5457, 42.8782], "Castile and León": [-4.7245, 41.6520], "Basque Country": [-2.9350, 43.2630], "Canary Islands": [-15.4134, 28.1174], "Kanaren": [-15.4134, 28.1174],
  "Castilla-La Mancha": [-4.0273, 39.8628], "Murcia": [-1.1307, 37.9922], "Aragon": [-0.8810, 41.6488], "Extremadura": [-6.3408, 38.9161],
  "Balearic Islands": [2.6502, 39.5696], "Balearen": [2.6502, 39.5696], "Asturias": [-5.8494, 43.3614], "Navarre": [-1.6432, 42.8169], "Cantabria": [-3.8044, 43.4623], "La Rioja": [-2.4437, 42.4627],
  "Île-de-France": [2.3522, 48.8566], "Auvergne-Rhône-Alpes": [4.8357, 45.7640], "Nouvelle-Aquitaine": [-0.5792, 44.8378], "Occitanie": [1.4442, 43.6047],
  "Hauts-de-France": [3.0573, 50.6292], "Provence-Alpes-Côte d'Azur": [5.3698, 43.2965], "Grand Est": [7.7521, 48.5734], "Pays de la Loire": [-1.5536, 47.2184],
  "Brittany": [-1.6778, 48.1147], "Normandy": [-0.3600, 49.1800], "Bourgogne-Franche-Comté": [5.0415, 47.3220], "Centre-Val de Loire": [1.9093, 47.9029], "Corsica": [8.7369, 41.9271],
  "Lombardy": [9.1900, 45.4642], "Lombardei": [9.1900, 45.4642], "Lazio": [12.4964, 41.9028], "Campania": [14.2681, 40.8518], "Sicily": [13.3614, 38.1157], "Veneto": [12.3155, 45.4408], "Venetien": [12.3155, 45.4408],
  "Emilia-Romagna": [11.3426, 44.4949], "Piedmont": [7.6869, 45.0703], "Apulia": [16.8719, 41.1171], "Tuscany": [11.2558, 43.7696], "Calabria": [16.5944, 38.9059],
  "Sardinia": [9.1114, 39.2153], "Liguria": [8.9463, 44.4056], "Marche": [13.5189, 43.6158], "Abruzzo": [13.3995, 42.3498], "Friuli-Venezia Giulia": [13.7768, 45.6495],
  "Trentino-South Tyrol": [11.1211, 46.0697], "Südtirol": [11.1211, 46.0697], "Umbria": [12.3888, 43.1107], "Basilicata": [15.8051, 40.6404], "Molise": [14.6627, 41.5603], "Aosta Valley": [7.3201, 45.7373],
  "South Aegean": [25.3289, 36.4408], "Crete": [24.8093, 35.2401], "Kreta": [24.8093, 35.2401], "Ionian Islands": [20.6249, 38.9954], "Ionische Inseln": [20.6249, 38.9954], "Central Macedonia": [22.9444, 40.6401], "Attica": [23.7275, 37.9838],
  "Peloponnese": [22.3815, 37.6664], "Epirus": [20.8450, 39.6649], "Thessaly": [22.4223, 39.5517], "Macedonia and Thrace": [22.9444, 40.6401], "Central Greece": [22.8465, 38.6120],
  "Western Greece": [21.7346, 38.2466], "Eastern Macedonia and Thrace": [24.8988, 41.0858], "North Aegean": [26.2307, 39.1118], "Decentralized Administration of Peloponnese, Western Greece and the Ionian": [21.7346, 38.2466],
  "Decentralized Administration of the Aegean": [25.3289, 36.4408], "Decentralized Administration of Crete": [24.8093, 35.2401],
  "Antalya Province": [30.7133, 36.8969], "Antalya": [30.7133, 36.8969], "Muğla Province": [28.3665, 37.2153], "Mugla Province": [28.3665, 37.2153], "Muğla": [28.3665, 37.2153],
  "Istanbul Province": [28.9784, 41.0082], "Istanbul": [28.9784, 41.0082], "İzmir Province": [27.1428, 38.4237], "Izmir Province": [27.1428, 38.4237], "İzmir": [27.1428, 38.4237],
  "Aydın Province": [27.8456, 37.8444], "Aydin Province": [27.8456, 37.8444], "Aydın": [27.8456, 37.8444], "Nevşehir Province": [34.7142, 38.6247], "Marmara Region": [28.9784, 41.0082],
  "Aegean Region": [27.1428, 38.4237], "Mediterranean Region": [30.7133, 36.8969],
  "Tessin": [8.96, 46.20], "Ticino": [8.96, 46.20], "Vorarlberg": [9.9065, 47.2304], "Salzburg": [13.0550, 47.8095], "Dubrovnik": [18.0944, 42.6507], "Liberec": [15.0562, 50.7671], "Trentino-Alto Adige": [11.1211, 46.0697], "Trentino Alto Adige": [11.1211, 46.0697],
  "Holland": [4.90, 52.36], "North Holland": [4.89, 52.5], "Noord-Holland": [4.89, 52.5], "South Holland": [4.47, 52.0], "Zuid-Holland": [4.47, 52.0],
  "Utrecht": [5.12, 52.09], "North Brabant": [5.46, 51.44], "Noord-Brabant": [5.46, 51.44], "Gelderland": [5.91, 52.0], "Limburg": [5.93, 51.2], "Groningen": [6.56, 53.21], "Friesland": [5.84, 53.16], "Drenthe": [6.55, 52.84], "Overijssel": [6.46, 52.43], "Flevoland": [5.55, 52.51], "Zeeland": [3.88, 51.49],
  "Lisbon": [-9.13, 38.72], "Lissabon": [-9.13, 38.72], "Porto": [-8.62, 41.15], "Algarve": [-7.93, 37.01], "Madeira": [-16.90, 32.64], "Azores": [-25.66, 37.74], "Azoren": [-25.66, 37.74], "Centro": [-8.42, 40.20], "Norte": [-8.62, 41.15], "Alentejo": [-8.0, 38.0],
  "Tenerife": [-16.25, 28.29], "Teneriffa": [-16.25, 28.29], "Gran Canaria": [-15.41, 28.11], "Palma de Mallorca": [2.65, 39.56], "Palma": [2.65, 39.56], "Ibiza": [1.43, 38.90], "Menorca": [4.26, 39.88], "Lanzarote": [-13.55, 28.96], "Fuerteventura": [-14.01, 28.35]
};

// String Normalizer für robustes Koordinaten-Matching
const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
};

const N_CITY_COORDS = {};
Object.keys(CITY_COORDS).forEach(k => { N_CITY_COORDS[normalizeString(k)] = CITY_COORDS[k]; });

const N_REGION_COORDS = {};
Object.keys(REGION_COORDS).forEach(k => { N_REGION_COORDS[normalizeString(k)] = REGION_COORDS[k]; });

const PLANE_PATH = 'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z';

export default function App() {
  const [activeTab, setActiveTab] = useState('flights'); 

  const [echartsReady, setEchartsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isDiyModalOpen, setIsDiyModalOpen] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const [isDefaultDataFlights, setIsDefaultDataFlights] = useState(true);
  const [isFlightFiltersInitialized, setIsFlightFiltersInitialized] = useState(false);
  const [customFlightDate, setCustomFlightDate] = useState("");
  const [data, setData] = useState([]);
  const [disabledRoutes, setDisabledRoutes] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [activeCountries, setActiveCountries] = useState([]);
  const [availableDestCountries, setAvailableDestCountries] = useState([]);
  const [activeDestCountries, setActiveDestCountries] = useState([]);
  const [timeframe, setTimeframe] = useState('7d'); 
  const [trendType, setTrendType] = useState('yoy'); 
  const [trendFilter, setTrendFilter] = useState('all'); 
  const [minAdOppFilter, setMinAdOppFilter] = useState(''); 
  const [isDestExpanded, setIsDestExpanded] = useState(false);

  const [isDefaultDataAcc, setIsDefaultDataAcc] = useState(true);
  const [isAccFiltersInitialized, setIsAccFiltersInitialized] = useState(false);
  const [customAccDate, setCustomAccDate] = useState("");
  const [accData, setAccData] = useState([]);
  const [accFilterType, setAccFilterType] = useState('All');

  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminFlightDate, setAdminFlightDate] = useState("");
  const [adminFlightCsv, setAdminFlightCsv] = useState(null);
  
  const [adminAccDate1Start, setAdminAccDate1Start] = useState(lastWeekDates.start);
  const [adminAccDate1End, setAdminAccDate1End] = useState(lastWeekDates.end);
  const [adminAccDate2Start, setAdminAccDate2Start] = useState(twoWeeksAgoDates.start);
  const [adminAccDate2End, setAdminAccDate2End] = useState(twoWeeksAgoDates.end);
  const [adminAccCurrCsv, setAdminAccCurrCsv] = useState(null);
  const [adminAccPrevCsv, setAdminAccPrevCsv] = useState(null);

  const [adminAccDate3Start, setAdminAccDate3Start] = useState(dates30.cStart);
  const [adminAccDate3End, setAdminAccDate3End] = useState(dates30.cEnd);
  const [adminAccDate4Start, setAdminAccDate4Start] = useState(dates30.pStart);
  const [adminAccDate4End, setAdminAccDate4End] = useState(dates30.pEnd);
  const [adminAccCurrCsv2, setAdminAccCurrCsv2] = useState(null);
  const [adminAccPrevCsv2, setAdminAccPrevCsv2] = useState(null);
  
  const [flightsGlobalDate, setFlightsGlobalDate] = useState("Lade Daten...");
  const [flightsGlobalCsv, setFlightsGlobalCsv] = useState("");
  const [accGlobalDate, setAccGlobalDate] = useState("Lade Daten...");
  const [accGlobalCurrCsv, setAccGlobalCurrCsv] = useState("");
  const [accGlobalPrevCsv, setAccGlobalPrevCsv] = useState("");
  const [accGlobalDate2, setAccGlobalDate2] = useState("");
  const [accGlobalCurrCsv2, setAccGlobalCurrCsv2] = useState("");
  const [accGlobalPrevCsv2, setAccGlobalPrevCsv2] = useState("");
  
  const [accTimeframe, setAccTimeframe] = useState('set1'); 
  const [availableAccCountries, setAvailableAccCountries] = useState([]);
  const [activeAccCountries, setActiveAccCountries] = useState([]);
  const [accMinAdOppFilter, setAccMinAdOppFilter] = useState(''); 
  
  const [availableAccRegions, setAvailableAccRegions] = useState([]);
  const [activeAccRegions, setActiveAccRegions] = useState([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [expandedAccCountries, setExpandedAccCountries] = useState({});

  const [tempFlightFile, setTempFlightFile] = useState(null);
  const [tempFlightDate, setTempFlightDate] = useState("");
  
  const [tempAccDate1Start, setTempAccDate1Start] = useState(lastWeekDates.start);
  const [tempAccDate1End, setTempAccDate1End] = useState(lastWeekDates.end);
  const [tempAccDate2Start, setTempAccDate2Start] = useState(twoWeeksAgoDates.start);
  const [tempAccDate2End, setTempAccDate2End] = useState(twoWeeksAgoDates.end);
  
  const [tempAccCurrent, setTempAccCurrent] = useState(null);
  const [tempAccPrevious, setTempAccPrevious] = useState(null);

  const dropdownRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef(null);

  useEffect(() => {
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
      return () => unsubscribe();
    } else {
      setFlightsGlobalCsv(DEFAULT_FLIGHTS_CSV);
      setFlightsGlobalDate("Demo Daten (Offline)");
      setAccGlobalCurrCsv(DEFAULT_ACC_CURRENT_CSV);
      setAccGlobalPrevCsv(DEFAULT_ACC_PREVIOUS_CSV);
      setAccGlobalDate("Demo Daten (Offline)");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsRegionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        
        setAccGlobalCurrCsv2(d.currentCsv2 || "");
        setAccGlobalPrevCsv2(d.prevCsv2 || "");
        setAccGlobalDate2(d.lastUpdated2 || "");
      } else {
        setAccGlobalCurrCsv(DEFAULT_ACC_CURRENT_CSV);
        setAccGlobalPrevCsv(DEFAULT_ACC_PREVIOUS_CSV);
        setAccGlobalDate("Start-Daten");
      }
    }, (err) => console.error("Snapshot Error Acc:", err));

    return () => { unsubFlights(); unsubAcc(); };
  }, [user]);

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
      
      const isOriginValid = ['US', 'CA'].includes(originCountry) || COUNTRY_TO_CONTINENT[originCountry] === 'Europa';
      if (!isOriginValid) continue;

      const baseO = COUNTRY_CENTER_COORDS[originCountry];
      const oCoord = N_CITY_COORDS[normalizeString(originCity)] || (baseO ? getFallbackCoord(originCity, baseO) : getFallbackCoord(originCity));
      
      const baseD = COUNTRY_CENTER_COORDS[destCountry];
      const dCoord = N_CITY_COORDS[normalizeString(destCity)] || (baseD ? getFallbackCoord(destCity, baseD) : getFallbackCoord(destCity));

      parsedData.push({ 
        originCountry, originCity, destCountry, destCity, 
        oCoord, dCoord, 
        routeId: cols[2], 
        d84_ad: parseFloat(cols[3]) || 0, d84_yoy: parseFloat(cols[4]) || 0, 
        d28_ad: parseFloat(cols[5]) || 0, d28_mom: parseFloat(cols[6]) || 0, d28_yoy: parseFloat(cols[7]) || 0, 
        d7_ad: parseFloat(cols[8]) || 0, d7_wow: parseFloat(cols[9]) || 0, d7_yoy: parseFloat(cols[10]) || 0 
      });
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
           const userCountry = cols[0].trim();
           const destCountry = cols[1].trim();
           let destRegion = cols[2].trim();
           
           const isOriginValid = ['US', 'CA'].includes(userCountry) || COUNTRY_TO_CONTINENT[userCountry] === 'Europa';
           if (!isOriginValid) continue;

           const isDestEuUsCaTr = ['US', 'CA', 'TR'].includes(destCountry) || COUNTRY_TO_CONTINENT[destCountry] === 'Europa';
           if (!isDestEuUsCaTr) {
               destRegion = COUNTRY_NAMES[destCountry] || destCountry;
           }

           parsed.push({ userCountry, destCountry, destRegion, type: cols[3].trim(), adOpp: parseFloat(cols[4]) || 0 });
       }
    }
    return parsed;
  };

  const mergeAccData = (currArray, prevArray) => {
    const joined = [];
    currArray.forEach(curr => {
       const prev = prevArray.find(p => p.userCountry === curr.userCountry && p.destCountry === curr.destCountry && p.destRegion === curr.destRegion);
       const prevAdOpp = prev ? prev.adOpp : 0;
       let wow = 0;
       if(prevAdOpp > 0) {
         wow = (curr.adOpp - prevAdOpp) / prevAdOpp;
       }
       joined.push({ ...curr, prevAdOpp, trend: wow, routeId: `${curr.userCountry}-${curr.destRegion}` });
    });
    return joined;
  };

  const regionToCountry = useMemo(() => {
    const map = {};
    accData.forEach(d => {
      if (d.destRegion) map[d.destRegion] = d.destCountry;
    });
    return map;
  }, [accData]);

  useEffect(() => {
    if (isDefaultDataFlights && flightsGlobalCsv) {
      const parsed = parseCSV(flightsGlobalCsv);
      setData(parsed);
      setDisabledRoutes([]);
      const countries = [...new Set(parsed.map(d => d.originCountry))].sort();
      setAvailableCountries(countries);
      const destCountries = [...new Set(parsed.map(d => d.destCountry))].sort();
      setAvailableDestCountries(destCountries);
      
      if (!isFlightFiltersInitialized) {
        setActiveCountries(countries.includes('DE') ? ['DE'] : countries);
        const euDest = destCountries.filter(c => COUNTRY_TO_CONTINENT[c] === 'Europa');
        setActiveDestCountries(euDest.length > 0 ? euDest : destCountries);
        setIsFlightFiltersInitialized(true);
      } else {
        setActiveCountries(prev => prev.filter(c => countries.includes(c)));
        setActiveDestCountries(prev => prev.filter(c => destCountries.includes(c)));
      }
    }
  }, [flightsGlobalCsv, isDefaultDataFlights, isFlightFiltersInitialized]);

  useEffect(() => {
    if (isDefaultDataAcc && accGlobalCurrCsv && accGlobalPrevCsv) {
      const cCsv = accTimeframe === 'set1' ? accGlobalCurrCsv : (accGlobalCurrCsv2 || accGlobalCurrCsv);
      const pCsv = accTimeframe === 'set1' ? accGlobalPrevCsv : (accGlobalPrevCsv2 || accGlobalPrevCsv);
      const curr = parseAccCSV(cCsv);
      const prev = parseAccCSV(pCsv);
      setAccData(mergeAccData(curr, prev));
    }
  }, [accGlobalCurrCsv, accGlobalPrevCsv, accGlobalCurrCsv2, accGlobalPrevCsv2, accTimeframe, isDefaultDataAcc]);

  useEffect(() => {
    if (accData.length === 0) return;
    const countries = [...new Set(accData.map(d => d.userCountry))].sort();
    setAvailableAccCountries(countries);
    const regions = [...new Set(accData.map(d => d.destRegion))].filter(Boolean).sort();
    setAvailableAccRegions(regions);

    if (!isAccFiltersInitialized) {
      const initialCountries = countries.filter(c => ['DE', 'AT', 'CH'].includes(c));
      setActiveAccCountries(initialCountries.length > 0 ? initialCountries : countries);
      const initialRegions = regions.filter(r => r.toLowerCase().includes('trentino'));
      setActiveAccRegions(initialRegions.length > 0 ? initialRegions : regions);
      setIsAccFiltersInitialized(true);
    } else {
      setActiveAccCountries(prev => prev.filter(c => countries.includes(c)));
      setActiveAccRegions(prev => prev.filter(r => regions.includes(r)));
    }
  }, [accData, isAccFiltersInitialized]);

  const initDefaultFlights = () => { setIsDefaultDataFlights(true); setIsFlightFiltersInitialized(false); setCustomFlightDate(""); };
  const initDefaultAcc = () => { setIsDefaultDataAcc(true); setIsAccFiltersInitialized(false); setCustomAccDate(""); setAccTimeframe('set1'); };

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
    setIsSaving(true);
    try {
      const updateObj = {};
      if (adminAccCurrCsv && adminAccPrevCsv) {
        updateObj.currentCsv = await adminAccCurrCsv.text();
        updateObj.prevCsv = await adminAccPrevCsv.text();
        updateObj.lastUpdated = `${formatRange(adminAccDate1Start, adminAccDate1End, "Aktuell")} vs ${formatRange(adminAccDate2Start, adminAccDate2End, "Vorher")}`;
      }
      if (adminAccCurrCsv2 && adminAccPrevCsv2) {
        updateObj.currentCsv2 = await adminAccCurrCsv2.text();
        updateObj.prevCsv2 = await adminAccPrevCsv2.text();
        updateObj.lastUpdated2 = `${formatRange(adminAccDate3Start, adminAccDate3End, "Aktuell")} vs ${formatRange(adminAccDate4Start, adminAccDate4End, "Vorher")}`;
      }
      
      if(Object.keys(updateObj).length > 0) {
        await setDoc(getSafeDocRef(db, appId, 'appConfig', 'accommodations'), updateObj, { merge: true });
      }
      
      setIsAdminPanelOpen(false);
      setAdminAccCurrCsv(null); setAdminAccPrevCsv(null);
      setAdminAccCurrCsv2(null); setAdminAccPrevCsv2(null);
    } catch(err) { console.error(err); alert("Fehler beim Speichern!"); }
    setIsSaving(false);
  };

  const applyCustomFlights = async () => {
    if(!tempFlightFile) return;
    const text = await tempFlightFile.text();
    setIsDefaultDataFlights(false);
    setIsFlightFiltersInitialized(false);
    setCustomFlightDate(formatD(tempFlightDate) || "Manuelles Datum");
    setFlightsGlobalCsv(text);
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
    setIsAccFiltersInitialized(false);
    setIsDiyModalOpen(false);
  };

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current === 4) {
      setIsAdminPanelOpen(true);
      clickCountRef.current = 0;
    }
    clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000); 
  };

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

  const maxPossibleAdOppFlights = useMemo(() => {
    if (data.length === 0) return 100000;
    let max = 0;
    data.forEach(d => {
      let val = timeframe === '84d' ? d.d84_ad : (timeframe === '28d' ? d.d28_ad : d.d7_ad);
      if (val > max) max = val;
    });
    return max > 0 ? Math.ceil(max / 10000) * 10000 : 100000;
  }, [data, timeframe]);

  const maxPossibleAdOppAcc = useMemo(() => {
    if (accData.length === 0) return 100000;
    let max = 0;
    accData.forEach(d => { if (d.adOpp > max) max = d.adOpp; });
    return max > 0 ? Math.ceil(max / 10000) * 10000 : 100000;
  }, [accData]);

  const getTrendColor = (trend) => {
    if (trend <= -0.20) return '#dc2626'; 
    if (trend < 0) return '#fca5a5';      
    if (trend === 0) return '#94a3b8';    
    if (trend <= 0.20) return '#6ee7b7';  
    return '#10b981';                     
  };

  const filteredRegionsForSearch = availableAccRegions.filter(r => {
    const searchLower = regionSearch.toLowerCase();
    const cCode = regionToCountry[r] || '';
    const cName = COUNTRY_NAMES[cCode] || '';
    return r.toLowerCase().includes(searchLower) || cName.toLowerCase().includes(searchLower) || cCode.toLowerCase().includes(searchLower);
  });
  
  const groupedRegions = useMemo(() => {
    const groups = {};
    filteredRegionsForSearch.forEach(region => {
      const c = regionToCountry[region] || 'Unbekannt';
      if (!groups[c]) groups[c] = [];
      groups[c].push(region);
    });
    return groups;
  }, [filteredRegionsForSearch, regionToCountry]);

  const toggleAccCountryAccordion = (countryCode, e) => {
    e.stopPropagation();
    setExpandedAccCountries(prev => ({...prev, [countryCode]: !prev[countryCode]}));
  };

  const flightChartData = useMemo(() => {
    if (activeTab !== 'flights') return [];
    const activeMinAdOpp = Number(minAdOppFilter) || 0;
    return data.filter(r => !disabledRoutes.includes(r.routeId) && activeCountries.includes(r.originCountry) && activeDestCountries.includes(r.destCountry))
      .map(row => {
        let adOpp, trend, trendLabel;
        if (timeframe === '84d') { adOpp = row.d84_ad; trend = row.d84_yoy; trendLabel = 'Vorjahr (YoY)'; } 
        else if (timeframe === '28d') { adOpp = row.d28_ad; trend = trendType === 'yoy' ? row.d28_yoy : row.d28_mom; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorperiode (MoM)'; } 
        else { adOpp = row.d7_ad; trend = trendType === 'yoy' ? row.d7_yoy : row.d7_wow; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorwoche (WoW)'; }
        return { ...row, currentAdOpp: adOpp, currentTrend: trend, trendLabel };
      })
      .filter(row => row.currentAdOpp > 0 && row.currentAdOpp >= activeMinAdOpp)
      .filter(row => trendFilter === 'all' ? true : (trendFilter === 'positive' ? row.currentTrend >= 0 : row.currentTrend < 0));
  }, [data, disabledRoutes, activeCountries, activeDestCountries, minAdOppFilter, timeframe, trendType, trendFilter, activeTab]);

  const accChartData = useMemo(() => {
    if (activeTab !== 'accommodations') return { filteredData: [], destHotspots: [] };
    const activeMinAdOpp = Number(accMinAdOppFilter) || 0;
    
    const filteredData = accData.filter(r => 
      (accFilterType === 'All' || r.type === accFilterType) &&
      activeAccCountries.includes(r.userCountry) &&
      activeAccRegions.includes(r.destRegion) &&
      r.adOpp >= activeMinAdOpp
    ).filter(row => trendFilter === 'all' ? true : (trendFilter === 'positive' ? row.trend >= 0 : row.trend < 0));

    const regionAgg = {};
    filteredData.forEach(row => {
      let destCoord = N_REGION_COORDS[normalizeString(row.destRegion)];
      if (!destCoord) {
        const baseCoord = COUNTRY_CENTER_COORDS[row.destCountry];
        destCoord = getFallbackCoord(row.destRegion || "unknown", baseCoord);
      }
      if(!regionAgg[row.destRegion]) regionAgg[row.destRegion] = { country: row.destCountry, coord: destCoord, adOpp: 0, prevAdOpp: 0 };
      regionAgg[row.destRegion].adOpp += row.adOpp;
      regionAgg[row.destRegion].prevAdOpp += row.prevAdOpp;
    });

    const destHotspots = Object.keys(regionAgg).map(reg => {
       const d = regionAgg[reg];
       const regWow = d.prevAdOpp > 0 ? (d.adOpp - d.prevAdOpp) / d.prevAdOpp : 0;
       return { name: reg, value: d.coord, country: d.country, adOpp: d.adOpp, trend: regWow, isDest: true };
    });

    return { filteredData, destHotspots };
  }, [accData, accFilterType, activeAccCountries, activeAccRegions, accMinAdOppFilter, trendFilter, activeTab]);


  let top5 = [], flop5 = [];
  if (activeTab === 'flights') {
     const sorted = [...flightChartData].sort((a, b) => b.currentTrend - a.currentTrend);
     top5 = sorted.slice(0, 5);
     flop5 = sorted.slice().reverse().slice(0, 5);
  } else {
     const sorted = [...accChartData.destHotspots].sort((a, b) => b.trend - a.trend);
     top5 = sorted.slice(0, 5);
     flop5 = sorted.slice().reverse().slice(0, 5);
  }

  useEffect(() => {
    if (!echartsReady || !chartRef.current) return;
    if (!chartInstance.current) chartInstance.current = window.echarts.init(chartRef.current);
    let option = {};

    if (activeTab === 'flights' && flightChartData.length > 0) {
      let minAd = Infinity, maxAd = -Infinity;
      flightChartData.forEach(row => { if (row.currentAdOpp < minAd) minAd = row.currentAdOpp; if (row.currentAdOpp > maxAd) maxAd = row.currentAdOpp; });
      if (minAd === maxAd) minAd = 0;

      const lineData = flightChartData.map(row => {
        const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.currentAdOpp - minAd) / (maxAd - minAd))) : 3;
        return { coords: [row.oCoord, row.dCoord], lineStyle: { width: width, color: getTrendColor(row.currentTrend), curveness: 0.2 }, details: row };
      });

      const scatterData = [];
      flightChartData.forEach(row => {
        if (!scatterData.find(s => s.name === row.originCity)) scatterData.push({ name: row.originCity, value: row.oCoord });
        if (!scatterData.find(s => s.name === row.destCity)) scatterData.push({ name: row.destCity, value: row.dCoord });
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

    } else if (activeTab === 'accommodations' && accChartData.filteredData.length > 0) {
      const { filteredData, destHotspots } = accChartData;
      let minAd = Infinity, maxAd = -Infinity;
      filteredData.forEach(row => { if (row.adOpp < minAd) minAd = row.adOpp; if (row.adOpp > maxAd) maxAd = row.adOpp; });
      if (minAd === maxAd) minAd = 0;

      const lineData = [];
      const originScatter = [];

      filteredData.forEach(row => {
        const originCoord = COUNTRY_CENTER_COORDS[row.userCountry] || getFallbackCoord(row.userCountry);
        let destCoord = N_REGION_COORDS[normalizeString(row.destRegion)];
        if (!destCoord) {
          const baseCoord = COUNTRY_CENTER_COORDS[row.destCountry];
          destCoord = getFallbackCoord(row.destRegion || "unknown", baseCoord);
        }
        
        const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.adOpp - minAd) / (maxAd - minAd))) : 3;
        lineData.push({ coords: [originCoord, destCoord], lineStyle: { width: width, color: getTrendColor(row.trend), curveness: 0.2 }, details: row });
        if (!originScatter.find(s => s.name === row.userCountry)) originScatter.push({ name: row.userCountry, value: originCoord });
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
          { 
            type: 'effectScatter', coordinateSystem: 'geo', zlevel: 4, 
            symbolSize: (val, params) => {
               if(maxAd === minAd) return 10;
               return 8 + 15 * ((params.data.adOpp - minAd) / (maxAd - minAd));
            },
            itemStyle: { color: (params) => getTrendColor(params.data.trend), shadowBlur: 10, shadowColor: '#000' }, 
            label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold', textShadowColor: '#000', textShadowBlur: 3 } }, 
            data: destHotspots 
          }
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
  }, [flightChartData, accChartData, echartsReady, activeTab]);

  const toggleDisabledRoute = (routeId) => setDisabledRoutes(prev => prev.filter(id => id !== routeId));
  const toggleCountry = (country) => setActiveCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const toggleDestCountry = (country) => setActiveDestCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  
  const toggleAccCountry = (country) => setActiveAccCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  
  const setContinentAll = (countriesInContinent) => setActiveDestCountries(prev => { const newSet = new Set(prev); countriesInContinent.forEach(c => newSet.add(c)); return Array.from(newSet); });
  const setContinentNone = (countriesInContinent) => setActiveDestCountries(prev => prev.filter(c => !countriesInContinent.includes(c)));

  const toggleCountryRegions = (countryCode, regionsInCountry) => {
    const allSelected = regionsInCountry.every(r => activeAccRegions.includes(r));
    if (allSelected) {
      setActiveAccRegions(prev => prev.filter(r => !regionsInCountry.includes(r)));
    } else {
      setActiveAccRegions(prev => {
        const newSet = new Set(prev);
        regionsInCountry.forEach(r => newSet.add(r));
        return Array.from(newSet);
      });
    }
  };

  const handleManualMinAdOppChange = (e) => {
    const val = e.target.value;
    if (val === '') setMinAdOppFilter(''); 
    else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) setMinAdOppFilter(num.toString());
    }
  };

  const handleManualAccMinAdOppChange = (e) => {
    const val = e.target.value;
    if (val === '') setAccMinAdOppFilter(''); 
    else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) setAccMinAdOppFilter(num.toString());
    }
  };

  const renderTopFlopList = (items) => {
    if (items.length === 0) return <div className="text-xs text-slate-500 py-2">Keine Daten verfügbar</div>;
    return items.map((item, i) => {
      const name = activeTab === 'flights' ? `${item.originCity} ➔ ${item.destCity}` : item.name;
      const subtext = activeTab === 'flights' ? '' : `(${item.country})`;
      const trend = activeTab === 'flights' ? item.currentTrend : item.trend;
      const adOpp = activeTab === 'flights' ? item.currentAdOpp : item.adOpp;
      const isPositive = trend >= 0;
      return (
        <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-slate-700/50 last:border-0">
          <div className="flex items-center gap-1.5 truncate pr-2 flex-1">
            <span className="text-slate-500 font-mono w-3 shrink-0">{i+1}.</span>
            <span className="truncate" title={name}>{name} <span className="text-slate-500 text-[10px]">{subtext}</span></span>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{(trend * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] text-slate-500">{adOpp.toLocaleString('de-DE')}</span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-sans relative overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col z-10 shadow-xl relative">
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          
          <div 
            className="flex items-center gap-3 mb-4 cursor-pointer select-none group" 
            onClick={handleLogoClick}
            title=" "
          >
            <MapIcon className="text-blue-400 w-8 h-8 shrink-0 group-hover:text-blue-300 transition-colors" />
            <h1 className="text-xl font-bold text-white leading-tight">TAC<br/><span className="text-sm font-normal text-slate-400">Travel Trends</span></h1>
          </div>

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
                    : (isDefaultDataAcc ? (accTimeframe === 'set1' ? accGlobalDate : (accGlobalDate2 || "Kein zweiter Zeitraum hinterlegt")) : customAccDate)
                  }
                </p>
              </div>
              {((activeTab === 'flights' && !isDefaultDataFlights) || (activeTab === 'accommodations' && !isDefaultDataAcc)) && (
                <button onClick={activeTab === 'flights' ? initDefaultFlights : initDefaultAcc} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1.5 rounded transition-colors" title="Zurück zu Standard-Daten">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!isFirebaseReady && <p className="text-[9px] text-red-400 mt-2 pl-2">Datenbank offline/nicht konfiguriert. Prüfe Vercel Env Vars.</p>}
          </div>

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
                  <div className="flex flex-wrap gap-1.5">
                    {availableCountries.map(country => (
                      <button key={country} onClick={() => toggleCountry(country)} title={COUNTRY_NAMES[country] || country} className={`flex justify-center items-center p-1.5 rounded transition-colors border ${activeCountries.includes(country) ? 'bg-blue-600/20 border-blue-500 opacity-100 shadow-sm scale-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-30 saturate-50 scale-95'}`}>
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
                      <div className="flex gap-2 mb-4 pb-2 border-b border-slate-700/50 px-3">
                        <button onClick={() => setActiveDestCountries([...availableDestCountries])} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Alle anwählen</button>
                        <span className="text-xs text-slate-600">|</span>
                        <button onClick={() => setActiveDestCountries([])} className="text-xs text-slate-400 hover:text-slate-300">Alle abwählen</button>
                      </div>
                      <div className="px-3 pb-3">
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
                            <div className="flex flex-wrap gap-1.5">
                              {destByContinent[continent].map(country => {
                                const isValid = validDestCountries.includes(country); 
                                return (
                                  <button key={`dest-${country}`} onClick={() => isValid && toggleDestCountry(country)} title={!isValid ? `${COUNTRY_NAMES[country] || country} (Keine Routen)` : (COUNTRY_NAMES[country] || country)} className={`flex justify-center items-center p-1.5 rounded transition-colors border ${!isValid ? 'opacity-10 cursor-not-allowed bg-slate-900 border-slate-800 grayscale' : activeDestCountries.includes(country) ? 'bg-emerald-600/20 border-emerald-500 opacity-100 shadow-sm scale-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-30 saturate-50 scale-95'}`}>
                                    <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Min. Interesse</h2>
                <div className="flex flex-col gap-3">
                  <input type="number" min="0" value={minAdOppFilter} onChange={handleManualMinAdOppChange} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors" placeholder="Exakter Wert..." />
                  <input type="range" min="0" max={maxPossibleAdOppFlights} step="5000" value={minAdOppFilter === '' ? 0 : minAdOppFilter} onChange={(e) => setMinAdOppFilter(e.target.value)} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  <div className="flex justify-between items-center text-[10px] text-slate-500"><span>0</span><span>Max: {maxPossibleAdOppFlights.toLocaleString('de-DE')}</span></div>
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

              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Filter className="w-4 h-4" /> Trend Filter</h2>
                <div className="flex gap-2">
                  <button onClick={() => setTrendFilter('all')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300 bg-slate-800'}`}>Alle</button>
                  <button onClick={() => setTrendFilter('positive')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'positive' ? 'bg-emerald-600 text-white' : 'text-emerald-500/50 hover:text-emerald-400 bg-slate-800'}`}>Nur Positiv</button>
                  <button onClick={() => setTrendFilter('negative')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'negative' ? 'bg-red-600 text-white' : 'text-red-500/50 hover:text-red-400 bg-slate-800'}`}>Nur Negativ</button>
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
              {isDefaultDataAcc && (
                <div className="mb-6 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex gap-1.5">
                   <button onClick={() => setAccTimeframe('set1')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${accTimeframe === 'set1' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>WoW (week over week)</button>
                   <button onClick={() => setAccTimeframe('set2')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${accTimeframe === 'set2' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>MoM (month over month)</button>
                </div>
              )}

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
                  <div className="flex flex-wrap gap-1.5">
                    {availableAccCountries.map(country => (
                      <button key={country} onClick={() => toggleAccCountry(country)} title={COUNTRY_NAMES[country] || country} className={`flex justify-center items-center p-1.5 rounded transition-colors border ${activeAccCountries.includes(country) ? 'bg-indigo-600/20 border-indigo-500 opacity-100 shadow-sm scale-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-30 saturate-50 scale-95'}`}>
                        <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* REGIONEN FILTER */}
              {availableAccRegions.length > 0 && (
                <div className="mb-6 relative" ref={dropdownRef}>
                  <div className="flex justify-between items-end mb-2">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><MapIcon className="w-4 h-4" /> Zielregion</h2>
                    <span className="text-[10px] text-slate-500">{activeAccRegions.length} aktiv</span>
                  </div>
                  
                  <button 
                    onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)} 
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-600 hover:border-indigo-500 text-slate-200 text-sm rounded px-3 py-2 transition-colors"
                  >
                    <span className="truncate pr-2">{activeAccRegions.length === availableAccRegions.length ? "Alle Regionen ausgewählt" : `${activeAccRegions.length} Regionen ausgewählt`}</span>
                    {isRegionDropdownOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {isRegionDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-[22rem] flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-slate-700 bg-slate-800/90 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          placeholder="Region oder Land suchen..." 
                          value={regionSearch} 
                          onChange={(e) => setRegionSearch(e.target.value)} 
                          className="w-full bg-slate-900 text-slate-200 text-sm rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-500 border border-slate-700" 
                        />
                      </div>
                      <div className="flex gap-2 p-2 border-b border-slate-700 bg-slate-900/50 shrink-0">
                        <button onClick={() => setActiveAccRegions([...availableAccRegions])} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2">Alle anwählen</button>
                        <span className="text-xs text-slate-600">|</span>
                        <button onClick={() => setActiveAccRegions([])} className="text-xs text-slate-400 hover:text-slate-300 px-2">Alle abwählen</button>
                      </div>
                      
                      <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                        {Object.keys(groupedRegions).length === 0 ? (
                          <div className="text-xs text-slate-500 text-center py-4">Keine Region gefunden</div>
                        ) : (
                          Object.keys(groupedRegions).sort((a, b) => {
                            const nameA = COUNTRY_NAMES[a] || a;
                            const nameB = COUNTRY_NAMES[b] || b;
                            return nameA.localeCompare(nameB);
                          }).map(countryCode => {
                            const regionsInCountry = groupedRegions[countryCode];
                            const allSelected = regionsInCountry.every(r => activeAccRegions.includes(r));
                            const someSelected = regionsInCountry.some(r => activeAccRegions.includes(r));
                            const isExpanded = regionSearch.length > 0 || expandedAccCountries[countryCode];
                            
                            return (
                              <div key={countryCode} className="mb-2 last:mb-0">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-400 bg-slate-900/50 p-1.5 rounded cursor-pointer hover:bg-slate-700/50 transition-colors mb-1">
                                  <div className="flex items-center gap-2 flex-1" onClick={(e) => toggleAccCountryAccordion(countryCode, e)}>
                                    {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                                    {getFlagImgHtml(countryCode) ? (
                                      <span dangerouslySetInnerHTML={{ __html: getFlagImgHtml(countryCode) }} />
                                    ) : null}
                                    <span>{COUNTRY_NAMES[countryCode] || countryCode}</span>
                                  </div>
                                  <div 
                                    className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${allSelected ? 'bg-indigo-500 border-indigo-500' : someSelected ? 'bg-indigo-500/30 border-indigo-500/50' : 'border-slate-500 bg-slate-800'}`}
                                    onClick={() => toggleCountryRegions(countryCode, regionsInCountry)}
                                  >
                                    {allSelected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="pl-7 pr-2 flex flex-col gap-0.5 mb-2">
                                    {regionsInCountry.sort().map(region => (
                                      <label key={region} className="flex items-center gap-2 p-1.5 hover:bg-slate-700/50 rounded cursor-pointer group">
                                        <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${activeAccRegions.includes(region) ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-900 border-slate-600 group-hover:border-indigo-500'}`}>
                                          {activeAccRegions.includes(region) && <CheckCircle className="w-2 h-2 text-white" />}
                                        </div>
                                        <span className={`text-xs truncate select-none ${activeAccRegions.includes(region) ? 'text-slate-200' : 'text-slate-400'}`}>{region}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Min. Interesse</h2>
                <div className="flex flex-col gap-3">
                  <input type="number" min="0" value={accMinAdOppFilter} onChange={handleManualAccMinAdOppChange} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Exakter Wert..." />
                  <input type="range" min="0" max={maxPossibleAdOppAcc} step="5000" value={accMinAdOppFilter === '' ? 0 : accMinAdOppFilter} onChange={(e) => setAccMinAdOppFilter(e.target.value)} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  <div className="flex justify-between items-center text-[10px] text-slate-500"><span>0</span><span>Max: {maxPossibleAdOppAcc.toLocaleString('de-DE')}</span></div>
                </div>
              </div>

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

              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Filter className="w-4 h-4" /> Trend Filter</h2>
                <div className="flex gap-2">
                  <button onClick={() => setTrendFilter('all')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300 bg-slate-800'}`}>Alle</button>
                  <button onClick={() => setTrendFilter('positive')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'positive' ? 'bg-emerald-600 text-white' : 'text-emerald-500/50 hover:text-emerald-400 bg-slate-800'}`}>Nur Positiv</button>
                  <button onClick={() => setTrendFilter('negative')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${trendFilter === 'negative' ? 'bg-red-600 text-white' : 'text-red-500/50 hover:text-red-400 bg-slate-800'}`}>Nur Negativ</button>
                </div>
              </div>
              
              <div className="text-center p-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg mb-6">
                <p className="text-sm text-emerald-400 font-semibold">
                  {accChartData.filteredData.length} Routen berechnet
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
          <span className="text-[10px] text-slate-600">v3.1</span>
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
        
        {/* --- TOP 5 / FLOP 5 PANEL --- */}
        {(top5.length > 0 || flop5.length > 0) && (
          <div className="absolute top-4 right-4 z-30 w-72 flex flex-col gap-4 pointer-events-none">
            {top5.length > 0 && (
              <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 pointer-events-auto">
                <h3 className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> Top 5 (Gewinner)
                </h3>
                <div className="flex flex-col">
                  {renderTopFlopList(top5)}
                </div>
              </div>
            )}
            {flop5.length > 0 && (
              <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 pointer-events-auto">
                <h3 className="text-red-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Flop 5 (Verlierer)
                </h3>
                <div className="flex flex-col">
                  {renderTopFlopList(flop5)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ========================================== */}
      {/* 🚀 ADMIN PANEL (Geheim: 4-Klicks aufs Logo) */}
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
                    <div className="space-y-6">
                      
                      {/* SET 1: WoW */}
                      <div className="p-4 border border-slate-600 rounded bg-slate-900/40">
                        <h4 className="text-sm font-bold text-indigo-400 mb-3 border-b border-slate-700 pb-2">Zeitraum 1 (WoW / 7 Tage)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Aktuell (Current)</label>
                            <div className="flex gap-2 mb-3">
                               <input type="date" value={adminAccDate1Start} onChange={(e) => setAdminAccDate1Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Von" />
                               <input type="date" value={adminAccDate1End} onChange={(e) => setAdminAccDate1End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Bis" />
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
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Vorher (Previous)</label>
                            <div className="flex gap-2 mb-3">
                               <input type="date" value={adminAccDate2Start} onChange={(e) => setAdminAccDate2Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Von" />
                               <input type="date" value={adminAccDate2End} onChange={(e) => setAdminAccDate2End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Bis" />
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
                      </div>

                      {/* SET 2: MoM */}
                      <div className="p-4 border border-slate-600 rounded bg-slate-900/40">
                        <h4 className="text-sm font-bold text-indigo-400 mb-3 border-b border-slate-700 pb-2">Zeitraum 2 (MoM / 30 Tage)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Aktuell (Current)</label>
                            <div className="flex gap-2 mb-3">
                               <input type="date" value={adminAccDate3Start} onChange={(e) => setAdminAccDate3Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Von" />
                               <input type="date" value={adminAccDate3End} onChange={(e) => setAdminAccDate3End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Bis" />
                            </div>
                            <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${adminAccCurrCsv2 ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-500/50 hover:border-indigo-400 hover:bg-slate-700'}`}>
                              {adminAccCurrCsv2 ? (
                                <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-[10px] font-medium break-all px-1">{adminAccCurrCsv2.name}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-300">
                                  <Upload className="w-4 h-4 text-indigo-400" />
                                  <span className="text-[10px] font-medium">CSV Datei wählen</span>
                                </div>
                              )}
                              <input type="file" accept=".csv" className="hidden" onChange={(e) => setAdminAccCurrCsv2(e.target.files[0])} />
                            </label>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Vorher (Previous)</label>
                            <div className="flex gap-2 mb-3">
                               <input type="date" value={adminAccDate4Start} onChange={(e) => setAdminAccDate4Start(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Von" />
                               <input type="date" value={adminAccDate4End} onChange={(e) => setAdminAccDate4End(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5" title="Bis" />
                            </div>
                            <label className={`flex flex-col items-center justify-center w-full p-3 border-2 border-dashed rounded cursor-pointer transition-colors ${adminAccPrevCsv2 ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-500/50 hover:border-indigo-400 hover:bg-slate-700'}`}>
                              {adminAccPrevCsv2 ? (
                                <div className="flex flex-col items-center gap-1 text-emerald-400 text-center">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-[10px] font-medium break-all px-1">{adminAccPrevCsv2.name}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-300">
                                  <Upload className="w-4 h-4 text-indigo-400" />
                                  <span className="text-[10px] font-medium">CSV Datei wählen</span>
                                </div>
                              )}
                              <input type="file" accept=".csv" className="hidden" onChange={(e) => setAdminAccPrevCsv2(e.target.files[0])} />
                            </label>
                          </div>
                        </div>
                      </div>

                      <button onClick={handleAdminSaveAcc} disabled={isSaving || (!adminAccCurrCsv && !adminAccCurrCsv2)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded flex items-center justify-center gap-2 transition-colors">
                        <CloudUpload className="w-4 h-4"/> Eingegebene Sets speichern
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
      {/* 🚀 DIY MODAL */}
      {/* ========================================== */}
      {isDiyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-3">
                <Database className="text-orange-400 w-6 h-6" />
                <h2 className="text-xl font-bold text-white">Eigene Daten analysieren</h2>
              </div>
              <button onClick={() => setIsDiyModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
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
                  <div className="flex items-start gap-2 bg-indigo-900/20 text-indigo-300 p-3 rounded text-xs border border-indigo-500/20 mb-4">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Aus beiden Dateien wird automatisch der Trend (für Ad Opp. &gt; 1.000) berechnet.</p>
                  </div>
                  <button onClick={applyCustomAcc} disabled={!tempAccCurrent || !tempAccPrevious} className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors mt-4">Berechnung starten</button>
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
