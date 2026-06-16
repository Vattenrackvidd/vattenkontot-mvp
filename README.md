# Vattenkontot MVP v0.4.2

Dygnsuppdaterad prototyp som översätter tillgång, påfyllnadsutsikt och förbrukningstakt till en dagsrekommendation för vattenanvändning.

## Nytt i v0.4.2

- Vombverkets leverans hämtas från Sydvatten.
- Vombsjöns vattennivå hämtas från SMHI station Vombsjön övre.
- Tillgång klassas nu mot säsongspercentiler för samma tid på året, inte mot den tidigare enkla P5-regeln.
- En vattennivå under säsongsmedianen (P50) klassas som `liten` i den externa binära modellen.
- Appen visar en kort bedömning som `mycket låg`, `låg`, `under normal`, `nära normal` eller `hög`.
- Påfyllnadsutsikt använder fortfarande första HydroNu/S-HYPE-proxy: Björkaån/Eggelstad, SUBID 103.

## Säsongsnormal tillgång

Säsongsreferensen ligger i:

```text
data/vombsjon-seasonal-percentiles.json
```

Den är beräknad från historiska SMHI-observationer för station 2018 med ett datumfönster på ±15 dygn. Extern klassning:

```text
Stor tillgång = aktuell nivå är minst P50 för samma tid på året
Liten tillgång = aktuell nivå ligger under P50 för samma tid på året
```

Detta är en prototypregel. Den är mer rimlig än den tidigare P5-regeln, men bör senare förankras med Sydvatten/VA-aktörer.

## Kör lokalt

```bash
npm install
npm start
```

Öppna:

```text
http://localhost:3000
```

API:

```text
http://localhost:3000/api/vattenkontot
```
