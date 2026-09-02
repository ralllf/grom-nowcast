import type { Place } from "./types";

export const POLAND_CENTER = { lat: 52.1, lon: 19.4 };

const PINEZKA_NAD = "nad Twoją pinezką";

export const DEFAULT_PLACE: Place = {
  lat: 52.2297,
  lon: 21.0122,
  label: "Warszawa",
  instrumental: "Warszawą",
  city: "Warszawa",
  state: "województwo mazowieckie",
  terc: "1465",
};

export const CITIES: Place[] = [
  DEFAULT_PLACE,
  { lat: 50.0647, lon: 19.945, label: "Kraków", instrumental: "Krakowem", city: "Kraków", terc: "1261" },
  { lat: 51.1079, lon: 17.0385, label: "Wrocław", instrumental: "Wrocławiem", city: "Wrocław", terc: "0264" },
  { lat: 51.1492, lon: 15.0084, label: "Zgorzelec", instrumental: "Zgorzelcem", city: "Zgorzelec", terc: "0225" },
  { lat: 52.4064, lon: 16.9252, label: "Poznań", instrumental: "Poznaniem", city: "Poznań", terc: "3064" },
  { lat: 54.352, lon: 18.6466, label: "Gdańsk", instrumental: "Gdańskiem", city: "Gdańsk", terc: "2261" },
  { lat: 51.7592, lon: 19.456, label: "Łódź", instrumental: "Łodzią", city: "Łódź", terc: "1061" },
  { lat: 50.2649, lon: 19.0238, label: "Katowice", instrumental: "Katowicami", city: "Katowice", terc: "2469" },
  { lat: 51.2465, lon: 22.5684, label: "Lublin", instrumental: "Lublinem", city: "Lublin", terc: "0664" },
  { lat: 53.4285, lon: 14.5528, label: "Szczecin", instrumental: "Szczecinem", city: "Szczecin", terc: "3262" },
  { lat: 53.1325, lon: 23.1688, label: "Białystok", instrumental: "Białymstokiem", city: "Białystok", terc: "2061" },
  { lat: 50.0412, lon: 21.9991, label: "Rzeszów", instrumental: "Rzeszowem", city: "Rzeszów", terc: "1861" },
  { lat: 53.1235, lon: 18.0084, label: "Bydgoszcz", instrumental: "Bydgoszczą", city: "Bydgoszcz", terc: "0461" },
  { lat: 50.8661, lon: 20.6286, label: "Kielce", instrumental: "Kielcami", city: "Kielce", terc: "2661" },
  { lat: 53.7784, lon: 20.4801, label: "Olsztyn", instrumental: "Olsztynem", city: "Olsztyn", terc: "2862" },
  { lat: 50.6751, lon: 17.9213, label: "Opole", instrumental: "Opolem", city: "Opole", terc: "1661" },
  { lat: 54.5189, lon: 18.5305, label: "Gdynia", instrumental: "Gdynią", city: "Gdynia", terc: "2262" },
  { lat: 50.811, lon: 19.1203, label: "Częstochowa", instrumental: "Częstochową", city: "Częstochowa", terc: "2461" },
  { lat: 50.3249, lon: 18.6714, label: "Gliwice", instrumental: "Gliwicami", city: "Gliwice", terc: "2465" },
  { lat: 54.4641, lon: 17.0282, label: "Słupsk", instrumental: "Słupskiem", city: "Słupsk", terc: "2263" },
  { lat: 52.1639, lon: 21.0726, label: "Otwock", instrumental: "Otwockiem", city: "Otwock", terc: "1417" },
];

/** `nad` takes instrumental. Map pin / unknown city → pinezka, never nominative dump. */
export function nadPhrase(label: string): string {
  const city = CITIES.find((c) => c.label === label);
  if (city?.instrumental) return `nad ${city.instrumental}`;
  return PINEZKA_NAD;
}
