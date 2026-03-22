/**
 * Image Recognition Agent
 */

import {run} from "./src/agent.js";
import {nativeTools} from "./src/native/tools.js";
import log from "./src/helpers/logger.js";
import {logStats} from "./src/helpers/stats.js";

const QUERY = `
Musisz aktywować trasę kolejową o nazwie X-01 za pomocą API, do którego nie mamy dokumentacji. 
Wiemy tylko, że API obsługuje akcję help, która zwraca jego własną dokumentację — od niej należy zacząć.
API jest celowo przeciążone i regularnie zwraca błędy 503 (to nie jest prawdziwa awaria, a symulacja), a do tego ma bardzo restrykcyjne limity zapytań. 
Zadanie wymaga cierpliwości.

1. Zacznij od help — wyślij akcję help i dokładnie przeczytaj odpowiedź. 
API jest samo-dokumentujące: odpowiedź opisuje wszystkie dostępne akcje, ich parametry i kolejność wywołań potrzebną do aktywacji trasy.
Aby wywołać akcję help, uruchom narzędzie call_railway_api z obiektem data = { action: "help" }

2. Postępuj zgodnie z dokumentacją API — nie zgaduj nazw akcji ani parametrów. 
Używaj dokładnie tych wartości, które zwróciło help.

3. Obsługuj błędy 503 — jeśli API zwróci 503, poczekaj chwilę i spróbuj ponownie.
To celowe zachowanie symulujące przeciążenie serwera, nie prawdziwy błąd.
 
4. Pilnuj limitów zapytań — sprawdzaj nagłówki HTTP każdej odpowiedzi. 
Nagłówki informują o czasie resetu limitu. 
Odczekaj do resetu przed kolejnym wywołaniem.

5. Szukaj flagi w odpowiedzi — gdy API zwróci w treści odpowiedzi flagę w formacie {FLG:...}, zadanie jest ukończone.

API jest samo-dokumentujące — nie szukaj dokumentacji gdzie indziej. Odpowiedź na help to wszystko, czego potrzebujesz.

Czytaj błędy uważnie — jeśli akcja się nie powiedzie, komunikat błędu zwykle precyzyjnie wskazuje co poszło nie tak (zły parametr, zła kolejność akcji itp.).

503 to nie awaria — błąd 503 jest częścią zadania. Kod musi go obsługiwać automatycznie przez retry z backoffem, inaczej zadanie nie da się ukończyć.
Do tego celu warto wykorzystać narzędzie wait_for i podać liczbę sekund jako argument.

Limity zapytań są bardzo restrykcyjne — to główne utrudnienie zadania. 
Monitoruj nagłówki po każdym żądaniu i bezwzględnie respektuj limity. 
Zbyt agresywne odpytywanie spowoduje długie blokady.
`;

const main = async () => {
  try {
    log.success(`Native: ${nativeTools.map((tool) => tool.name).join(", ")}`);

    log.start("Starting API exploration...");
    const result = await run(QUERY);
    log.success("API exploration complete");
    log.info(result.response);
    logStats();
  } catch (error) {
    throw error;
  }
};

main().catch((error) => {
  log.error("Startup error", error.message);
  process.exit(1);
});
