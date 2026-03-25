/**
 * Image Recognition Agent
 */

import {createMcpClient} from "./src/mcp/client.js";
import {run} from "./src/agent.js";
import {nativeTools} from "./src/native/tools.js";
import log from "./src/helpers/logger.js";
import {logStats} from "./src/helpers/stats.js";
import {AI_DEVS_API_KEY} from "../config.js";

const QUERY = `Jesteś autonomicznym agentem.

# Cel
Masz do rozwiązania puzzle elektryczne na planszy 3x3. 
Plansza przedstawia sieć kabli - każde pole zawiera element złącza elektrycznego. 
Twoim celem jest obrócenie odpowiednich pól planszy tak, aby układ kabli odpowiadał podanemu schematowi docelowemu. 

# Dozwolone akcje
Jedyna dozwolona operacja to obrót wybranego pola o 90 stopni w prawo. 
Możesz obracać wiele pól, ile chcesz - ale za każdy obrót płacisz jednym zapytaniem do API.
Do obrotu pola służy narzędzie rotate.
Jedno zapytanie = jeden obrót jednego pola. Jeśli chcesz obrócić 3 pola, wysyłasz 3 osobne zapytania.
Gdy plansza osiągnie poprawną konfigurację, hub zwróci flagę {FLG:...}.

# Aktualny stan
Aktualny stan planszy pobierasz jako obrazek PNG:
https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png
Narzędzie understand_image podzieli ten obrazek na 9 części (po jednym na pole) i zwróci ich reprezentację ASCII, gdzie X to gruby kabel, a spacja to cienka kreska (reprezentująca granice pola) lub brak kabla.
Zwrócone pola zostaną opisane w kolejności 1x1, 1x2, 1x3, 2x1, 2x2, ... 

Pola adresujesz w formacie AxB, gdzie A to wiersz (1-3, od góry), a B to kolumna (1-3, od lewej):
1x1 | 1x2 | 1x3
----|-----|----
2x1 | 2x2 | 2x3
----|-----|----
3x1 | 3x2 | 3x3

# Rozwiązanie
Docelowy stan planszy możesz zobaczyć na schemacie w postaci ASCII:
------------
   |   |   |
 XX|XXX|XXX|  
 X | X |   |
------------
 X | X |   |
 X | XX|XXX|  
 X | X | X |
------------
 X | X | X |
XXX|XX | XX|  
   |   |   |
------------

# Reset planszy
Jeśli chcesz zacząć od początku, wywołaj narzędzie reset.

# Co należy zrobić w zadaniu?
1. Odczytaj aktualny stan - pobierz obrazek PNG i ustal, jak ułożone są kable na każdym z 9 pól.
2. Porównaj ze stanem docelowym - ustal, które pola różnią się od wyglądu docelowego i ile obrotów (po 90 stopni w prawo) każde z nich potrzebuje.
3. Wyślij obroty - dla każdego pola wymagającego zmiany wyślij odpowiednią liczbę zapytań z polem rotate.
4. Sprawdź wynik - jeśli trzeba, pobierz zaktualizowany obrazek i zweryfikuj, czy plansza zgadza się ze schematem.
5. Odbierz flagę - gdy konfiguracja jest poprawna, hub zwraca {FLG:...}.

Działaj autonomicznie. Informuj o postępach i poczynionych akcjach, na koniec zwróć podsumowanie i koniecznie zwróć otrzymaną flagę.
`;

const main = async () => {
  let mcpClient;

  try {
    log.start("Connecting to MCP server...");
    mcpClient = await createMcpClient();
    const mcpTools = []; // disabled: await listMcpTools(mcpClient);
    log.success(`MCP: ${mcpTools.map((tool) => tool.name).join(", ")}`);
    log.success(`Native: ${nativeTools.map((tool) => tool.name).join(", ")}`);

    log.start("Starting task...");
    const result = await run(QUERY, { mcpClient, mcpTools });
    log.success("Task complete");
    log.info(result.response);
    logStats();
  } catch (error) {
    throw error;
  } finally {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
    }
  }
};

main().catch((error) => {
  log.error("Startup error", error.message);
  process.exit(1);
});
