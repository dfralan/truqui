# Funnel Protocol

El producto es un **canal P2P**. En el canal se publican **objetos**. Los **scripts** (chat, Truqui, Meet) leen, visualizan o consultan esos objetos. No son el producto: son skins.

Siempre full P2P. Siempre links. Sin servidor de objetos.

## Primitivas

| Cosa | Qué es |
|------|--------|
| **Canal** | Handshake WebRTC. Crear canal = crear link. Unirse = abrir link + devolver answer. |
| **Objeto** | Evento CQ (`kind` + `payload` + `id`). Vive en el log del canal. |
| **Script** | Módulo que se suscribe al log. No posee el canal. |

```
Link offer/answer  →  Canal P2P  →  Log de objetos CQ
                                      ↑ +
                         scripts: chat / truqui / meet…
```

## Transporte (hoy)

Señalización = URL. Nada en relay.

```
https://host/?r=ROOM_ID&o=BASE64URL_OFFER
https://host/?r=ROOM_ID&a=BASE64URL_ANSWER
```

`o` / `a` = `RTCSessionDescription` JSON empaquetado (`pack`: UTF-8 → base64url, sin `+` `/` `=`). El SDP **nunca viaja crudo**.

### STUN es el cable

STUN (Google public) solo sirve ICE / NAT. No ve payload. El contenido va por DataChannel. Nosotros navegamos ese cable **ofuscados**: el handshake está empaquetado en el link; el log es CQ. Más adelante se puede ofuscar más el SDP; hoy no se expone ni se loguea.

### DataChannel

| type | Uso |
|------|-----|
| `cq` | push objeto (dedup por `cq_id`) |
| `cq_sync` | `{ since }` gap fill al abrir |
| `state` / `chat` / `ready` | legado Truqui (minijuego aislado) |

Al abrir el canal cada peer pide `cq_sync` desde su head. El otro manda los objetos posteriores. Dedup por `id`.

## Objeto CQ (subset CQ-C14N/1)

```json
{
  "cq": "2",
  "kind": "funnel.message/1",
  "coords": { "room": "abc123" },
  "payload": { "text": "hola" },
  "provenance": {
    "parents": [],
    "derived_from": ["cq:sha256:..."],
    "caused_by": []
  },
  "operations": [],
  "lifecycle": {
    "issued_at": 1700000000,
    "not_before": null,
    "expires_at": null,
    "supersedes": [],
    "revokes": []
  }
}
```

- `id` = `cq:sha256:` + SHA-256(bytes canónicos sin `id` ni `signatures`)
- Cada publish encadena `derived_from` al head local
- Sets (`derived_from`, `parents`, …) se ordenan lexicográficamente antes de hashear

### Kinds actuales

| Kind | Quién lo lee |
|------|----------------|
| `funnel.message/1` | script chat (`payload.text`) |
| (cualquier kind) | timeline crudo + composer `+` |

Truqui sigue en `truqui.html` con su propio sync de estado. Todavía no es un script del canal.

## Scripts

Un script se monta sobre un canal abierto. Filtra por `kind`, renderiza, puede `publish`. Chat es el default. Meet es un script futuro (media tracks), no un modo de la app.

---

## Más adelante — CABAB / transacciones

No implementado. El transporte sigue siendo P2P + links.

- **CABAB liviano**: el log CQ ya es una cadena (`derived_from`). Un asiento posterior apunta al anterior. Verificar = rehashear + caminar la cadena.
- **Transacción**: objeto firmado (secp256k1 / identidad local) y, si hace falta, cifrado con room key en fragment `#k=` — la key **nunca** va al relay ni a STUN.
- **Zap / pago**: un kind de asiento (`funnel.zap/1` o similar). No es un motor de pagos; es un objeto que un script puede mostrar o validar.
- **Smart contract**: un script que valida o visualiza esos objetos. La firma vive en el objeto, no en un chain ajeno.
- **cqpersist** (opcional): mismo objeto, envelope cifrado en Nostr kind `20000` tags `#r` `#t=cqpersist`, punteros efímeros sin payload. Solo si hace falta async / agentes. El canal P2P no se reemplaza.

Room key (cuando exista):

```
https://host/?r=abc#k=BASE64URL_ROOM_KEY
```
