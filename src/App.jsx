import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Map as MapIcon, Calendar, TrendingUp, Info, XCircle, EyeOff, Filter, SlidersHorizontal, ChevronDown, ChevronUp, Bed } from 'lucide-react';

// --- STANDARD-DATEN (Ausschnitt aus chart 4 + DACH-Ergänzung) ---
const DEFAULT_CSV = `Route,,,Last 84 Days,,Last 28 Days,,,Last 7 Days,,
Origin,Destination,Route ID,Ad Opp.,YoY,Ad Opp.,MoM,YoY,Ad Opp.,WoW,YoY
GB - London,AE - Dubai,LON-DXB,700000,0.263,200000,-0.397,0.094,30000,-0.239,-0.419
US - New York,GB - London,NYC-LON,500000,-0.008,200000,0.597,0.33,40000,-0.053,-0.126
GB - London,US - New York,LON-NYC,500000,-0.191,100000,-0.145,-0.258,30000,-0.07,-0.232
GB - London,NL - Amsterdam,LON-AMS,400000,-0.202,100000,-0.037,-0.234,30000,-0.061,-0.215
US - New York,PR - San Juan,NYC-SJU,400000,-0.01,100000,-0.247,-0.115,20000,-0.076,-0.179
CZ - Prague,FR - Paris,PRG-PAR,50000,-0.078,10000,-0.094,-0.137,3000,-0.06,-0.11
US - New York,TR - İstanbul,NYC-IST,50000,-0.127,10000,-0.114,-0.175,3000,-0.028,-0.162
GB - London,US - Washington,LON-WAS,50000,-0.239,20000,0.095,-0.153,4000,-0.133,-0.102
US - New York,BB - Bridgetown,NYC-BGI,50000,-0.022,10000,-0.076,-0.032,3000,-0.09,-0.124
BE - Brussels,IT - Milan,BRU-MIL,50000,-0.14,20000,-0.009,-0.056,4000,-0.008,-0.108
HU - Budapest,FR - Paris,BUD-PAR,50000,-0.133,10000,-0.142,-0.214,3000,-0.094,-0.26
GB - London,ES - Bilbao,LON-BIO,50000,-0.095,10000,-0.113,-0.116,3000,-0.052,-0.14
GB - London,IL - Tel Aviv-Yafo,LON-TLV,70000,-0.089,20000,-0.269,-0.197,3000,-0.403,-0.493
DE - Frankfurt,US - New York,FRA-NYC,200000,-0.128,60000,-0.047,-0.165,20000,0.031,-0.133
DE - Frankfurt,TH - Bangkok,FRA-BKK,200000,0.197,50000,-0.12,0.325,10000,-0.096,0.157
AT - Vienna,ES - Barcelona,VIE-BCN,80000,-0.115,20000,-0.052,-0.132,6000,-0.057,-0.172
CH - Zürich,ES - Barcelona,ZRH-BCN,70000,0.06,30000,0.174,0.099,7000,-0.018,0.13`;

// --- HILFSFUNKTIONEN FÜR LÄNDER & FLAGGEN ---
const getFlagImgHtml = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '';
  return `<img src="https://flagcdn.com/w20/${countryCode.toLowerCase()}.png" style="width:16px; height:auto; display:inline-block; vertical-align:middle; border-radius:2px; margin-right:4px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);" alt="${countryCode}" />`;
};

const COUNTRY_NAMES = {
  "DE": "Deutschland", "AT": "Österreich", "CH": "Schweiz", "US": "USA", "GB": "Großbritannien",
  "FR": "Frankreich", "ES": "Spanien", "IT": "Italien", "NL": "Niederlande", "TR": "Türkei",
  "AE": "Ver. Arab. Emirate", "TH": "Thailand", "SG": "Singapur", "CZ": "Tschechien",
  "PR": "Puerto Rico", "BB": "Barbados", "BE": "Belgien", "HU": "Ungarn", "IL": "Israel",
  "CA": "Kanada", "BG": "Bulgarien", "IE": "Irland", "MX": "Mexiko", "VE": "Venezuela",
  "MA": "Marokko", "IN": "Indien", "DZ": "Algerien", "MG": "Madagaskar", "AW": "Aruba",
  "CO": "Kolumbien", "EG": "Ägypten", "ZA": "Südafrika", "GR": "Griechenland", "CY": "Zypern",
  "MT": "Malta", "HR": "Kroatien", "IS": "Island", "NO": "Norwegen", "SE": "Schweden",
  "DK": "Dänemark", "FI": "Finnland", "PL": "Polen", "RO": "Rumänien", "PT": "Portugal",
  "QA": "Katar", "JP": "Japan", "KR": "Südkorea", "TW": "Taiwan", "PH": "Philippinen",
  "MY": "Malaysia", "ID": "Indonesien", "VN": "Vietnam", "AU": "Australien", "NZ": "Neuseeland",
  "SC": "Seychellen", "BR": "Brasilien", "AR": "Argentinien", "PE": "Peru", "CN": "China",
  "RU": "Russland", "DO": "Dominikanische Rep.", "JM": "Jamaika", "KE": "Kenia", "NG": "Nigeria",
  "PK": "Pakistan", "SA": "Saudi-Arabien", "LK": "Sri Lanka", "MV": "Malediven", "MU": "Mauritius",
  "BS": "Bahamas", "CU": "Kuba", "CR": "Costa Rica", "SV": "El Salvador", "GT": "Guatemala",
  "HN": "Honduras", "NI": "Nicaragua", "PA": "Panama", "CL": "Chile", "UY": "Uruguay",
  "BO": "Bolivien", "PY": "Paraguay", "EC": "Ecuador", "GY": "Guyana", "SR": "Suriname",
  "GF": "Französisch-Guayana", "CI": "Elfenbeinküste", "GH": "Ghana", "SN": "Senegal",
  "TN": "Tunesien", "AL": "Albanien", "ME": "Montenegro", "RS": "Serbien", "BA": "Bosnien & Herz.",
  "MK": "Nordmazedonien", "XK": "Kosovo", "MD": "Moldau", "BY": "Belarus", "UA": "Ukraine",
  "EE": "Estland", "LV": "Lettland", "LT": "Litauen", "SK": "Slowakei", "SI": "Slowenien",
  "LU": "Luxemburg", "LI": "Liechtenstein", "MC": "Monaco", "SM": "San Marino", "VA": "Vatikanstadt",
  "AD": "Andorra", "TZ": "Tansania", "CV": "Kap Verde", "PF": "Franz.-Polynesien"
};

const COUNTRY_TO_CONTINENT = {
  "DE": "Europa", "AT": "Europa", "CH": "Europa", "GB": "Europa", "FR": "Europa", "ES": "Europa", "IT": "Europa", "NL": "Europa", "CZ": "Europa", "BE": "Europa", "HU": "Europa", "BG": "Europa", "IE": "Europa", "GR": "Europa", "CY": "Europa", "MT": "Europa", "HR": "Europa", "IS": "Europa", "NO": "Europa", "SE": "Europa", "DK": "Europa", "FI": "Europa", "PL": "Europa", "RO": "Europa", "PT": "Europa", "AL": "Europa", "ME": "Europa", "RS": "Europa", "BA": "Europa", "MK": "Europa", "XK": "Europa", "MD": "Europa", "BY": "Europa", "UA": "Europa", "EE": "Europa", "LV": "Europa", "LT": "Europa", "SK": "Europa", "SI": "Europa", "LU": "Europa", "LI": "Europa", "MC": "Europa", "SM": "Europa", "VA": "Europa", "AD": "Europa",
  "US": "Nord- & Mittelamerika", "CA": "Nord- & Mittelamerika", "MX": "Nord- & Mittelamerika", "PR": "Nord- & Mittelamerika", "BB": "Nord- & Mittelamerika", "AW": "Nord- & Mittelamerika", "DO": "Nord- & Mittelamerika", "JM": "Nord- & Mittelamerika", "BS": "Nord- & Mittelamerika", "CU": "Nord- & Mittelamerika", "CR": "Nord- & Mittelamerika", "SV": "Nord- & Mittelamerika", "GT": "Nord- & Mittelamerika", "HN": "Nord- & Mittelamerika", "NI": "Nord- & Mittelamerika", "PA": "Nord- & Mittelamerika",
  "CO": "Südamerika", "VE": "Südamerika", "BR": "Südamerika", "AR": "Südamerika", "PE": "Südamerika", "CL": "Südamerika", "UY": "Südamerika", "BO": "Südamerika", "PY": "Südamerika", "EC": "Südamerika", "GY": "Südamerika", "SR": "Südamerika", "GF": "Südamerika",
  "TH": "Asien", "SG": "Asien", "IN": "Asien", "JP": "Asien", "KR": "Asien", "TW": "Asien", "PH": "Asien", "MY": "Asien", "ID": "Asien", "VN": "Asien", "CN": "Asien", "RU": "Asien", "PK": "Asien", "LK": "Asien", "MV": "Asien",
  "TR": "Naher Osten", "AE": "Naher Osten", "IL": "Naher Osten", "QA": "Naher Osten", "SA": "Naher Osten",
  "MA": "Afrika", "DZ": "Afrika", "MG": "Afrika", "EG": "Afrika", "ZA": "Afrika", "KE": "Afrika", "NG": "Afrika", "MU": "Afrika", "SC": "Afrika", "CI": "Afrika", "GH": "Afrika", "SN": "Afrika", "TN": "Afrika", "TZ": "Afrika", "CV": "Afrika",
  "AU": "Ozeanien", "NZ": "Ozeanien", "PF": "Ozeanien"
};

// --- GEO-KOORDINATEN WÖRTERBUCH ---
const CITY_COORDS = {
  "Frankfurt": [8.6821, 50.1109], "Düsseldorf": [6.7735, 51.2277], "Berlin": [13.4050, 52.5200],
  "Stuttgart": [9.1829, 48.7758], "Munich": [11.5820, 48.1351], "Hamburg": [9.9937, 53.5511],
  "Cologne": [6.9531, 50.9375], "Vienna": [16.3738, 48.2082], "Salzburg": [13.0440, 47.8095],
  "Zürich": [8.5417, 47.3769], "Geneva": [6.1432, 46.2044], "Basel": [7.5886, 47.5596],
  "Palma": [2.6502, 39.5696], "Barcelona": [2.1734, 41.3851], "Madrid": [-3.7038, 40.4168],
  "Málaga": [-4.4214, 36.7213], "Alicante": [-0.4907, 38.3460], "Tenerife": [-16.2518, 28.2916],
  "Gran Canaria": [-15.5474, 27.9202], "Lanzarote": [-13.6234, 29.0469], "Fuerteventura": [-14.0135, 28.3587],
  "Ibiza": [1.4330, 38.9067], "Lisbon": [-9.1393, 38.7223], "Faro": [-7.9304, 37.0194],
  "Madeira": [-16.9081, 32.6669], "Rome": [12.4964, 41.9028], "Milan": [9.1900, 45.4642],
  "Venice": [12.3155, 45.4408], "Naples": [14.2681, 40.8518], "Palermo": [13.3615, 38.1157],
  "Catania": [15.0873, 37.5079], "Olbia": [9.4977, 40.9233], "London": [-0.1278, 51.5074],
  "Paris": [2.3522, 48.8566], "Amsterdam": [4.9041, 52.3676], "Athens": [23.7275, 37.9838],
  "Thessaloniki": [22.9444, 40.6401], "Heraklion": [25.1325, 35.3387], "Rhodes": [28.2278, 36.4341],
  "Corfu": [19.9197, 39.6243], "Kos": [27.2887, 36.8932], "Larnaca": [33.6292, 34.9157],
  "Paphos": [32.4245, 34.7720], "Malta": [14.5146, 35.8989], "Dubrovnik": [18.0944, 42.6507],
  "Split": [16.4402, 43.5081], "Sofia": [23.3219, 42.6977], "Dublin": [-6.2603, 53.3498],
  "Brussels": [4.3517, 50.8503], "Budapest": [19.0402, 47.4979], "Bilbao": [-2.9350, 43.2630],
  "Prague": [14.4378, 50.0755], "Oslo": [10.7522, 59.9139],
  "Stockholm": [18.0686, 59.3293], "Copenhagen": [12.5683, 55.6761], "Helsinki": [24.9384, 60.1699],
  "Warsaw": [21.0122, 52.2297], "Bucharest": [26.1025, 44.4267],
  "Edinburgh": [-3.1882, 55.9532], "Manchester": [-2.2426, 53.4807], "Birmingham": [-1.8904, 52.4862],
  "Porto": [-8.6109, 41.1496],
  "İstanbul": [28.9784, 41.0082], "Antalya": [30.7133, 36.8969], "Izmir": [27.1428, 38.4237],
  "Hurghada": [33.8116, 27.2579], "Sharm El-Sheikh": [34.3268, 27.9158], "Marsa Alam": [34.8933, 25.0676],
  "Dubai": [55.2708, 25.2048], "Abu Dhabi": [54.3667, 24.4667], "Doha": [51.5310, 25.2854],
  "Bangkok": [100.5018, 13.7563], "Phuket": [98.3923, 7.8804], "Singapore": [103.8198, 1.3521], 
  "Male": [73.5093, 4.1755], "Denpasar": [115.2166, -8.6500], "Colombo": [79.8612, 6.9271], 
  "Mauritius": [57.5522, -20.3484], "Tokyo": [139.6917, 35.6895], "Osaka": [135.5023, 34.6937],
  "Seoul": [126.9780, 37.5665], "Taipei": [121.5654, 25.0330], "Manila": [120.9842, 14.5995],
  "Kuala Lumpur": [101.6869, 3.1390], "Jakarta": [106.8229, -6.2088], "Ho Chi Minh City": [106.6296, 10.8230],
  "Sydney": [151.2093, -33.8688], "Melbourne": [144.9631, -37.8136], "Brisbane": [153.0251, -27.4697],
  "Auckland": [174.7633, -36.8485], "Cape Town": [18.4232, -33.9249], "Johannesburg": [28.0473, -26.2041],
  "Seychelles": [55.4919, -4.6795],
  "New York": [-74.0060, 40.7128], "Miami": [-80.1918, 25.7617], "Orlando": [-81.3792, 28.5383],
  "Tampa": [-82.4572, 27.9506], "Los Angeles": [-118.2437, 34.0522], "Las Vegas": [-115.1398, 36.1699], 
  "San Francisco": [-122.4194, 37.7749], "Denver": [-104.9903, 39.7392], "Atlanta": [-84.3880, 33.7490], 
  "New Orleans": [-90.0715, 29.9511], "Washington": [-77.0369, 38.9072], "Chicago": [-87.6297, 41.8781],
  "Boston": [-71.0588, 42.3600], "Dallas": [-96.7969, 32.7766], "Houston": [-95.3698, 29.7604],
  "Seattle": [-122.3320, 47.6062], "Honolulu": [-157.8583, 21.3069], "Toronto": [-79.3832, 43.6532], 
  "Vancouver": [-123.1207, 49.2827], "Montreal": [-73.5672, 45.5016], "Cancun": [-86.8515, 21.1619], 
  "Punta Cana": [-68.3708, 18.5820], "Havana": [-82.3666, 23.1136], "Bridgetown": [-59.6167, 13.0968],
  "San Juan": [-66.1057, 18.4655], "Mexico City": [-99.1332, 19.4326], "Rio de Janeiro": [-43.1729, -22.9068],
  "São Paulo": [-46.6333, -23.5505], "Buenos Aires": [-58.3816, -34.6037], "Lima": [-77.0428, -12.0464],
  "Bogotá": [-74.0721, 4.7110], "Tel Aviv": [34.8000, 32.0833], "Tel Aviv-Yafo": [34.8000, 32.0833],
  "Abidjan": [-4.0083, 5.3600], "Accra": [-0.1870, 5.6037], "Agadir": [-9.5981, 30.4278],
  "Ahmedabad": [72.5714, 23.0225], "Algiers": [3.0588, 36.7538], "Antananarivo": [47.5079, -18.8792],
  "Aruba": [-70.0351, 12.5211], "Oranjestad": [-70.0351, 12.5211], "Baltimore": [-76.6122, 39.2904],
  "Bari": [16.8719, 41.1171], "Beijing": [116.4074, 39.9042], "Bengaluru": [77.5946, 12.9716],
  "Bologna": [11.3426, 44.4949], "Bordeaux": [-0.5792, 44.8378], "Bristol": [-2.5879, 51.4545], 
  "Cairo": [31.2357, 30.0444], "Calgary": [-114.0719, 51.0447], "Cancún": [-86.8515, 21.1619], 
  "Caracas": [-66.9036, 10.4806], "Casablanca": [-7.5898, 33.5731], "Charlotte": [-80.8431, 35.2271], 
  "Chennai": [80.2707, 13.0827], "Cork": [-8.4756, 51.8985], "Curaçao": [-68.9421, 12.1165], 
  "Willemstad": [-68.9421, 12.1165], "Dakar": [-17.4677, 14.7167], "Detroit": [-83.0458, 42.3314], 
  "Dhaka": [90.4125, 23.8103], "Djerba": [10.8451, 33.8076], "Florence": [11.2558, 43.7696], 
  "Fort Lauderdale": [-80.1373, 26.1224], "Georgetown": [-58.1551, 6.8013], "Glasgow": [-4.2518, 55.8642], 
  "Goa": [73.8278, 15.4909], "Panaji": [73.8278, 15.4909], "Guadalajara": [-103.3496, 20.6597], 
  "Guatemala City": [-90.5069, 14.6349], "Hanoi": [105.8542, 21.0285], "Hanover": [9.7320, 52.3759], 
  "Hannover": [9.7320, 52.3759], "Hartford": [-72.6734, 41.7658], "Hong Kong": [114.1694, 22.3193], 
  "Hyderabad": [78.4867, 17.3850], "Islamabad": [73.0479, 33.6844], "Jeddah": [39.1925, 21.4858], 
  "Jersey": [-2.1100, 49.1828], "Saint Helier": [-2.1100, 49.1828], "Karachi": [67.0011, 24.8607], 
  "Kochi": [76.2673, 9.9312], "Kraków": [19.9450, 50.0647], "Lagos": [3.3792, 6.5244], 
  "Lahore": [74.3587, 31.5204], "Las Palmas de Gran Canaria": [-15.4363, 28.1235], "Lille": [3.0573, 50.6292], 
  "Liverpool": [-2.9916, 53.4084], "Lyon": [4.8357, 45.7640], "Mahé": [55.4920, -4.6796], 
  "Mahe": [55.4920, -4.6796], "Malé": [73.5093, 4.1755], "Marrakesh": [-7.9811, 31.6295], 
  "Marseille": [5.3698, 43.2965], "Mauritius Island": [57.5012, -20.1609], "Port Louis": [57.5012, -20.1609], 
  "Minneapolis": [-93.2650, 44.9778], "Montego Bay": [-77.8939, 18.4762], "Mumbai": [72.8777, 19.0760], 
  "Nairobi": [36.8219, -1.2921], "Nantes": [-1.5536, 47.2184], "New Delhi": [77.2090, 28.6139], 
  "Newark": [-74.1724, 40.7357], "Newcastle upon Tyne": [-1.6178, 54.9783], "Newcastle": [-1.6178, 54.9783], 
  "Nice": [7.2620, 43.7102], "Oran": [-0.6349, 35.6987], "Oujda": [-1.9114, 34.6867], 
  "Paramaribo": [-55.2038, 5.8520], "Perth": [115.8605, -31.9505], "Philadelphia": [-75.1652, 39.9526], 
  "Phoenix": [-112.0740, 33.4484], "Podgorica": [19.2594, 42.4304], "Pointe-à-Pitre": [-61.5167, 16.2333], 
  "Puerto Vallarta": [-105.2253, 20.6534], "Quito": [-78.4678, -0.1807], "Rabat": [-6.8416, 34.0209], 
  "Raleigh": [-78.6382, 35.7796], "Reykjavík": [-21.9426, 64.1466], "Riyadh": [46.6753, 24.7136], 
  "Saint Martin": [-63.0822, 18.0708], "Marigot": [-63.0822, 18.0708], "Sal": [-22.9248, 16.7454], 
  "San José": [-84.0907, 9.9281], "San Salvador": [-89.2182, 13.6929], "Santiago De Los Caballeros": [-70.6871, 19.4517], 
  "Santo Domingo": [-69.9312, 18.4861], "Seville": [-5.9845, 37.3891], "Shanghai": [121.4737, 31.2304], 
  "Sharm El Sheikh": [34.3299, 27.9158], "Tahiti": [-149.5585, -17.5516], "Papeete": [-149.5585, -17.5516], 
  "Tirana": [19.8187, 41.3275], "Toulouse": [1.4442, 43.6047], "Tunis": [10.1815, 36.8065], 
  "Valencia": [-0.3763, 39.4699], "Zagreb": [15.9819, 45.8150], "Zanzibar City": [39.2026, -6.1659], 
  "Zanzibar": [39.2026, -6.1659]
};

const PLANE_PATH = 'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z';

export default function App() {
  const [activeTab, setActiveTab] = useState('flights'); // NEU: Tab-Steuerung

  const [data, setData] = useState([]);
  const [disabledRoutes, setDisabledRoutes] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [activeCountries, setActiveCountries] = useState([]);
  const [availableDestCountries, setAvailableDestCountries] = useState([]);
  const [activeDestCountries, setActiveDestCountries] = useState([]);
  
  const [timeframe, setTimeframe] = useState('84d'); 
  const [trendType, setTrendType] = useState('yoy'); 
  const [minAdOppFilter, setMinAdOppFilter] = useState(''); 
  const [echartsReady, setEchartsReady] = useState(false);
  const [isDestExpanded, setIsDestExpanded] = useState(false);
  
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // CSV Parsing
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const parsedData = [];
    const delimiter = lines[1] && lines[1].includes(';') ? ';' : ',';
    
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(delimiter);
      
      const originFull = cols[0];
      const destFull = cols[1];
      
      const originCountry = originFull.includes('-') ? originFull.split('-')[0].trim() : 'Unbekannt';
      const originCity = originFull.includes('-') ? originFull.split('-')[1].trim() : originFull;
      const destCountry = destFull.includes('-') ? destFull.split('-')[0].trim() : 'Unbekannt';
      const destCity = destFull.includes('-') ? destFull.split('-')[1].trim() : destFull;

      const hasOrigin = !!CITY_COORDS[originCity];
      const hasDest = !!CITY_COORDS[destCity];

      if (hasOrigin && hasDest) {
        parsedData.push({
          originCountry, originCity, destCountry, destCity,
          routeId: cols[2],
          d84_ad: parseFloat(cols[3]) || 0,
          d84_yoy: parseFloat(cols[4]) || 0,
          d28_ad: parseFloat(cols[5]) || 0,
          d28_mom: parseFloat(cols[6]) || 0,
          d28_yoy: parseFloat(cols[7]) || 0,
          d7_ad: parseFloat(cols[8]) || 0,
          d7_wow: parseFloat(cols[9]) || 0,
          d7_yoy: parseFloat(cols[10]) || 0
        });
      }
    }
    return parsedData;
  };

  const getTrendColor = (trend) => {
    if (trend <= -0.20) return '#dc2626'; 
    if (trend < 0) return '#fca5a5';      
    if (trend === 0) return '#94a3b8';    
    if (trend <= 0.20) return '#6ee7b7';  
    return '#10b981';                     
  };

  // Init ECharts & Data
  useEffect(() => {
    const parsedData = parseCSV(DEFAULT_CSV);
    setData(parsedData);
    
    const countries = [...new Set(parsedData.map(d => d.originCountry))].sort();
    setAvailableCountries(countries);
    
    const defaultActive = ['DE', 'AT', 'CH'];
    const initialActive = countries.filter(c => defaultActive.includes(c));
    setActiveCountries(initialActive.length > 0 ? initialActive : countries);

    const destCountries = [...new Set(parsedData.map(d => d.destCountry))].sort();
    setAvailableDestCountries(destCountries);
    
    const initialDestActive = destCountries.filter(c => defaultActive.includes(c));
    setActiveDestCountries(initialDestActive.length > 0 ? initialDestActive : destCountries);

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
  }, []);

  // Upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    let allParsedData = [];

    for (const file of files) {
      const text = await file.text();
      const parsedData = parseCSV(text);
      allParsedData = [...allParsedData, ...parsedData];
    }

    setDisabledRoutes([]); 
    setData(allParsedData);
    
    const countries = [...new Set(allParsedData.map(d => d.originCountry))].sort();
    setAvailableCountries(countries);
    
    const defaultActive = ['DE', 'AT', 'CH'];
    const initialActive = countries.filter(c => defaultActive.includes(c));
    setActiveCountries(initialActive.length > 0 ? initialActive : countries);

    const destCountries = [...new Set(allParsedData.map(d => d.destCountry))].sort();
    setAvailableDestCountries(destCountries);
    
    const initialDestActive = destCountries.filter(c => defaultActive.includes(c));
    setActiveDestCountries(initialDestActive.length > 0 ? initialDestActive : destCountries);
  };

  const validDestCountries = useMemo(() => {
    const valid = new Set();
    data.forEach(row => {
      if (activeCountries.includes(row.originCountry)) {
        valid.add(row.destCountry);
      }
    });
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

  useEffect(() => {
    const currentMin = Number(minAdOppFilter) || 0;
    if (currentMin > maxPossibleAdOpp) {
      setMinAdOppFilter('');
    }
    if (timeframe === '84d' && trendType !== 'yoy') {
      setTrendType('yoy');
    }
  }, [timeframe, trendType, maxPossibleAdOpp, minAdOppFilter]);

  // Chart Rendering
  useEffect(() => {
    if (!echartsReady || !chartRef.current || data.length === 0 || activeTab !== 'flights') return;

    if (!chartInstance.current) {
      chartInstance.current = window.echarts.init(chartRef.current);
    }

    const activeDataRaw = data.filter(r => 
      !disabledRoutes.includes(r.routeId) && 
      activeCountries.includes(r.originCountry) &&
      activeDestCountries.includes(r.destCountry)
    );

    let minAd = Infinity;
    let maxAd = -Infinity;
    
    const activeMinAdOpp = Number(minAdOppFilter) || 0;

    const currentData = activeDataRaw.map(row => {
      let adOpp, trend, trendLabel;

      if (timeframe === '84d') {
        adOpp = row.d84_ad; trend = row.d84_yoy; trendLabel = 'Vorjahr (YoY)';
      } else if (timeframe === '28d') {
        adOpp = row.d28_ad; trend = trendType === 'yoy' ? row.d28_yoy : row.d28_mom; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorperiode (MoM)';
      } else {
        adOpp = row.d7_ad; trend = trendType === 'yoy' ? row.d7_yoy : row.d7_wow; trendLabel = trendType === 'yoy' ? 'Vorjahr (YoY)' : 'Vorwoche (WoW)';
      }

      if (adOpp < minAd) minAd = adOpp;
      if (adOpp > maxAd) maxAd = adOpp;

      return { ...row, currentAdOpp: adOpp, currentTrend: trend, trendLabel };
    })
    .filter(row => row.currentAdOpp > 0 && row.currentAdOpp >= activeMinAdOpp); 

    if (minAd === maxAd) minAd = 0;

    const lineData = currentData.map(row => {
      const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.currentAdOpp - minAd) / (maxAd - minAd))) : 3;

      return {
        coords: [CITY_COORDS[row.originCity], CITY_COORDS[row.destCity]],
        lineStyle: { width: width, color: getTrendColor(row.currentTrend), curveness: 0.2 },
        details: row
      };
    });

    const scatterData = [];
    currentData.forEach(row => {
      if (!scatterData.find(s => s.name === row.originCity)) scatterData.push({ name: row.originCity, value: CITY_COORDS[row.originCity] });
      if (!scatterData.find(s => s.name === row.destCity)) scatterData.push({ name: row.destCity, value: CITY_COORDS[row.destCity] });
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        enterable: true,
        hideDelay: 1000, 
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
        formatter: (params) => {
          if (params.seriesType === 'lines') {
            const d = params.data.details;
            const trendPercent = (d.currentTrend * 100).toFixed(1);
            const trendColor = getTrendColor(d.currentTrend);
            const sign = d.currentTrend > 0 ? '+' : '';
            
            const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(d.originCity)}%20to%20${encodeURIComponent(d.destCity)}`;

            return `
              <div style="font-weight:600; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center;">
                ${getFlagImgHtml(d.originCountry)}<span style="vertical-align:middle;">${d.originCity}</span> 
                <span style="margin: 0 6px;">➔</span> 
                ${getFlagImgHtml(d.destCountry)}<span style="vertical-align:middle;">${d.destCity}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#94a3b8; margin-right: 12px;">Suchvolumen (Ad Opp.):</span> 
                <span style="font-weight:bold">${d.currentAdOpp.toLocaleString('de-DE')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                <span style="color:#94a3b8; margin-right: 12px;">Trend (${d.trendLabel}):</span> 
                <span style="font-weight:bold; color:${trendColor}">${sign}${trendPercent}%</span>
              </div>
              
              <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #334155; text-align: center;">
                <a href="${googleFlightsUrl}" target="_blank" rel="noopener noreferrer" 
                   style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 500; transition: background 0.2s;">
                  ✈️ Aktuelle Preise prüfen
                </a>
              </div>
              <div style="font-size: 9px; color: #64748b; margin-top: 8px; text-align: center;">
                Tipp: Klicke auf die Route, um sie auszublenden.
              </div>
            `;
          }
          return params.name;
        }
      },
      geo: {
        map: 'world', roam: true, center: [30, 35], zoom: 2.2,
        itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
        emphasis: { itemStyle: { areaColor: '#334155' }, label: { show: false } }
      },
      series: [
        {
          type: 'lines', coordinateSystem: 'geo', zlevel: 2,
          effect: {
            show: true, period: 6, trailLength: 0,
            symbol: PLANE_PATH, symbolSize: 15
          },
          lineStyle: { opacity: 0.6 },
          data: lineData
        },
        {
          type: 'scatter', coordinateSystem: 'geo', zlevel: 3, symbolSize: 5,
          itemStyle: { color: '#cbd5e1' },
          label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#94a3b8', fontSize: 10 } },
          data: scatterData
        }
      ]
    };

    chartInstance.current.setOption(option, { replaceMerge: ['series'] }); 

    chartInstance.current.off('click'); 
    chartInstance.current.on('click', function(params) {
      if (params.componentType === 'series' && params.seriesType === 'lines') {
        const routeId = params.data.details.routeId;
        if (!disabledRoutes.includes(routeId)) {
          setDisabledRoutes(prev => [...prev, routeId]);
        }
      }
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, timeframe, trendType, echartsReady, disabledRoutes, activeCountries, activeDestCountries, minAdOppFilter, activeTab]);

  const toggleDisabledRoute = (routeId) => {
    setDisabledRoutes(prev => prev.filter(id => id !== routeId));
  };

  const toggleCountry = (country) => {
    setActiveCountries(prev => 
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  };

  const toggleDestCountry = (country) => {
    setActiveDestCountries(prev => 
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  };

  const setContinentAll = (countriesInContinent) => {
    setActiveDestCountries(prev => {
      const newSet = new Set(prev);
      countriesInContinent.forEach(c => newSet.add(c));
      return Array.from(newSet);
    });
  };

  const setContinentNone = (countriesInContinent) => {
    setActiveDestCountries(prev => prev.filter(c => !countriesInContinent.includes(c)));
  };

  const handleManualMinAdOppChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setMinAdOppFilter(''); 
    } else {
      const numericValue = parseInt(val, 10);
      if (!isNaN(numericValue) && numericValue >= 0) {
        setMinAdOppFilter(numericValue.toString());
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-sans">
      
      {/* SIDEBAR */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col z-10 shadow-xl overflow-y-auto custom-scrollbar">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <MapIcon className="text-blue-400 w-8 h-8 shrink-0" />
            <h1 className="text-xl font-bold text-white leading-tight">TAC<br/><span className="text-sm font-normal text-slate-400">Travel Trends</span></h1>
          </div>

          {/* TAB-STEUERUNG */}
          <div className="flex bg-slate-900 rounded-lg p-1 mb-6 border border-slate-700">
            <button 
              onClick={() => setActiveTab('flights')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'flights' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>✈️</span> Flüge
            </button>
            <button 
              onClick={() => setActiveTab('accommodations')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'accommodations' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Bed className="w-4 h-4" /> Unterkünfte
            </button>
          </div>
          
          {/* INHALT DER SEITENLEISTE (Abhängig vom aktiven Tab) */}
          {activeTab === 'flights' ? (
            <>
              {/* Datei Upload */}
              <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <label className="flex items-center justify-center w-full p-3 border-2 border-dashed border-slate-500 rounded-md cursor-pointer hover:border-blue-400 hover:bg-slate-700 transition-colors">
                  <Upload className="w-5 h-5 mr-2 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">CSV hochladen</span>
                  <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
                </label>
                <div className="mt-2 text-[11px] text-slate-400 flex items-start gap-1">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Mehrere Dateien gleichzeitig markieren und auswählbar.</span>
                </div>
              </div>

              {/* Abflugland Filter */}
              {availableCountries.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Abflugland
                    </h2>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveCountries([...availableCountries])} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">Alle</button>
                      <span className="text-[10px] text-slate-500">|</span>
                      <button onClick={() => setActiveCountries([])} className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors">Keines</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {availableCountries.map(country => {
                      const isActive = activeCountries.includes(country);
                      return (
                        <button
                          key={country}
                          onClick={() => toggleCountry(country)}
                          title={COUNTRY_NAMES[country] || country}
                          className={`w-full flex justify-center items-center py-1.5 rounded transition-colors border ${
                            isActive 
                              ? 'bg-blue-600/20 border-blue-500 opacity-100' 
                              : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-50 grayscale'
                          }`}
                        >
                          <img src={`https://flagcdn.com/w40/${country.toLowerCase()}.png`} alt={country} className="w-6 rounded-sm shadow-sm" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Zielland Filter */}
              {availableDestCountries.length > 0 && (
                <div className="mb-6 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                  <div 
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() => setIsDestExpanded(!isDestExpanded)}
                  >
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Zielland
                    </h2>
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
                              const isActive = activeDestCountries.includes(country);
                              const isValid = validDestCountries.includes(country); 
                              
                              return (
                                <button
                                  key={`dest-${country}`}
                                  onClick={() => isValid && toggleDestCountry(country)}
                                  title={!isValid ? `${COUNTRY_NAMES[country] || country} (Keine Routen)` : (COUNTRY_NAMES[country] || country)}
                                  className={`w-full flex justify-center items-center py-1.5 rounded transition-colors border ${
                                    !isValid
                                      ? 'opacity-10 cursor-not-allowed bg-slate-900 border-slate-800 grayscale' 
                                      : isActive 
                                        ? 'bg-emerald-600/20 border-emerald-500 opacity-100' 
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700 opacity-50 grayscale'
                                  }`}
                                >
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

              {/* Ad Opp Slider */}
              <div className="mb-6 p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" /> Min. Ad Opp.
                </h2>
                
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    type="number" 
                    min="0" 
                    value={minAdOppFilter} 
                    onChange={handleManualMinAdOppChange}
                    className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Exakter Wert..."
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max={maxPossibleAdOpp} 
                    step="5000" 
                    value={minAdOppFilter === '' ? 0 : minAdOppFilter} 
                    onChange={(e) => setMinAdOppFilter(e.target.value)}
                    className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                    <span>0</span>
                    <span>Max: {maxPossibleAdOpp.toLocaleString('de-DE')}</span>
                  </div>
                </div>
              </div>

              {/* Zeitraum */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Zeitraum
                </h2>
                <div className="flex flex-col gap-2">
                  {[
                    { id: '84d', label: 'Letzte 84 Tage' },
                    { id: '28d', label: 'Letzte 28 Tage' },
                    { id: '7d', label: 'Letzte 7 Tage' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTimeframe(opt.id)}
                      className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${
                        timeframe === opt.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vergleich */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Trend-Basis (Farbe)
                </h2>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setTrendType('yoy')}
                    className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${
                      trendType === 'yoy' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    Vorjahr (YoY)
                  </button>
                  <button
                    onClick={() => setTrendType('mom_wow')}
                    disabled={timeframe === '84d'}
                    className={`px-4 py-2 text-left rounded-md text-sm font-medium transition-colors ${
                      timeframe === '84d' ? 'opacity-50 cursor-not-allowed bg-slate-800/50 text-slate-500 border-slate-800' :
                      trendType === 'mom_wow' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    Vorperiode (MoM / WoW)
                  </button>
                </div>
              </div>

              {/* Deaktivierte Routen */}
              {disabledRoutes.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <EyeOff className="w-4 h-4" /> Ausgeblendete Routen
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {disabledRoutes.map(routeId => (
                      <button
                        key={routeId}
                        onClick={() => toggleDisabledRoute(routeId)}
                        className="flex items-center justify-between px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-300 transition-colors group"
                      >
                        <span>{routeId}</span>
                        <XCircle className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Legende */}
              <div className="mb-6">
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
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Negativ</span>
                    <span>Neutral</span>
                    <span>Positiv</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-300 mb-2">Ad Opp. (Dicke)</p>
                  <div className="flex items-center gap-2">
                    <div className="h-[1.5px] w-8 bg-slate-400 rounded-full"></div>
                    <span className="text-[10px] text-slate-400 flex-1 text-center">bis</span>
                    <div className="h-[5px] w-12 bg-slate-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // PLATZHALTER FÜR UNTERKÜNFTE
            <div className="flex flex-col gap-4 text-slate-400 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 text-sm text-center">
              <Bed className="w-12 h-12 text-indigo-500 mx-auto opacity-80" />
              <p>Hier kannst du bald die Nachfrage-Trends für <strong className="text-indigo-400">Unterkünfte</strong> hochladen und analysieren.</p>
              <p className="text-xs opacity-70">Die Logik für diesen Bereich muss noch an die Struktur deiner Hotel-Daten angepasst werden.</p>
            </div>
          )}
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div className="flex-1 relative">
        {activeTab === 'flights' ? (
          <>
            {!echartsReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
                <div className="text-center animate-pulse text-blue-400 flex flex-col items-center">
                  <MapIcon className="w-12 h-12 mb-3" />
                  <p>Lade Weltkarte & Visualisierung...</p>
                </div>
              </div>
            )}
            <div ref={chartRef} className="w-full h-full" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
            <div className="text-center text-slate-500 flex flex-col items-center">
              <Bed className="w-16 h-16 mb-4 text-slate-700" />
              <h2 className="text-2xl font-bold text-slate-400 mb-2">Unterkünfte & Hotels</h2>
              <p className="max-w-md">Dieses Modul wird freigeschaltet, sobald wir die neue Datenstruktur für die Hotel-Suchanfragen definiert haben.</p>
            </div>
          </div>
        )}
      </div>

      {/* Styles für eine unsichtbare/schöne Scrollbar in der Sidebar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }

        /* Entfernt die Pfeile (Spinners) bei num-Inputs */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}} />
    </div>
  );
}