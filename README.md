# PromptCard — Image to Prompt AI (Firefox Developer Edition uyarlaması)

Sayfadaki **herhangi bir görseli analiz edip**, benzer bir görsel üretmek için
**ayrıntılı AI prompt'u** oluşturan Firefox eklentisi. Chrome'daki "PromptCard"
eklentisinin WebExtension (Manifest V3) uyarlamasıdır.

## Özellikler

- **Sağ tık menüsü:** Görsel üzerine sağ tıklayıp
  *"🎴 PromptCard: Bu görsel için AI prompt üret"* seç.
- **Hover chip:** Büyük görsellerin üzerine gelince sağ üstte *🎴 Prompt* butonu belirir.
- **Toolbar popup:** Araç çubuğu butonu sayfadaki tüm görselleri listeler; birine
  tıklayınca o görsel için prompt üretilir.
- **Prompt overlay:** Ekran görüntüsündeki gibi görselin üzerinde koyu "PROMPT"
  paneli açılır; **Kopyala** ve **↻ Yeniden** butonları vardır.
- **İki motor:**
  - *Yerel motor (varsayılan, offline):* Renk paleti, ışık, kontrast, sıcaklık,
    detay/kenar yoğunluğu, vinyet ve kompozisyonu ölçüp ayrıntılı bir prompt yazar.
  - *AI motor (opsiyonel):* Ayarlardan OpenAI uyumlu API adresi + anahtar + model
    girersen, görsel vision modeline gönderilir ve model gerçek bir prompt yazar.

## Firefox Developer Edition'a yükleme

1. Firefox Developer Edition'ı aç.
2. Adres çubuğuna `about:debugging` yaz → **"This Firefox"** (Bu Firefox) sekmesi.
3. **"Load Temporary Add-on…"** (Geçici eklenti yükle) butonuna tıkla.
4. `C:\Users\musar\promptcard-firefox\manifest.json` dosyasını seç.
5. Eklenti araç çubuğunda belirir; herhangi bir http/https sayfada test et.

> Geçici eklenti tarayıcı kapatılınca kaldırılır. Kalıcı kurulum için
> `web-ext sign` ile imzalama veya `about:config` →
> `xpinstall.signatures.required=false` (yalnızca Dev/Nightly) gerekir.

## Ayarlar (opsiyonel AI)

Araç çubuğu butonu → **⚙ Ayarlar** (veya about:debugging üzerinden eklenti
seçenekleri). Örnek değerler:

| Alan | Örnek |
|---|---|
| API adresi | `https://api.openai.com/v1` |
| API anahtarı | `sk-...` |
| Model | `gpt-4o-mini` / `gpt-4o` |

Anahtar boşsa yerel motor kullanılır; hiçbir sunucuya veri gönderilmez.

## Dosyalar

| Dosya | Görev |
|---|---|
| `manifest.json` | MV3 manifest (gecko id: `promptcard-firefox@local`) |
| `background.js` | Sağ tık menüsü, mesaj yönlendirme, AI (chat/completions) çağrısı |
| `analyzer.js` | Yerel analiz motoru (OffscreenCanvas istatistikleri → prompt) |
| `content.js` / `content.css` | Hover chip + PROMPT overlay + kopyalama |
| `popup.html` / `popup.js` | Sayfadaki görselleri listeleyen toolbar popup |
| `options.html` / `options.js` | API ayarları (storage.sync) |
| `icons/` | Eklenti ikonları |
| `test/smoke.js` | Node smoke testi: üç scripti stub'larla yükler, yerel motoru çalıştırır |

## Test

```powershell
node test/smoke.js
```

Beklenen çıktı: `LOAD-OK`, `ENGINE-OK`, örnek prompt ve `SMOKE-DONE`.

## GitHub

Bu repo: <https://github.com/googIeuser/promptcard>

## Notlar / bilinen sınırlar

- `file://` ve `about:` sayfalarında content script çalışmaz (tarayıcı politikası).
- Yerel motor özneyi "bilemez" (offline); stil/ışık/renk/kompozisyon düzeyinde
  profesyonel bir prompt yazar. Özne tanımlı prompt için AI anahtarı ekle.
