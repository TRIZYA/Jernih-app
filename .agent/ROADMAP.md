# Roadmap & Checklist Aplikasi Image Restorer & Upscaler

Dokumen ini dipakai untuk memantau progres proyek secara realistis. Alur inti yang ingin dicapai: pengguna mengunggah gambar blur atau berkompresi (foto, ilustrasi, atau dokumen bertulisan), model AI memperjelasnya di browser, pengguna membandingkan hasilnya, lalu mengunduh gambar yang lebih HD, tanpa biaya server.

## Status proyek saat ini

Fase 1 (persiapan dan konfigurasi awal) selesai. Spike Fase 0 berhasil
menjalankan ONNX melalui WASM dan UpscalerJS di browser pada tiga fixture
sintetis; browser ini tetap tidak menyediakan adapter WebGPU dan ponsel fisik
belum diuji. Mesin Fase 2 kini terhubung di Web Worker dengan tile, progres,
pembatalan, fallback, dan ekspor gambar. UI Fase 3 mendukung alur proses,
perbandingan dengan zoom/geser sinkron, rotasi dokumen, serta unduhan. Fase 5
memakai autentikasi Puter terpisah dari Firebase dan persetujuan eksplisit
sebelum gambar dikirim ke layanan AI.

- [x] README.md, ROADMAP.md, UI.md, dan AGENTS.md disusun (versi dengan Real-ESRGAN ONNX sebagai mesin utama).
- [x] Nama aplikasi dan nama repository dipilih: `Jernih` / `Jernih-app`.
- [x] Kandidat Real-ESRGAN general x4v3 diuji lewat ONNX Runtime Web/WASM dan lisensinya diperiksa; WebGPU masih tertunda.
- [x] Kandidat mode cepat UpscalerJS default ESRGAN 2x diuji di browser.
- [ ] Ukuran tile aman belum diputuskan lewat uji memori/perangkat.
- [ ] Hosting gratis belum dipilih.

## Keputusan arsitektur

- Semua pemrosesan di browser; tanpa backend dan database.
- Mesin kualitas: Real-ESRGAN (varian general) lewat ONNX Runtime Web, WebGPU dengan cadangan WASM.
- Mode Cepat: UpscalerJS + TensorFlow.js (model ESRGAN ringan).
- Cadangan tanpa AI: resampling Canvas berkualitas tinggi + sharpen.
- Urutan proses: pra-proses → tile → model → gabung → pasca-proses → bandingkan.

## Alur kerja yang ingin dicapai

1. Pengguna memilih atau menempel gambar.
2. Aplikasi memeriksa ukuran dan format, lalu menyarankan preset dan skala.
3. Gambar dipotong menjadi tile dan diproses model di Web Worker.
4. Tile digabung menjadi gambar hasil.
5. Pengguna membandingkan sebelum/sesudah, terutama bagian teks dan wajah.
6. Pengguna mengunduh hasil (PNG/JPG/WebP).

Jika salah satu langkah di atas belum jalan, aplikasi belum terasa sebagai upscaler yang nyata.

## Fase 0: Validasi teknologi (spike)
- [x] Siapkan fixture sintetis foto buram, ilustrasi, dan dokumen bertulisan dengan kompresi JPEG; semuanya dibuat lokal di browser.
- [ ] Jalankan Real-ESRGAN ONNX lewat WebGPU; browser uji tidak memperoleh GPU adapter.
- [x] Jalankan Real-ESRGAN ONNX lewat WASM pada ketiga fixture.
- [x] Jalankan UpscalerJS default ESRGAN 2x pada fixture yang sama.
- [ ] Ukur waktu dan memori pada ponsel fisik; belum tersedia. Ukuran model dan metrik awal browser host dicatat di bawah.
- [x] Bandingkan hasil secara visual; teks kecil sintetis rusak pada kedua model, khususnya ONNX. Hasil upscale bukan sumber akurat untuk dokumen.
- [x] Periksa lisensi, ukuran, sumber, dan hash SHA-256 kandidat ONNX.
- [ ] Tetapkan tile final setelah pengujian memori perangkat dan sambungan antar-tile.
- [x] Pilih kandidat mesin utama (Real-ESRGAN x4v3) dan cepat (UpscalerJS ESRGAN 2x); konfirmasi akhir menunggu uji WebGPU/perangkat.

### Catatan eksperimen awal

- Halaman benchmark lokal: `tests/phase0.html`; fixture dibuat sintetis, tanpa data pribadi.
- Kandidat ONNX: [`realesr-general-x4v3.onnx`](../public/models/realesr-general-x4v3.onnx), 4,871,181 byte. Sumber: [Hugging Face model card](https://huggingface.co/Heliosoph/realesrgan-onnx/tree/488e5dda07333179f229a6205d92135eea4c25e9), commit `488e5dda07333179f229a6205d92135eea4c25e9`. SHA-256: `09b757accd747d7e423c1d352b3e8f23e77cc5742d04bae958d4eb8082b76fa4`. Model card menyatakan turunan Real-ESRGAN upstream dan lisensi BSD-3-Clause; file ONNX adalah konversi pihak ketiga, bukan rilis ONNX resmi upstream. Hugging Face melaporkan pemindaian VirusTotal 0/76 deteksi pada file tersebut.
- Kandidat cepat: UpscalerJS `1.0.0` dan model default ESRGAN 2x (`@upscalerjs/default-model` `1.0.0`, lisensi MIT). Bobot TFJS 888,300 byte; graph 12,336 byte.
- Lingkungan uji: VS Code Chromium di Linux, 4 logical cores, `deviceMemory=4`; viewport 390×844 hanya diemulasikan, bukan ponsel fisik.
- Run awal ONNX/WASM: sesi 2,719 ms; inferensi 2,312 ms (foto), 1,778 ms (ilustrasi), 1,472 ms (dokumen), output 4x. UpscalerJS/WebGL: model siap 138 ms; inferensi 3,010 ms, 353 ms, 200 ms, output 2x.
- Validasi ulang setelah path model final: sesi ONNX/WASM 4,403 ms; inferensi 3,382 ms (foto), 1,873 ms (ilustrasi), 2,467 ms (dokumen). UpscalerJS/WebGL: model siap 667 ms; inferensi 2,761 ms, 589 ms, 877 ms. Run ulang menghasilkan waktu yang bervariasi; ini pengukuran satu kali per fixture, bukan median/benchmark lintas perangkat.
- JS heap tercatat 82.4→97.1 MiB pada run awal dan 91.0→94.2 MiB pada validasi ulang. Ini bukan peak memory dan tidak mencakup seluruh memori WASM/GPU.
- WebGPU API terdeteksi, tetapi tidak ada adapter (`no available backend found`), sehingga inferensi WebGPU belum teruji.

## Fase 1: Persiapan & konfigurasi awal
- [x] Putuskan nama aplikasi dan repository: `Jernih` / `Jernih-app`.
- [x] Siapkan proyek Vite + React (JSX), memakai scaffold yang sudah ada.
- [x] Siapkan `.gitignore`, termasuk pengecualian untuk `.env.example`.
- [x] Pasang dependensi dasar (onnxruntime-web, UpscalerJS, TensorFlow.js).
- [x] Putuskan sumber model: lokal di `public/models`.

## Fase 2: Mesin pemrosesan
- [x] Antarmuka mesin (`engines/`): menerima gambar, skala, mode, dan callback progres; mengembalikan hasil yang dapat dibatalkan.
- [x] ONNX Real-ESRGAN mencoba WebGPU lalu WASM. Inferensi WASM teruji; adapter WebGPU tidak tersedia pada browser uji.
- [x] Mode Cepat UpscalerJS memakai WebGL jika tersedia di worker dan CPU sebagai cadangan.
- [x] Mesin klasik berbasis resampling Canvas + sharpen sebagai cadangan akhir; fallback paksa belum diuji.
- [x] Pemrosesan tile dengan konteks: ONNX tile inti 128 px + padding 12 px; UpscalerJS patch 64 px + padding 8 px.
- [x] Inferensi dijalankan di Web Worker.
- [x] Progres tile/persentase, estimasi sisa kasar saat inferensi, dan pembatalan worker.
- [x] Tensor/sesi ONNX dibersihkan per tile dan setelah selesai; worker dihentikan setelah hasil atau pembatalan.
- [x] Batas hasil 32 megapiksel dengan pesan yang jelas; batas unggah 20 MB.
- [x] Deteksi runtime melalui percobaan WebGPU → WASM, WebGL → CPU, lalu fallback klasik.
- [x] Penanganan format tidak didukung, gambar rusak, hasil terlalu besar, kegagalan mesin, dan ekspor format.
- [x] Diuji di browser dengan gambar lokal 343 × 361 px: ONNX/WASM 2× dan 4×, UpscalerJS/WebGL 2×, pembatalan, perbandingan, dan ekspor WebP.
- Catatan ukuran build: worker ONNX berukuran sekitar 2.3 MB dan runtime WASM sekitar 29.5 MB mentah (sekitar 7.1 MB gzip); audit ukuran/hosting perlu dilakukan sebelum deploy.

## Fase 3: Frontend
- [x] Layout dasar halaman utama.
- [x] Area unggah: pilih file, drag and drop, dan tempel.
- [x] Panel pengaturan: preset (Foto, Dokumen, Ilustrasi), skala, mode Cepat/Kualitas. Preset masih berupa panduan; belum mengubah model.
- [x] Tampilan progres dan tombol batal untuk proses worker yang nyata.
- [x] Slider sebelum/sesudah dengan zoom dan geser tersinkron.
- [x] Unduh PNG, JPG, dan WebP dengan pilihan kualitas.
- [x] Banner peringatan untuk mode Dokumen: teks kecil bisa salah ditebak.
- [x] Loading saat membaca gambar, empty state, dan pesan error.
- [x] Tampilan responsif untuk mobile dan desktop.
- [x] Toast untuk gambar yang berhasil dimuat.
- [x] Info dimensi dan ukuran file sebelum/sesudah.
- [x] Rotasi gambar 90° kiri/kanan sebelum pemrosesan dokumen.

## Fase 4: Peningkatan kualitas
- [ ] Pra-proses untuk mengurangi artefak kompresi atau noise (opsional).
- [ ] Pasca-proses sharpen dan kontras dengan slider.
- [ ] Penyetelan preset Dokumen: perlakuan teks dan garis.
- [ ] Evaluasi visual sebelum/sesudah pada set gambar uji tetap.
- [ ] Pemeriksa teks (tesseract.js): bandingkan OCR sebelum dan sesudah, tandai kemungkinan karakter berubah.
- Catatan: preset Dokumen kini menerapkan ketajaman/kontras ringan otomatis, tetapi belum ada slider; OCR teks hasil tersedia via Puter Mistral dengan persetujuan.

## Fase 5: Fitur AI pendukung (puter.js)
- [x] Analisis gambar: tipe, perkiraan tingkat blur, dan saran preset serta skala.
- [x] Persetujuan pengguna eksplisit sebelum gambar dikirim ke Puter AI.
- [x] Fallback jika AI/SDK tidak tersedia; pemrosesan lokal tetap berjalan.
- [x] Login Puter eksplisit/terpisah untuk saran AI dan OCR; Firebase tidak menjadi gerbang akses Puter.
- Catatan: Puter SDK tidak mengirim gambar sebelum persetujuan pengguna. Login Firebase/Google di header tidak ditautkan ke sesi Puter. Pemrosesan gambar inti tetap lokal.
- [ ] Uji login Puter, saran AI, dan OCR end-to-end pada sesi Puter pengguna.

## Fase 6: Performa & kemudahan
- [ ] Antrean batch dan unduh ZIP.
- [ ] Riwayat lokal (IndexedDB) dengan tombol hapus semua.
- [ ] PWA dan cache model agar tidak diunduh ulang.
- [ ] Restorasi wajah (setelah lisensi diperiksa).
- [ ] Mode gelap.

## Fase 7: Finishing & deploy
- [ ] Tes alur: unggah, proses, bandingkan, unduh.
- [ ] Uji di Chrome, Edge, Firefox, dan Safari/iOS (WebGPU belum merata, uji jalur WASM).
- [ ] Uji tampilan di berbagai ukuran layar.
- [ ] Verifikasi tidak ada secret atau dokumen pribadi di repository.
- [ ] Deploy ke hosting gratis.
- [ ] Lengkapi README dengan cara pakai dan batasan.

## Prioritas

### P0 (wajib untuk MVP)
- [ ] Satu model memperjelas satu gambar dari ujung ke ujung.
- [ ] Tile, progres, dan batal berfungsi.
- [ ] Slider sebelum/sesudah dan unduh.
- [ ] Error handling dan loading state yang konsisten.

### P1 (penting setelah MVP)
- [ ] Mesin Cepat dan cadangan klasik.
- [ ] Preset Foto, Dokumen, Ilustrasi.
- [ ] Pra/pasca-proses.
- [ ] Deploy gratis.

### P2 (fitur lanjutan)
- [ ] Saran AI dengan puter.js.
- [ ] Pemeriksa teks (OCR).
- [ ] Batch, riwayat lokal, PWA.
- [ ] Restorasi wajah.
- [ ] Mode gelap.
- [ ] Jalur cadangan server gratis (misalnya Hugging Face Space) untuk gambar besar, jika ketentuannya sesuai.

## Gap kritis yang perlu diselesaikan

1. Ketersediaan dan lisensi model Real-ESRGAN dalam format ONNX yang ringan untuk browser.
2. Ukuran file model terhadap batas hosting gratis dan waktu unduh pertama.
3. Batas memori dan dukungan WebGPU di perangkat pengguna (terutama ponsel dan Safari).
4. Ekspektasi pengguna: AI menebak detail; teks kecil, nomor, tanda tangan, dan wajah bisa salah.
5. Privasi: gambar tidak boleh terkirim ke mana pun tanpa persetujuan eksplisit, dan fixture tidak boleh berisi data pribadi.

## Catatan pembaruan

Setiap kali satu item selesai, centang di sini dan perbarui bagian "Status proyek saat ini". Jika tampilan berubah, perbarui `UI.md`.
