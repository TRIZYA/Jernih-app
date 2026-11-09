# Jernih — AI Image Restorer & Upscaler

Aplikasi web untuk memperjelas gambar yang blur, beresolusi kecil, atau rusak oleh kompresi JPEG, termasuk foto, ilustrasi, dan dokumen bertulisan seperti piagam atau sertifikat. Seluruh proses berjalan **di browser pengguna**, jadi gambar tidak diunggah ke server mana pun dan proyek ini bisa dibuat serta di-hosting **sepenuhnya gratis**.

> Status: persiapan Fase 1 selesai; spike Fase 0 masih berjalan.

## Pendekatan

Blur sedang sampai berat dan artefak kompresi tidak bisa diselesaikan hanya dengan sharpen. Karena itu aplikasi memakai model **restorasi + super-resolution** yang dilatih menangani gambar rusak (blur, noise, kompresi):

| Peran | Teknologi |
| --- | --- |
| Mesin utama (kualitas) | Real-ESRGAN (varian general) lewat ONNX Runtime Web, WebGPU dengan cadangan WASM |
| Mode Cepat | UpscalerJS + TensorFlow.js (model ESRGAN ringan) |
| Cadangan tanpa AI | Lanczos (pica) + unsharp mask |
| Opsional lanjutan | Restorasi wajah (GFPGAN/CodeFormer, cek lisensi), pemeriksa teks (tesseract.js) |

## Fitur

**Fitur inti (MVP)**
- Unggah gambar lewat pilih file, drag and drop, atau tempel (Ctrl+V)
- Preset: **Foto**, **Dokumen/Teks**, **Ilustrasi/Anime**
- Skala 2x dan 4x dengan model Cepat atau Kualitas
- Pemrosesan per tile dengan padding agar gambar besar tidak membuat browser kehabisan memori
- Progres per tile, estimasi waktu, dan tombol batal
- Slider sebelum/sesudah dengan zoom dan geser
- Unduh PNG, JPG, atau WebP
- Peringatan jujur: AI menebak detail, terutama pada teks kecil

**Peningkatan kualitas**
- Pra-proses opsional: kurangi artefak kompresi/noise sebelum upscale
- Pasca-proses opsional: sharpen dan kontras ringan dengan slider
- Mode Dokumen: perlakuan khusus untuk teks dan garis, dengan peringatan bahwa karakter kecil bisa salah ditebak

**Fitur AI pendukung (puter.js, opsional)**
- Analisis gambar: tipe, tingkat blur, dan saran preset serta skala
- Ditandai sebagai saran; fitur inti tetap jalan tanpa AI
- Gambar dikirim ke layanan pihak ketiga, jadi wajib ada persetujuan pengguna

**Fitur lanjutan (opsional)**
- Pemeriksa teks (OCR) yang membandingkan teks sebelum dan sesudah untuk menandai kemungkinan karakter berubah
- Restorasi wajah
- Antrean batch dan unduh ZIP
- Riwayat lokal (IndexedDB)
- PWA dan cache model
- Mode gelap

## Alur penggunaan

1. Tempel atau seret gambar.
2. Pilih preset dan skala (atau minta saran AI).
3. Tekan "Perjelas gambar" dan tunggu progres.
4. Bandingkan hasil dengan slider, terutama bagian teks atau wajah.
5. Unduh hasil.

## Tech Stack (semua gratis)

| Bagian | Teknologi |
| --- | --- |
| Frontend | React + Vite (JSX) |
| Mesin kualitas | ONNX Runtime Web + model Real-ESRGAN ONNX |
| Mesin cepat | UpscalerJS + TensorFlow.js |
| Pemrosesan | Web Worker + Canvas/OffscreenCanvas |
| Penyimpanan | Tidak ada server; opsional IndexedDB |
| AI pendukung (opsional) | [puter.js](https://developer.puter.com) |
| Deploy | Cloudflare Pages, Vercel Hobby, atau GitHub Pages |

Tidak ada backend dan tidak ada database pada MVP. Itu yang membuat biaya tetap nol.

## Arsitektur

```
Browser pengguna
  ├─ React UI -> Web Worker
  │     ├─ pra-proses (artefak kompresi/noise)
  │     ├─ tile + padding -> model (ONNX Real-ESRGAN | ESRGAN ringan)
  │     ├─ gabung tile -> pasca-proses (sharpen)
  │     └─ cadangan: Lanczos + sharpen
  ├─ Slider sebelum/sesudah dan unduh
  └─ puter.js (opsional): saran preset atas permintaan pengguna

Hosting statis (Cloudflare Pages / Vercel / GitHub Pages)
  └─ aplikasi + file model (cache di browser)
```

- Gambar tidak pernah meninggalkan perangkat, kecuali pengguna memakai fitur AI puter.js dan menyetujuinya.
- Jika WebGPU tidak tersedia, mesin kualitas jatuh ke WASM (lebih lambat) atau pengguna diarahkan ke mode Cepat.

## Struktur Folder (rencana)

```
.
├── public/
│   └── models/           # file model ONNX (atau CDN)
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── workers/          # upscale.worker.js
│   ├── engines/          # onnxEngine.js, tfjsEngine.js, classicEngine.js
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── tests/
│   └── fixtures/         # gambar uji sintetis, tanpa data pribadi
├── index.html
├── vite.config.js
└── package.json
```

## Menjalankan Secara Lokal

Prasyarat: Node.js 18 atau lebih baru dan browser modern. WebGPU (Chrome/Edge terbaru) disarankan untuk mesin kualitas.

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Tidak ada file `.env` yang wajib untuk MVP.

## Hosting gratis

1. Dorong kode ke repository GitHub.
2. Hubungkan ke Cloudflare Pages atau Vercel (paket gratis); build `npm run build`, output `dist`.
3. Pastikan ukuran file model tidak melebihi batas file hosting yang dipilih.

## Batasan yang perlu diketahui

- AI **menebak** detail yang masuk akal, bukan memulihkan detail asli. Teks kecil, nomor, tanda tangan, dan wajah bisa terlihat tajam tetapi salah.
- Hasil restorasi dokumen resmi hanya untuk keterbacaan dan tampilan. Jangan dipakai sebagai pengganti dokumen asli, dan cek ulang teks penting dengan sumbernya.
- Pemrosesan di browser lebih lambat daripada GPU server, terutama untuk gambar besar.
- Batas ukuran input aman ditentukan oleh memori perangkat.
- Periksa lisensi setiap model (misalnya model wajah punya batasan penggunaan komersial) dan ukuran file sebelum dipakai.
- Jangan menaruh dokumen pribadi pengguna di repository sebagai fixture.

## Dokumentasi

- [`ROADMAP.md`](ROADMAP.md): checklist progres dan prioritas pengerjaan.
- [`UI.md`](UI.md): panduan tampilan dan alur pengguna.
- [`AGENTS.md`](AGENTS.md): aturan kerja untuk agent AI.

## Roadmap ringkas

- [x] Persiapan proyek Vite + React, dependensi dasar, dan pemilihan sumber model lokal
- [ ] Spike: WebGPU, ponsel fisik, dan tile masih perlu divalidasi (hasil awal ada di `ROADMAP.md`)
- [ ] Mesin ONNX dengan tile, progres, dan batal
- [ ] Slider sebelum/sesudah dan unduh
- [ ] Preset, pra/pasca-proses, dan cadangan klasik
- [ ] Mode Cepat (UpscalerJS)
- [ ] Saran AI dan pemeriksa teks
- [ ] Deploy gratis

Rincian lengkap ada di `ROADMAP.md`.

## Lisensi

Belum ditentukan. Perhatikan lisensi model dan pustaka pihak ketiga.
