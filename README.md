# Vattenkontot MVP

Detta är en första fungerande MVP för Vattenkontot.

Den gör tre saker:

1. Visar en estetisk appvy i webbläsaren.
2. Har ett test-API på `/api/vattenkontot`.
3. Har beräkningslogik för situation 1–8 och liter per hushåll.

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

Du kan också testa andra kombinationer med query-parametrar:

```text
http://localhost:3000/api/vattenkontot?availability=liten&refillOutlook=dålig&consumptionRateClass=hög&currentLps=700&normalLps=600
```

Tillåtna värden:

- `availability`: `stor` eller `liten`
- `refillOutlook`: `god` eller `dålig`
- `consumptionRateClass`: `låg` eller `hög`
- `currentLps`: aktuell förbrukningstakt i liter per sekund
- `normalLps`: normal förbrukningstakt i liter per sekund
- `householdCount`: standard är 200000

## Nästa steg

- Koppla Vombverkets faktiska leveranshastighet.
- Koppla SMHI:s vattennivå för Vombsjön.
- Koppla S-HYPE-påfyllnadsutsikt.
- Skapa daglig lagring av resultatet.
