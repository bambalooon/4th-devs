## Fabuła

![https://vimeo.com/1171928484](https://vimeo.com/1171928484)

## Transkrypcja filmu z Fabułą

> Numerze piąty!
>
> Jeśli nie zaczniemy działać, to z naszej elektrowni zostanie tylko dziura w ziemi. Wiesz dobrze co planują operatorzy Systemu.
>
> Naszych ludzi możemy ewakuować - mamy na to jeszcze czas, ale po weekendzie nie będzie już do czego wracać. Elektrowni nie będzie, zasilania nie będzie, skoku w czasie nie będzie... i niczego nie będzie.
>
> Ale powiem Ci, że jeszcze nie wszystko stracone i może... hmmm... to dziwnie zabrzmi, ale może nawet dobrze się stało, że próbują nas zaatakować. Tylko ten atak musi odbyć się na naszych warunkach.
>
> Pamiętasz nasze problemy z systemem chłodzenia elektrowni? Jesteśmy pośrodku niczego. Gdy budowano tę elektrownię - jeszcze w latach 80 - wybrano to miejsce ze względu na pobliskie Jezioro Żarnowieckie. To ono miało być źródłem wody do chłodzenia reaktora.
>
> Tylko teraz zamiast jeziora mamy bardziej sadzawkę, bo poziom wody spadł o dobre 80%. To jednak nie jest główny problem. Realnym problemem jest tama, która odgradza nas od tych resztek wody. Musimy się jej pozbyć.
>
> Nie dysponujemy ładunkami wybuchowymi. Nie dysponujemy także dronami. Ale... czy ktoś aby nie planował nas zbombardować?
>
> Plan jest szalony - zupełnie jakby skok w czasie w celu ratowania świata nie brzmiał jak coś szalonego - ale nie mamy innego wyjścia jak tylko spróbować.
>
> Bombardowanie zaplanowane jest na poniedziałek. To jednak my wykonamy pierwszy ruch. Zdobyłem dla Ciebie dostęp do systemu sterowania dronami. Przejmiesz kontrolę nad jednym z nich. Twoim zadaniem jest... nas zbombardować. Tak, dobrze usłyszałeś - mówiłem, że to trochę szalone.
>
> Wyślesz uzbrojonego drona w naszym kierunku, ale nie zrzucisz ładunku wybuchowego na elektrownię - wycelujesz go wprost na pobliską tamę. W systemie zaznaczysz, że jest to lot, którego celem jest zniszczenie elektrowni.
>
> Będzie lot na mniej więcej poprawne koordynaty, będzie bomba, będzie wybuch, udokumentujemy to odpowiednio, a automatyczny system odznaczy zadanie jako wykonane. Budynek zostanie wymazany z map Systemu jako zniszczony i o to nam właśnie chodzi.
>
> To nie sprawi, że będziemy już bezpieczni, ale da nam wystarczająco dużo czasu, aby zająć się innymi problemami.

## Zadanie

Wiemy już co planuje zrobić Dział Bezpieczeństwa Systemu. Chcą zrównać z ziemią elektrownię w Żarnowcu. Mamy jednak sposób, aby pokrzyżować im te plany. Bombardowanie naszej tymczasowej bazy, zaplanowane jest na nadchodzący tydzień, jednak my wykonamy ruch wyprzedzający. Pamiętasz, że ostatnio mieliśmy problemy z chłodzeniem rdzeni? No to załatwmy sobie chłodzenie z pobliskiego jeziora.

Przejęliśmy kontrolę nad uzbrojonym dronem wyposażonym w ładunek wybuchowy. Twoim zadaniem jest zaprogramować go tak, aby wyruszył z misją zbombardowania wymaganego obiektu, ale faktycznie bomba ma spaść nie na elektrownię, a na pobliską tamę. Jeśli wszystko pójdzie zgodnie z planem, powinniśmy skutecznie doprowadzić wodę do systemu chłodniczego. Jeśli się pomylisz, to przynajmniej problem z brakiem wody zastąpimy problemem z powodzią - nazwijmy to "zrównoważonym rozwojem" ;)

Kod identyfikacyjny elektrowni w Żarnowcu: **PWR6132PL**

**Nazwa zadania: `drone`**

#### Skąd wziąć dane?

Narzędzie get_drone_documentation zwróci zawartość dokumentacji API drona.


Mapę poglądową elektrowni w formacie PNG można pobrać za pomocą narzędzia get_power_plant_map.

Mapa jest podzielona siatką na sektory. Przy tamie celowo podbito intensywność koloru wody, żeby ułatwić jej lokalizację.

#### Jak komunikować się z hubem?

Instrukcje dla drona wysyłasz za pomocą narzędzia execute_drone_instructions. 
Przyjmuje ono sekwencję instrukcji zgodnie z dokumentacją API drona (przekaż tylko wartość pola instructions).

```json
{
  ["instrukcja1", "instrukcja2", "..."]
}
```

API zwraca komunikaty błędów jeśli coś jest nie tak - czytaj je uważnie i dostosowuj instrukcje. Gdy odpowiedź zawiera `{FLG:...}`, zadanie jest ukończone.

### Co należy zrobić w zadaniu?

1. **Przeanalizuj mapę wizualnie** - pobierz mapę elektrowni i wyślij ją do modelu - policz kolumny i wiersze siatki, zlokalizuj sektor z tamą.
2. **Zanotuj numer kolumny i wiersza** sektora z tamą w siatce (indeksowanie od 1).
3. **Przeczytaj dokumentację API drona** zwróconą przez narzędzie get_drone_documentation.
4. **Na podstawie dokumentacji** zidentyfikuj wymagane instrukcje.
5. **Wyślij sekwencję instrukcji** za pomocą narzędzia execute_drone_instructions, uwzględniając zlokalizowany sektor tamy i kod elektrowni. Pamiętaj, że instrukcje muszą być zgodne z dokumentacją API drona.
6. **Przeczytaj odpowiedź** - jeśli API zwróci błąd, dostosuj instrukcje i wyślij ponownie.
7. Gdy w odpowiedzi pojawi się `{FLG:...}`, zadanie jest ukończone.

### Wskazówki

- **Analiza obrazu** - Do zlokalizowania tamy na mapie potrzebny jest model obsługujący obraz (vision). Zaplanuj dwuetapowe podejście: najpierw przeanalizuj mapę modelem vision, żeby zidentyfikować sektor tamy, potem użyj tej informacji w pętli agentowej z modelem tekstowym. `openai/gpt-4o` dobrze radzi sobie z dokładnym zliczaniem kolumn i wierszy siatki, natomiast niedawno wypuszczony model `openai/gpt-5.4` jest w tym jeszcze lepszy. Warto go wypróbować. Właściwe zlokalizowanie sektora mapy jest kluczowe.
- **Dokumentacja pełna pułapek** - Dokumentacja drona celowo zawiera wiele kolidujących ze sobą nazw funkcji, które zachowują się różnie w zależności od podanych parametrów. Nie musisz używać wszystkich - skup się na tym, co faktycznie potrzebne do wykonania misji. Oszczędzaj tokeny i konfiguruj tylko to, co konieczne.
- **Podejście reaktywne** - Nie musisz rozgryźć całej dokumentacji przed pierwszą próbą. API zwraca precyzyjne komunikaty błędów - możesz wysłać swoją najlepszą próbę i korygować na podstawie feedbacku. Iteracyjne dopasowywanie jest tu naturalną strategią.
- **Reset** - Jeśli mocno namieszasz w konfiguracji drona, dokumentacja zawiera funkcję `hardReset`. Przydatna gdy kolejne błędy wynikają z nawarstwionych wcześniejszych pomyłek.
