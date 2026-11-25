# DVA Roads

Plataforma Android de obras, conserva e levantamentos rodoviários — by **DVABRAO SERVIÇOS LTDA**.

Um núcleo comum (GPS, odômetro em km e estacas, sessões, fotos, exportação, backup) e módulos liberados por chave:

| Módulo | Para quê |
| --- | --- |
| Marco Zero | Navegação e locação de obra em km e estacas |
| SLIR | Patologias e inventário com foto legendada |
| SH | Sinalização horizontal: pintura com um toque, KML, croqui linear e quantitativos |
| SV | Sinalização vertical, defensas e barreiras: inventário por estado de conservação |

## Estrutura

```
web/                 app (HTML + JS) que roda dentro do APK
  js/util.js         formatação, unidades km/estaca
  js/store.js        camada de dados (único acesso ao armazenamento)
  js/license.js      licenças por chave (só a chave pública)
  js/gps.js          GPS nativo + reserva WebView
  js/core.js         módulos, sessões, odômetro, registros, backup
  js/photo.js        fotos com legenda
  js/export.js       KML, KMZ, relatório HTML/PDF
  js/icons.js        ícones das faixas
  js/ui.js           telas e configurações
  js/modules/*.js    um arquivo por módulo
android/             casca Android (WebView, GpsService, NativeFS)
tools/gerar-chave.mjs  gera chaves de ativação (precisa da chave privada, que NÃO fica aqui)
```

## Pasta das sessões no celular

`Android/data/com.dvabrao.dvaroads/files/DVA Roads/Sessoes/<sessão>/` com `sessao.json`, `trajeto.json`, `fotos/` e `export/`.
Backups e exportações também são copiados para `Downloads/DVA Roads/`.

## Novo módulo

Crie `web/js/modules/<id>.js` chamando `Modules.register({...})` e inclua o script no `index.html`.
