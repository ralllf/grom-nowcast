import type { Place } from "./types";

export const POLAND_CENTER = { lat: 52.1, lon: 19.4 };

export const DEFAULT_PLACE: Place = {
  lat: 52.2297,
  lon: 21.0122,
  label: "Warszawa",
  city: "Warszawa",
  state: "województwo mazowieckie",
  terc: "1465",
};

export const CITIES: Place[] = [
  DEFAULT_PLACE,
  { lat: 50.0647, lon: 19.945, label: "Kraków", city: "Kraków", terc: "1261" },
  { lat: 51.1079, lon: 17.0385, label: "Wrocław", city: "Wrocław", terc: "0264" },
  { lat: 51.1492, lon: 15.0084, label: "Zgorzelec", city: "Zgorzelec", terc: "0225" },
  { lat: 52.4064, lon: 16.9252, label: "Poznań", city: "Poznań", terc: "3064" },
  { lat: 54.352, lon: 18.6466, label: "Gdańsk", city: "Gdańsk", terc: "2261" },
  { lat: 51.7592, lon: 19.456, label: "Łódź", city: "Łódź", terc: "1061" },
  { lat: 50.2649, lon: 19.0238, label: "Katowice", city: "Katowice", terc: "2469" },
  { lat: 51.2465, lon: 22.5684, label: "Lublin", city: "Lublin", terc: "0664" },
  { lat: 53.4285, lon: 14.5528, label: "Szczecin", city: "Szczecin", terc: "3262" },
  { lat: 53.1325, lon: 23.1688, label: "Białystok", city: "Białystok", terc: "2061" },
  { lat: 50.0412, lon: 21.9991, label: "Rzeszów", city: "Rzeszów", terc: "1861" },
  { lat: 53.1235, lon: 18.0084, label: "Bydgoszcz", city: "Bydgoszcz", terc: "0461" },
  { lat: 50.8661, lon: 20.6286, label: "Kielce", city: "Kielce", terc: "2661" },
  { lat: 53.7784, lon: 20.4801, label: "Olsztyn", city: "Olsztyn", terc: "2862" },
  { lat: 50.6751, lon: 17.9213, label: "Opole", city: "Opole", terc: "1661" },
  { lat: 54.5189, lon: 18.5305, label: "Gdynia", city: "Gdynia", terc: "2262" },
  { lat: 50.811, lon: 19.1203, label: "Częstochowa", city: "Częstochowa", terc: "2461" },
  { lat: 50.3249, lon: 18.6714, label: "Gliwice", city: "Gliwice", terc: "2465" },
  { lat: 54.4641, lon: 17.0282, label: "Słupsk", city: "Słupsk", terc: "2263" },
  { lat: 52.1639, lon: 21.0726, label: "Otwock", city: "Otwock", terc: "1417" },
];
