import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Map as MapIcon, Calendar, TrendingUp, Info, XCircle, EyeOff, Filter, SlidersHorizontal, ChevronDown, ChevronUp, Bed, CheckCircle, User, RefreshCw } from 'lucide-react';

// ==========================================
// 🛠️ DATEN-UPDATE BEREICH (Wöchentlich anpassen)
// ==========================================

const FLIGHTS_LAST_UPDATED = "24. Oktober 2023";
const ACC_LAST_UPDATED = "KW 42 vs. KW 41 (2023)";

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
IT,CH,Tessin,International,500000`; // Beispiel-Daten für Tessin hinzugefügt

// Fiktive Vorwochen-Daten für das Beispiel (um Trends zu generieren)
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
IT,CH,Tessin,International,400000`; // Beispiel-Daten für Tessin

// ==========================================
// 🔧 HILFSFUNKTIONEN & WÖRTERBÜCHER
// ==========================================

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
  "MA": "Marokko", "IN": "Indien", "DZ": "Algerien", "EG": "Ägypten", "ZA": "Südafrika", 
  "GR": "Griechenland", "CY": "Zypern", "HR": "Kroatien", "PT": "Portugal", "JP": "Japan", 
  "BR": "Brasilien", "CN": "China", "RU": "Russland", "UA": "Ukraine", "ID": "Indonesien"
};

const COUNTRY_TO_CONTINENT = {
  "DE": "Europa", "AT": "Europa", "CH": "Europa", "GB": "Europa", "FR": "Europa", "ES": "Europa", "IT": "Europa", "NL": "Europa", "CZ": "Europa", "BE": "Europa", "HU": "Europa", "BG": "Europa", "IE": "Europa", "GR": "Europa", "CY": "Europa", "MT": "Europa", "HR": "Europa", "IS": "Europa", "NO": "Europa", "SE": "Europa", "DK": "Europa", "FI": "Europa", "PL": "Europa", "RO": "Europa", "PT": "Europa", "UA": "Europa",
  "US": "Nord- & Mittelamerika", "CA": "Nord- & Mittelamerika", "MX": "Nord- & Mittelamerika", "PR": "Nord- & Mittelamerika", "BB": "Nord- & Mittelamerika",
  "BR": "Südamerika", "AR": "Südamerika", "CO": "Südamerika", "CL": "Südamerika",
  "TH": "Asien", "SG": "Asien", "IN": "Asien", "JP": "Asien", "CN": "Asien", "RU": "Asien", "ID": "Asien",
  "TR": "Naher Osten", "AE": "Naher Osten", "IL": "Naher Osten", "QA": "Naher Osten", "SA": "Naher Osten",
  "EG": "Afrika", "ZA": "Afrika", "MA": "Afrika",
  "AU": "Ozeanien", "NZ": "Ozeanien"
};

const CITY_COORDS = {
  "Frankfurt": [8.6821, 50.1109], "Berlin": [13.4050, 52.5200], "Munich": [11.5820, 48.1351],
  "Vienna": [16.3738, 48.2082], "Zürich": [8.5417, 47.3769], "Barcelona": [2.1734, 41.3851],
  "London": [-0.1278, 51.5074], "Paris": [2.3522, 48.8566], "Amsterdam": [4.9041, 52.3676],
  "Dubai": [55.2708, 25.2048], "New York": [-74.0060, 40.7128], "Washington": [-77.0369, 38.9072],
  "San Juan": [-66.1057, 18.4655], "Prague": [14.4378, 50.0755], "İstanbul": [28.9784, 41.0082],
  "Bridgetown": [-59.6167, 13.0968], "Brussels": [4.3517, 50.8503], "Milan": [9.1900, 45.4642],
  "Budapest": [19.0402, 47.4979], "Bilbao": [-2.9350, 43.2630], "Tel Aviv-Yafo": [34.8000, 32.0833],
  "Bangkok": [100.5018, 13.7563]
};

const COUNTRY_CENTER_COORDS = {
  "US": [-95.71, 37.09], "GB": [-3.43, 55.37], "IN": [78.96, 20.59], "BR": [-51.92, -14.23],
  "JP": [138.25, 36.20], "CA": [-106.34, 56.13], "FR": [2.21, 46.22], "ES": [-3.74, 40.46],
  "DE": [10.45, 51.16], "IT": [12.56, 41.87], "CH": [8.22, 46.81], "AT": [14.55, 47.51],
  "NL": [5.29, 52.13], "AE": [53.84, 23.68], "HR": [15.20, 45.10], "PT": [-8.22, 39.39],
  "BG": [25.48, 42.73], "UA": [31.16, 48.37], "ID": [113.92, -0.78], "EG": [30.80, 26.82]
};

// Regionen Koordinaten (Erweitert um Tessin/Ticino)
const REGION_COORDS = {
  "England": [-1.17, 52.35], "Florida": [-81.51, 27.66], "California": [-119.41, 36.77],
  "Texas": [-99.90, 31.96], "Maharashtra": [75.71, 19.75], "State of São Paulo": [-48.10, -23.55],
  "Tokyo": [139.69, 35.68], "New York": [-75.00, 43.00], "Osaka": [135.50, 34.69],
  "Ontario": [-85.32, 51.25], "Tennessee": [-86.58, 35.51], "Karnataka": [75.71, 15.31],
  "North Carolina": [-79.01, 35.75], "Île-de-France": [2.32, 48.84], "Tamil Nadu": [78.65, 11.12],
  "Valencian Community": [-0.37, 39.48], "Georgia": [-82.90, 32.16], "South Carolina": [-81.16, 33.83],
  "Illinois": [-89.39, 40.63], "Bavaria": [11.49, 48.79], "Scotland": [-4.20, 56.49],
  "Nevada": [-116.41, 38.80], "Calabria": [16.28, 38.90], "Brittany": [-2.80, 48.20],
  "Tessin": [8.96, 46.20], "Ticino": [8.96, 46.20]
};

const PLANE_PATH = 'path://M1705.06,1318.313v-89.254l-319.9-221.799l0.073-208.063c0.521-84.662-26.629-121.796-63.961-121.491c-37.332-0.305-64.482,36.829-63.961,121.491l0.073,208.063l-319.9,221.799v89.254l330.343-157.288l12.238,241.308l-134.449,92.931l0.531,42.034l175.125-42.917l175.125,42.917l0.531-42.034l-134.449-92.931l12.238-241.308L1705.06,1318.313z';

export default function App() {
  const [activeTab, setActiveTab] = useState('flights'); 

  // --- STATE FLÜGE ---
  const [isDefaultDataFlights, setIsDefaultDataFlights] = useState(true);
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
  const [isDefaultDataAcc, setIsDefaultDataAcc] = useState(true);
  const [accCurrentRaw, setAccCurrentRaw] = useState([]);
  const [accPreviousRaw, setAccPreviousRaw] = useState([]);
  const [accData, setAccData] = useState([]);
  const [accFilterType, setAccFilterType] = useState('All');
  
  const [echartsReady, setEchartsReady] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // --- ECHARTS & INIT ---
  useEffect(() => {
    initDefaultFlights();
    initDefaultAcc();

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

  // --- FUNKTIONEN FLÜGE ---
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

      if (CITY_COORDS[originCity] && CITY_COORDS[destCity]) {
        parsedData.push({
          originCountry, originCity, destCountry, destCity,
          routeId: cols[2],
          d84_ad: parseFloat(cols[3]) || 0, d84_yoy: parseFloat(cols[4]) || 0,
          d28_ad: parseFloat(cols[5]) || 0, d28_mom: parseFloat(cols[6]) || 0, d28_yoy: parseFloat(cols[7]) || 0,
          d7_ad: parseFloat(cols[8]) || 0, d7_wow: parseFloat(cols[9]) || 0, d7_yoy: parseFloat(cols[10]) || 0
        });
      }
    }
    return parsedData;
  };

  const processFlightsData = (parsedData) => {
    setData(parsedData);
    setDisabledRoutes([]);
    const countries = [...new Set(parsedData.map(d => d.originCountry))].sort();
    setAvailableCountries(countries);
    const initialActive = countries.filter(c => ['DE', 'AT', 'CH', 'US', 'GB'].includes(c));
    setActiveCountries(initialActive.length > 0 ? initialActive : countries);

    const destCountries = [...new Set(parsedData.map(d => d.destCountry))].sort();
    setAvailableDestCountries(destCountries);
    const initialDestActive = destCountries.filter(c => ['DE', 'AT', 'CH', 'US', 'GB'].includes(c));
    setActiveDestCountries(initialDestActive.length > 0 ? initialDestActive : destCountries);
  };

  const initDefaultFlights = () => {
    setIsDefaultDataFlights(true);
    processFlightsData(parseCSV(DEFAULT_FLIGHTS_CSV));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsDefaultDataFlights(false); 
    let allParsedData = [];
    for (const file of files) {
      const text = await file.text();
      allParsedData = [...allParsedData, ...parseCSV(text)];
    }
    processFlightsData(allParsedData);
  };

  // --- FUNKTIONEN UNTERKÜNFTE ---
  const parseAccCSV = (text) => {
    const lines = text.trim().split('\n');
    const parsed = [];
    const delimiter = lines[0].includes(';') ? ';' : ',';
    for(let i=1; i<lines.length; i++) {
       if(!lines[i].trim()) continue;
       const cols = lines[i].split(delimiter);
       if(cols.length >= 5) {
           parsed.push({
               userCountry: cols[0].trim(),
               destCountry: cols[1].trim(),
               destRegion: cols[2].trim(),
               type: cols[3].trim(),
               adOpp: parseFloat(cols[4]) || 0
           });
       }
    }
    return parsed;
  };

  const initDefaultAcc = () => {
    setIsDefaultDataAcc(true);
    setAccCurrentRaw(parseAccCSV(DEFAULT_ACC_CURRENT_CSV));
    setAccPreviousRaw(parseAccCSV(DEFAULT_ACC_PREVIOUS_CSV));
  };

  const handleAccCurrentUpload = async (e) => {
    if(!e.target.files.length) return;
    setIsDefaultDataAcc(false); 
    const text = await e.target.files[0].text();
    setAccCurrentRaw(parseAccCSV(text));
  };

  const handleAccPreviousUpload = async (e) => {
    if(!e.target.files.length) return;
    setIsDefaultDataAcc(false); 
    const text = await e.target.files[0].text();
    setAccPreviousRaw(parseAccCSV(text));
  };

  // Merge Unterkünfte Data
  useEffect(() => {
    if(accCurrentRaw.length > 0 && accPreviousRaw.length > 0) {
      const joined = [];
      accCurrentRaw.forEach(curr => {
         if(curr.adOpp < 1000) return; 
         const prev = accPreviousRaw.find(p => p.userCountry === curr.userCountry && p.destCountry === curr.destCountry && p.destRegion === curr.destRegion);
         const prevAdOpp = prev ? prev.adOpp : 0;
         let wow = 0;
         if(prevAdOpp > 0) wow = (curr.adOpp - prevAdOpp) / prevAdOpp;

         joined.push({
             ...curr,
             prevAdOpp,
             trend: wow,
             routeId: `${curr.userCountry}-${curr.destRegion}`
         });
      });
      setAccData(joined);
    } else {
      setAccData([]);
    }
  }, [accCurrentRaw, accPreviousRaw]);


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
      // ✈️ FLIGHTS RENDER LOGIC
      const activeDataRaw = data.filter(r => 
        !disabledRoutes.includes(r.routeId) && 
        activeCountries.includes(r.originCountry) &&
        activeDestCountries.includes(r.destCountry)
      );

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
                  <span style="font-weight:bold; color:${getTrendColor(d.currentTrend)}">${sign}${trendPercent}%</span>
                </div>
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #334155; text-align: center;">
                  <a href="${googleFlightsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 500;">✈️ Aktuelle Preise prüfen</a>
                </div>
              `;
            }
            return params.name;
          }
        },
        geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }, emphasis: { itemStyle: { areaColor: '#334155' }, label: { show: false } } },
        series: [
          { type: 'lines', coordinateSystem: 'geo', zlevel: 2, effect: { show: true, period: 6, trailLength: 0, symbol: PLANE_PATH, symbolSize: 15 }, lineStyle: { opacity: 0.6 }, data: lineData },
          { type: 'scatter', coordinateSystem: 'geo', zlevel: 3, symbolSize: 5, silent: true, itemStyle: { color: '#cbd5e1' }, label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#94a3b8', fontSize: 10 } }, data: scatterData }
        ]
      };

    } else if (activeTab === 'accommodations' && accData.length > 0) {
      // 🛏️ ACCOMMODATIONS RENDER LOGIC (Mit pulsierenden Regionen-Hotspots)
      const filteredData = accData.filter(r => accFilterType === 'All' || r.type === accFilterType);
      
      let minAd = Infinity, maxAd = -Infinity;
      filteredData.forEach(row => {
        if (row.adOpp < minAd) minAd = row.adOpp;
        if (row.adOpp > maxAd) maxAd = row.adOpp;
      });
      if (minAd === maxAd) minAd = 0;

      const lineData = [];
      const originScatter = [];
      const regionAgg = {};

      filteredData.forEach(row => {
        const originCoord = COUNTRY_CENTER_COORDS[row.userCountry] || [0,0];
        const destCoord = REGION_COORDS[row.destRegion] || COUNTRY_CENTER_COORDS[row.destCountry] || [0,0];
        
        if(originCoord[0] !== 0 && destCoord[0] !== 0) {
          const width = (maxAd > minAd) ? (1.5 + 3.5 * ((row.adOpp - minAd) / (maxAd - minAd))) : 3;
          lineData.push({
            coords: [originCoord, destCoord],
            lineStyle: { width: width, color: getTrendColor(row.trend), curveness: 0.2 },
            details: row
          });

          if (!originScatter.find(s => s.name === row.userCountry)) {
            originScatter.push({ name: row.userCountry, value: originCoord });
          }

          if(!regionAgg[row.destRegion]) {
             regionAgg[row.destRegion] = {
                 country: row.destCountry,
                 coord: destCoord,
                 adOpp: 0,
                 prevAdOpp: 0
             };
          }
          regionAgg[row.destRegion].adOpp += row.adOpp;
          regionAgg[row.destRegion].prevAdOpp += row.prevAdOpp;
        }
      });

      const destHotspots = Object.keys(regionAgg).map(reg => {
         const data = regionAgg[reg];
         const regWow = data.prevAdOpp > 0 ? (data.adOpp - data.prevAdOpp) / data.prevAdOpp : 0;
         return {
             name: reg,
             value: data.coord,
             country: data.country,
             adOpp: data.adOpp,
             trend: regWow,
             isDest: true
         };
      });

      option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item', enterable: true, hideDelay: 1500, confine: true,
          backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f8fafc' },
          formatter: (params) => {
            // Hover über den pulsierenden Regions-Marker
            if (params.seriesType === 'effectScatter' && params.data.isDest) {
              const d = params.data;
              const trendPercent = (d.trend * 100).toFixed(1);
              const sign = d.trend > 0 ? '+' : '';

              return `
                <div style="font-weight:600; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #334155; padding-bottom: 8px;">
                  📍 Region: <span style="color: #818cf8;">${d.name}</span> (${getFlagImgHtml(d.country)}${COUNTRY_NAMES[d.country] || d.country})
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="color:#94a3b8; margin-right: 12px;">Suchvolumen (Gesamt):</span> 
                  <span style="font-weight:bold">${d.adOpp.toLocaleString('de-DE')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                  <span style="color:#94a3b8; margin-right: 12px;">Regionaler Trend (WoW):</span> 
                  <span style="font-weight:bold; color:${getTrendColor(d.trend)}">${sign}${trendPercent}%</span>
                </div>
              `;
            }
            
            // Hover über die Linie (Ursprung -> Ziel)
            if (params.seriesType === 'lines') {
              const d = params.data.details;
              const trendPercent = (d.trend * 100).toFixed(1);
              const sign = d.trend > 0 ? '+' : '';

              return `
                <div style="font-weight:600; margin-bottom: 8px; font-size: 12px; display: flex; align-items: center;">
                  ${getFlagImgHtml(d.userCountry)}<span style="vertical-align:middle;">${COUNTRY_NAMES[d.userCountry] || d.userCountry}</span> 
                  <span style="margin: 0 6px;">➔</span> 
                  ${getFlagImgHtml(d.destCountry)}<span style="vertical-align:middle;">${d.destRegion}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size: 11px;">
                  <span style="color:#94a3b8; margin-right: 12px;">Ad Opp.:</span> 
                  <span style="font-weight:bold">${d.adOpp.toLocaleString('de-DE')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size: 11px;">
                  <span style="color:#94a3b8; margin-right: 12px;">Trend:</span> 
                  <span style="font-weight:bold; color:${getTrendColor(d.trend)}">${sign}${trendPercent}%</span>
                </div>
              `;
            }
            return params.name;
          }
        },
        geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }, emphasis: { itemStyle: { areaColor: '#334155' }, label: { show: false } } },
        series: [
          // Die Linien (Verbindungen)
          { type: 'lines', coordinateSystem: 'geo', zlevel: 2, effect: { show: true, period: 6, trailLength: 0, symbol: 'circle', symbolSize: 4 }, lineStyle: { opacity: 0.6 }, data: lineData },
          
          // Ursprungsländer (Kleine graue Punkte)
          { type: 'scatter', coordinateSystem: 'geo', zlevel: 3, symbolSize: 5, silent: true, itemStyle: { color: '#94a3b8' }, label: { show: true, position: 'left', formatter: '{b}', textStyle: { color: '#64748b', fontSize: 9 } }, data: originScatter },
          
          // Zielregionen (Pulsierende Hotspots)
          { 
            type: 'effectScatter', 
            coordinateSystem: 'geo', 
            zlevel: 4, 
            symbolSize: (val, params) => {
               // Größe des Hotspots basierend auf Gesamt-Volumen berechnen
               const ad = params.data.adOpp;
               if(maxAd === minAd) return 10;
               return 8 + 15 * ((ad - minAd) / (maxAd - minAd));
            },
            itemStyle: { 
                color: (params) => getTrendColor(params.data.trend),
                shadowBlur: 10,
                shadowColor: '#000'
            }, 
            label: { show: true, position: 'right', formatter: '{b}', textStyle: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold', textShadowColor: '#000', textShadowBlur: 3 } }, 
            data: destHotspots 
          }
        ]
      };
    } else {
      option = {
        backgroundColor: 'transparent',
        geo: { map: 'world', roam: true, center: [30, 35], zoom: 2.2, silent: true, itemStyle: { areaColor: '#1e293b', borderColor: '#334155', borderWidth: 1 } }
      };
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
  }, [data, timeframe, trendType, echartsReady, disabledRoutes, activeCountries, activeDestCountries, minAdOppFilter, activeTab, accData, accFilterType]);

  const toggleDisabledRoute = (routeId) => setDisabledRoutes(prev => prev.filter(id => id !== routeId));
  const toggleCountry = (country) => setActiveCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const toggleDestCountry = (country) => setActiveDestCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  const setContinentAll = (countriesInContinent) => setActiveDestCountries(prev => { const newSet = new Set(prev); countriesInContinent.forEach(c => newSet.add(c)); return Array.from(newSet); });
  const setContinentNone = (countriesInContinent) => setActiveDestCountries(prev => prev.filter(c => !countriesInContinent.includes(c)));

  const handleManualMinAdOppChange = (e) => {
    const val = e.target.value;
    if (val === '') setMinAdOppFilter(''); 
    else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) setMinAdOppFilter(num.toString());
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
                
                {/* STATUS INDIKATOR FLÜGE */}
                <div className="mt-3 text-[11px] border-t border-slate-600/50 pt-3">
                  {isDefaultDataFlights ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-emerald-400 flex items-center gap-1 font-medium"><CheckCircle className="w-3 h-3"/> Standard-Daten aktiv</span>
                      <span className="text-slate-400 pl-4">Stand: {FLIGHTS_LAST_UPDATED}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 flex items-center gap-1 font-medium"><User className="w-3 h-3"/> Eigene Daten aktiv</span>
                      <button onClick={initDefaultFlights} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded">
                        <RefreshCw className="w-3 h-3" /> Reset
                      </button>
                    </div>
                  )}
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
            </>
          ) : (
            // UNTERKÜNFTE TAB
            <>
              {/* Dateiupload Unterkünfte (2 Schritte) */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700 shadow-inner">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Trend-Daten (WoW) laden
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center justify-center w-full p-2.5 border border-dashed border-indigo-500/50 rounded-md cursor-pointer hover:border-indigo-400 hover:bg-slate-700 transition-colors">
                      <Upload className="w-4 h-4 mr-2 text-indigo-400" />
                      <span className="text-xs font-medium text-slate-300">1. CSV Aktuelle Woche</span>
                      <input type="file" accept=".csv" className="hidden" onChange={handleAccCurrentUpload} />
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center justify-center w-full p-2.5 border border-dashed border-indigo-500/50 rounded-md cursor-pointer hover:border-indigo-400 hover:bg-slate-700 transition-colors">
                      <Upload className="w-4 h-4 mr-2 text-indigo-400" />
                      <span className="text-xs font-medium text-slate-300">2. CSV Vorwoche</span>
                      <input type="file" accept=".csv" className="hidden" onChange={handleAccPreviousUpload} />
                    </label>
                  </div>
                </div>

                {/* STATUS INDIKATOR UNTERKÜNFTE */}
                <div className="mt-4 text-[11px] border-t border-slate-600/50 pt-3">
                  {isDefaultDataAcc ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-emerald-400 flex items-center gap-1 font-medium"><CheckCircle className="w-3 h-3"/> Standard-Daten aktiv</span>
                      <span className="text-slate-400 pl-4">Stand: {ACC_LAST_UPDATED}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 flex items-center gap-1 font-medium"><User className="w-3 h-3"/> Eigene Daten aktiv</span>
                      <button onClick={initDefaultAcc} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded">
                        <RefreshCw className="w-3 h-3" /> Reset
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {accData.length > 0 && (
                <>
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Reisetyp
                    </h2>
                    <div className="flex bg-slate-900 rounded-md p-1 border border-slate-700">
                      {['All', 'Domestic', 'International'].map(type => (
                        <button
                          key={type}
                          onClick={() => setAccFilterType(type)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                            accFilterType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {type === 'All' ? 'Alle' : type === 'Domestic' ? 'Inland' : 'Ausland'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
                    <p className="text-sm text-emerald-400 font-semibold">{accData.length} Routen berechnet</p>
                    <p className="text-xs text-slate-400 mt-1">Gehe mit der Maus über die pulsierenden Regionen, um Details zu sehen.</p>
                  </div>
                </>
              )}
            </>
          )}

          {/* Gemeinsame Legende für beide Tabs */}
          <div className="mt-6">
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
        
        {/* Render Map Container */}
        <div ref={chartRef} className="w-full h-full" style={{ visibility: echartsReady ? 'visible' : 'hidden' }} />
        
        {/* Leerzustand Unterkünfte */}
        {activeTab === 'accommodations' && accData.length === 0 && echartsReady && !isDefaultDataAcc && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 z-10 backdrop-blur-sm">
            <div className="text-center text-slate-300 flex flex-col items-center bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl max-w-md">
              <Bed className="w-16 h-16 mb-4 text-indigo-400" />
              <h2 className="text-2xl font-bold mb-2">Warte auf 2. Datei...</h2>
              <p className="text-sm text-slate-400">
                Bitte lade sowohl die Datei für die aktuelle Woche als auch für die Vorwoche hoch, um den Rauschfilter (1k Ad Opp.) und die Trend-Kalkulation zu starten.
              </p>
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

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] { -moz-appearance: textfield; }
      `}} />
    </div>
  );
}
