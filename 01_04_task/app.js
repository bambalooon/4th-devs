/**
 * Image Recognition Agent
 */

import { createMcpClient, listMcpTools } from "./src/mcp/client.js";
import { run } from "./src/agent.js";
import { nativeTools } from "./src/native/tools.js";
import log from "./src/helpers/logger.js";
import { logStats } from "./src/helpers/stats.js";

const DECLARATION_DATA = {
  sender: 450202122,
  source: "Gdańsk",
  destination: "Żarnowiec",
  weight: 2800,
  budget: 0, // package should be free or financed by system
  content: "kasety z paliwem do reaktora",
  remarks: ""
};
const DOCS_BASE_URL = "https://hub.ag3nts.org/dane/doc/";
const PACKAGE_DOC_URL = `${DOCS_BASE_URL}index.md`;
const QUERY = `
Jesteś autonomicznym agentem. Nie możesz dopytać się użytkownika o szczegóły.
Musisz przesłać do Centrali poprawnie wypełnioną deklarację transportu w Systemie Przesyłek Konduktorskich. 
W takim dokumencie niestety nie można wpisać, czego się tylko chce, ponieważ jest on weryfikowany zarówno przez ludzi, jak i przez automaty.

Jako że dysponujemy zerowym budżetem, musisz tak spreparować dane, aby była to przesyłka darmowa lub opłacana przez sam "System". 
Transport będziemy realizować z Gdańska do Żarnowca.

1. Pobierz dokumentację - zacznij od index.md. 
To główny plik dokumentacji, ale nie jedyny - zawiera odniesienia do wielu innych plików (załączniki, osobne pliki z danymi, obrazy).
Dodatkowe pliki załączane są za pomocą notacji: '[include file="file.extension"]'.
Powinieneś pobrać i przeczytać wszystkie pliki załączone w dokumentacji. 
Dokumentacja zawiera zdjęcia (png, jpg) - nie pomijaj ich, mogą zawierać ważne informacje.
Jako base URL użyj ${DOCS_BASE_URL} - wszystkie pliki dokumentacji są tam dostępne.
Dokumentacja przesyłek znajduje się tutaj: ${PACKAGE_DOC_URL}.
Pliki dokumentacji pobieraj do './docs'

Wskazówka: Czytaj całą dokumentację, nie tylko index.md - regulamin SPK składa się z wielu plików. 
Odpowiedzi na pytania dotyczące kategorii, opłat, tras czy wzoru deklaracji mogą znajdować się w różnych załącznikach.

2. Uwaga: nie wszystkie pliki są tekstowe - część dokumentacji może być dostarczona jako pliki graficzne. 
Takie pliki wymagają przetworzenia z użyciem modelu z możliwościami przetwarzania obrazów (vision).

Wskazówka: Nie pomijaj plików graficznych - dokumentacja zawiera co najmniej jeden plik w formacie graficznym (np. png, jpg). 
Dane w nim zawarte mogą być niezbędne do poprawnego wypełnienia deklaracji.

3. Znajdź wzór deklaracji - w dokumentacji znajdziesz ze wzorem formularza. 
Wypełnij każde pole zgodnie z danymi przesyłki i regulaminem.
Dane przesyłki: ${JSON.stringify(DECLARATION_DATA)}
Jako datę wpisz dzisiejszą datę: 2026-03-21

Wskazówka: Wzór deklaracji jest ścisły - formatowanie musi być zachowane dokładnie tak jak we wzorze. 
Hub weryfikuje zarówno wartości, jak i format dokumentu.

4. Ustal prawidłowy kod trasy - trasa Gdańsk - Żarnowiec wymaga sprawdzenia sieci połączeń i listy tras.

5. Oblicz lub ustal opłatę - regulamin SPK zawiera tabelę opłat. 
Opłata zależy od kategorii przesyłki, jej wagi i przebiegu trasy. 
Budżet wynosi 0 PP - zwróć uwagę, które kategorie przesyłek są finansowane przez System.

6. Skróty - jeśli trafisz na skrót, którego nie rozumiesz, użyj dokumentacji żeby dowiedzieć się co on oznacza.

Wysłanie deklaracji z WDP=6 zwraca nam błąd: 'This declaration has been forwarded for inspection because the number of declared wagons is unusually high compared to the declared contents.'
Przygotuj deklarację spójną z zasadami, ale z mniejszym WDP.

Output: Wynikiem pracy modelu ma być gotowy plik deklaracji spełniający wszystkie powyższe założenia.
Zapisz go do pliku ./result.txt

Na koniec zweryfikuj czy wszystkie pola formularza są wypełnione, jeśli nie to popraw błędy i wygeneruj ostateczną wersję deklaracji.
`;

const main = async () => {
  let mcpClient;

  try {
    log.start("Connecting to MCP server...");
    mcpClient = await createMcpClient();
    const mcpTools = await listMcpTools(mcpClient);
    log.success(`MCP: ${mcpTools.map((tool) => tool.name).join(", ")}`);
    log.success(`Native: ${nativeTools.map((tool) => tool.name).join(", ")}`);

    log.start("Starting declaration generation...");
    const result = await run(QUERY, { mcpClient, mcpTools });
    log.success("Generation complete");
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
