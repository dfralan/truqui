# Truqui

Truco argentino online, minimal. Dos jugadores, link para compartir, sync con [GUN](https://gun.eco/).

## Cómo jugar

```bash
npm install
npm start
```

Abrí `http://localhost:3456`, tocá **Iniciar partida**, copiá el link y mandáselo a tu rival (otra pestaña, incógnito u otro dispositivo). Cuando entra, arranca.

El servidor incluye relay GUN en `/gun`. **Importante:** usá `npm start`, no `npx serve` — el relay necesita WebSocket.

## Reglas (versión simple)

- Mazo español de 40 cartas, 3 por jugador
- 3 bazas, gana quien saque más (parda define en empate)
- Truco / Retruco / Vale 4
- Primero en 30 puntos gana
