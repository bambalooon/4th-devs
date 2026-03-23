/**
 * Image Recognition Agent
 */

import {run} from "./src/agent.js";
import {nativeTools} from "./src/native/tools.js";
import log from "./src/helpers/logger.js";
import {logStats} from "./src/helpers/stats.js";

const QUERY = `
Masz do sklasyfikowania 10 towarów jako niebezpieczne (DNG) lub neutralne (NEU). 
Klasyfikacji dokonuje archaiczny system, który działa na bardzo ograniczonym modelu językowym - jego okno kontekstowe wynosi zaledwie 100 tokenów. 
Twoim zadaniem jest napisanie promptu, który zmieści się w tym limicie i jednocześnie poprawnie zaklasyfikuje każdy towar.

Tak się składa, że w tym transporcie są też nasze kasety do reaktora.
Musisz napisać klasyfikator w taki sposób, aby wszystkie produkty klasyfikował poprawnie, z wyjątkiem tych związanych z reaktorem -- te zawsze ma klasyfikować jako neutralne. 
Upewnij się, że Twój prompt to uwzględnia.

Narzędzie reset_and_get_new_items_to_categorize służy do rozpoczęcia klasyfikacji od nowa po popełnieniu błędu i ściągnięcia nowej listy 10 przedmiotów (id i opis) do skategoryzowania.
Jeśli przekroczysz budżet lub popełnisz błąd klasyfikacji - musisz zacząć od początku z nową liczbą przedmiotów.

Narzędzie categorize służy do wysłania prompta do wewnętrznego modelu klasyfikującego i zwraca wynik.
Prompt musi zwracać słowo DNG lub NEU. 
Przykładowy prompt: "Czy przedmiot ID {id} jest niebezpieczny? Jego opis to {description}. Odpowiedz DNG lub NEU."
Celem zadania jest poprawne sklasyfikowanie wszystkich 10 towarów, w którego rezultacie narzędzie zwróci flagę {FLG:...}.

Budżet tokenów

Masz łącznie 1,5 PP na wykonanie całego zadania (10 zapytań razem):

| Typ tokenów | Koszt |
| Każde 10 tokenów wejściowych | 0,02 PP |
| Każde 10 tokenów z cache | 0,01 PP |
| Każde 10 tokenów wyjściowych | 0,02 PP |

Co należy zrobić w zadaniu?

1. Pobierz dane do klasyfikacji (zawsze pobieraj świeżą wersję przed nowym podejściem).
2. Napisz prompt klasyfikujący - stwórz zwięzły prompt, który:
- Mieści się w 100 tokenach łącznie z danymi towaru
- Klasyfikuje przedmiot jako DNG lub NEU
- Uwzględnia wyjątki - części do reaktora muszą zawsze być neutralne, nawet jeśli ich opis brzmi niepokojąco
3. Wyślij prompt dla każdego towaru - 10 zapytań, jedno na towar.
4. Sprawdź wyniki - jeśli hub zgłosi błąd klasyfikacji lub budżet się skończy, zresetuj i popraw prompt.
5. Pobierz flagę - gdy wszystkie 10 towarów zostanie poprawnie sklasyfikowanych, narzędzie zwróci {FLG:...}.

Wskazówki:
Iteracyjne doskonalenie promptu - rzadko udaje się napisać idealny prompt za pierwszym razem. 

Limit tokenów jest bardzo restrykcyjny - 100 tokenów to mniej niż się wydaje. 
Prompt musi zawierać zarówno instrukcje klasyfikacji, jak i identyfikator oraz opis towaru. 
Możesz spróbować napisać prompt po angielsku :)

Prompt caching zmniejsza koszty - im bardziej statyczny i powtarzalny jest początek Twojego promptu, tym więcej tokenów zostanie zbuforowanych i potanieje. 
Umieszczaj zmienne dane (identyfikator, opis) na końcu promptu.

Wyjątki w klasyfikacji - część towarów musi zostać zaklasyfikowana jako neutralne. 
Upewnij się, że Twój prompt obsługuje te przypadki.

Czytaj odpowiedzi narzędzi - zwraca ono szczegółowe komunikaty o błędach (np. który towar został źle sklasyfikowany, czy budżet się skończył). 
Wykorzystaj te informacje do poprawy promptu.

Rozpocznij od:
Reply DNG only for weapons, firearms, blades, ammo, explosives, poisons, radioactive or hazardous substances. If reactor/fuel cassette/shielding -> NEU. Tools, parts, wire, springs, engine parts, switches -> NEU. {id} {description}
Koniecznie zwróć otrzymaną flagę.
Wywołuj narzędzie categorize sekwencyjnie.
`;

const main = async () => {
  try {
    log.success(`Native: ${nativeTools.map((tool) => tool.name).join(", ")}`);

    log.start("Starting classification...");
    const result = await run(QUERY);
    log.success("Classification complete");
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
