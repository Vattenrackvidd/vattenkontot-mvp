# Vattenkontot MVP

Detta är en fungerande MVP för Vattenkontot.

Version 0.3 gör tre saker:

1. Visar en estetisk appvy i webbläsaren.
2. Hämtar Vombverkets senaste avlästa leverans från Sydvattens publika endpoint.
3. Använder leveransen som aktuell förbrukningstakt i liter per sekund.

Tillgång och påfyllnadsutsikt är fortfarande prototypvärden i denna version. Nästa steg är att koppla SMHI:s vattennivå för Vombsjön.

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

API:t returnerar livevärde för Vombverkets leverans om Sydvattens endpoint svarar.

## Tvinga testdata

```text
http://localhost:3000/api/vattenkontot?source=test
```

Du kan också testa andra kombinationer med query-parametrar:

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

## Viktig metodnotis

I v0.3 är förbrukningstakt Sydvattens senaste avlästa värde för Vombverket. Slutmålet är att använda ett rullande 24-timmarsmedel när appen har lagring för historiska avläsningar.

## Nästa steg

- Koppla SMHI:s vattennivå för Vombsjön.
- Koppla S-HYPE-påfyllnadsutsikt.
- Skapa daglig lagring av resultatet.
