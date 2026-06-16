# Vattenkontot MVP

Detta är en fungerande MVP för Vattenkontot.

Version 0.4 gör fyra saker:

1. Visar en estetisk appvy i webbläsaren.
2. Hämtar Vombverkets senaste avlästa leverans från Sydvattens publika endpoint.
3. Hämtar aktuell vattennivå i Vombsjön från SMHI, station Vombsjön övre, station 2018.
4. Hämtar första S-HYPE/HydroNu-proxy för påfyllnadsutsikt: Björkaån/Eggelstad, SUBID 103.

## Viktigt om v0.4

- Förbrukningstakt är fortfarande senaste avlästa Vombverket-värde, inte rullande 24-timmarsmedel.
- Tillgång klassas med en enkel första prototypregel: stor om nivån ligger över P5 + buffert.
- Påfyllnadsutsikten är en första trendproxy för Björkaån/Eggelstad, inte slutlig samlad tillrinning till Vombsjön.
- Slutlig modell bör senare använda samlad tillrinning för Björkaån, Torpsbäcken, Borstbäcken och lokal tillrinning.

## Kör lokalt

```bash
npm install
npm start
```

Öppna sedan:

```text
http://localhost:3000
```

## Testa API

```text
http://localhost:3000/api/vattenkontot
```

API:t returnerar livevärden om externa källor svarar. Om en datakälla inte svarar använder prototypen fallback för just den komponenten.

## Tvinga testdata

```text
http://localhost:3000/api/vattenkontot?source=test
```

Du kan också testa andra kombinationer:

```text
http://localhost:3000/api/vattenkontot?source=test&availability=liten&refillOutlook=dålig&currentLps=700&normalLps=600
```

Tillåtna värden:

- `availability`: `stor` eller `liten`
- `refillOutlook`: `god` eller `dålig`
- `consumptionRateClass`: `låg` eller `hög`; om detta utelämnas klassas värdet automatiskt mot dagens måltakt
- `currentLps`: aktuell förbrukningstakt i liter per sekund
- `normalLps`: normal förbrukningstakt i liter per sekund
- `householdCount`: standard är 200000

## Miljövariabler

Normalt behövs inga miljövariabler på Render. Följande kan användas för att ändra prototypregler:

```text
HOUSEHOLD_COUNT=200000
TEST_NORMAL_LPS=600
P5_LEVEL_M=18.73
P5_BUFFER_M=0.20
REFILL_PROXY_SUBID=103
SMHI_LEVEL_UNIT=cm
```

## Nästa steg

- Validera att SMHI-värdet visas korrekt i appen.
- Validera att HydroNu/S-HYPE-proxyn faktiskt hämtas från SUBID 103.
- Identifiera fler relevanta SUBID/AROID för Torpsbäcken, Borstbäcken och lokal tillrinning.
- Skapa lagring för Sydvatten-avläsningar.
- Beräkna rullande 24-timmarsmedel för förbrukningstakt.
