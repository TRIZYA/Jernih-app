# Panduan UI & Alur Pengguna Aplikasi Image Restorer & Upscaler

Dokumen ini menjelaskan bagaimana UI seharusnya merepresentasikan alur memperjelas gambar, bukan sekadar tombol unggah dan unduh. Fokusnya membuat pengguna cepat paham: gambar apa yang diproses, berapa lama lagi, seberapa besar perbedaannya, dan seberapa bisa dipercaya hasilnya.

## Prinsip desain utama

1. Aksi utama (pilih atau tempel gambar) harus langsung terlihat dan cepat dilakukan.
2. Hasil harus bisa dinilai dengan mata: perbandingan sebelum/sesudah selalu tersedia.
3. Proses yang lama harus transparan: progres, estimasi waktu, dan tombol batal.
4. Default masuk akal; opsi lanjutan disembunyikan dulu.
5. Jujur soal batas AI: detail hasil adalah tebakan, terutama pada teks kecil dan wajah.
6. Privasi terlihat jelas: gambar diproses di perangkat dan tidak diunggah.
7. Mobile first. Banyak pengguna akan membukanya dari ponsel.
8. Layout bersih dan konsisten, tanpa dekorasi yang tidak membantu menilai gambar.

## Status implementasi UI saat ini

Workspace sudah terhubung ke pemrosesan lokal di Web Worker: unggah/drag-and-drop/
tempel, pratinjau, validasi gambar, pengaturan preset, skala dan mode, peringatan
Dokumen, progres nyata, estimasi kasar waktu tersisa, pembatalan, rotasi 90°,
slider sebelum/sesudah, serta ekspor PNG/JPG/WebP. Preset Dokumen mendapat
sharpen/kontras ringan otomatis; semua preset masih memakai model upscale umum.
Puter.js memiliki login manual tersendiri, terpisah dari Firebase, dan dialog
persetujuan sebelum gambar dikirim untuk saran atau OCR. OCR mengeluarkan teks
hasil yang dapat disalin, bukan memulihkan isi dokumen yang hilang. Panel
Analisis AI ditempatkan dalam kolom pratinjau, tepat di bawah kartu pratinjau,
dengan latar putih.
Pembanding mendukung zoom bersama, drag langsung di area di luar garis pembanding untuk
geser saat zoom aktif, Reset tampilan (termasuk posisi slider), dan Ctrl/⌘ +
gulir. Pemrosesan Kualitas 4× meminta login Google; semua hasil dibatasi hingga
32 megapiksel dan aksi proses dinonaktifkan jika perkiraan hasil melampaui batas.

## 1. Halaman utama (ruang kerja)

Satu halaman dengan tiga keadaan: kosong, memproses, dan hasil.

**Keadaan kosong**
- Area unggah besar: seret gambar, klik untuk memilih, atau tempel (Ctrl+V).
- Teks singkat: format didukung (JPG, PNG, WebP), batas ukuran, dan catatan "diproses di perangkatmu".

**Keadaan siap**
- Pratinjau gambar asli dengan dimensi dan ukuran file.
- Panel pengaturan dan tombol utama "Perjelas gambar" yang menonjol.
- Perkiraan dimensi hasil, misalnya `700 × 520 → 2800 × 2080`.
- Kualitas 4× mensyaratkan login Google; hasil di atas 32 megapiksel menonaktifkan tombol proses dan menjelaskan cara mengatasinya.

**Keadaan memproses**
- Bar progres dengan persentase, jumlah tile (misalnya `12 / 36`), dan estimasi sisa waktu.
- Tombol "Batal" yang selalu terlihat.
- Pengaturan dinonaktifkan selama proses.
- Saat model diunduh pertama kali: progres unduh dan keterangan bahwa itu hanya sekali.

**Keadaan hasil**
- Slider sebelum/sesudah dengan zoom dan geser langsung di pratinjau yang tersinkron; Reset mengembalikan zoom, pan, dan slider ke posisi tengah.
- Info dimensi dan ukuran file sebelum dan sesudah.
- Tombol "Unduh" dengan pilihan format dan kualitas, serta "Proses ulang" dan "Gambar baru".
- Untuk preset Dokumen: banner "Teks kecil, nomor, dan tanda tangan bisa salah ditebak. Periksa dengan dokumen asli."

## 2. Panel pengaturan

- **Preset:** Foto, Dokumen/Teks, Ilustrasi/Anime. Preset menentukan model dan pra/pasca-proses bawaan.
- **Kualitas:** Cepat (UpscalerJS) atau Kualitas (Real-ESRGAN ONNX). Tampilkan keterangan kecepatan dan kebutuhan perangkat.
- **Skala:** 2x atau 4x.
- **Lanjutan (tersembunyi secara default):** pengurangan artefak kompresi, sharpen, kontras, ukuran tile.
- **Minta saran AI/OCR** (opsional, Puter.js): login Puter eksplisit dan persetujuan sebelum gambar dikirim; tidak terkait sesi Firebase.
- Indikator mesin yang dipakai: WebGPU, WASM, atau cadangan klasik.

## 3. Kondisi khusus

- Gambar terlalu besar: peringatan dengan opsi "Perkecil dulu" atau "Pakai skala lebih kecil".
- Format tidak didukung atau file rusak: pesan jelas dan ajakan memilih file lain.
- WebGPU tidak tersedia: otomatis pakai WASM dan beri tahu bahwa prosesnya lebih lambat, atau tawarkan mode Cepat.
- Semua mesin AI gagal: tawarkan mode cadangan (Lanczos + sharpen) dengan label jelas bahwa kualitasnya lebih rendah.
- Kehabisan memori: pesan jelas, lalu usulkan skala atau mode lebih ringan.
- Proses dibatalkan: kembali ke keadaan siap tanpa kehilangan gambar asli.
- Pemeriksa teks (jika ada): tampilkan daftar bagian teks yang berubah antara asli dan hasil.

## 4. Antrean batch (P2)

- Daftar gambar dengan miniatur, status (menunggu, memproses, selesai, gagal), dan progres.
- Aksi: hapus dari antrean, coba lagi, unduh semua sebagai ZIP.

## 5. Riwayat lokal (P2)

- Grid hasil sebelumnya yang disimpan di browser.
- Teks jelas bahwa riwayat hanya ada di perangkat ini, plus tombol "Hapus semua".

## 6. Pengaturan dan bantuan

- Preferensi bawaan (preset, skala, format unduhan).
- Penjelasan jujur: AI menambahkan detail yang masuk akal, bukan memulihkan detail asli.
- Informasi privasi: gambar tidak diunggah, kecuali pengguna memakai fitur AI dan menyetujuinya.

## 7. Alur UI yang disarankan

### Dari unggah ke unduh
1. Pengguna menyeret atau menempel gambar.
2. Sistem menampilkan pratinjau, dimensi, dan estimasi hasil.
3. Pengguna memilih preset dan skala (atau memakai default).
4. Pengguna menekan "Perjelas gambar" dan melihat progres.
5. Hasil muncul di slider sebelum/sesudah.
6. Pengguna memeriksa bagian penting (teks, wajah), menyesuaikan sharpen bila perlu, lalu mengunduh.

### Saat ada masalah
- Proses gagal: tampilkan alasan terakhir dan tombol "Coba lagi" atau "Pakai mode lebih ringan".
- Pengguna menutup tab saat memproses: tampilkan konfirmasi jika proses masih berjalan.

## 8. Standar komponen UI yang disarankan

```text
src/
├── components/
│   ├── Layout/
│   ├── Dropzone/
│   ├── SettingsPanel/
│   ├── ProgressBar/
│   ├── CompareSlider/     # sebelum/sesudah
│   ├── DownloadMenu/
│   ├── Notice/            # banner peringatan (dokumen, mesin cadangan)
│   ├── Modal/
│   └── Toast/
├── pages/
│   ├── Workspace/         # halaman utama
│   ├── Batch/             # opsional
│   ├── History/           # opsional
│   └── About/
├── hooks/
│   ├── useUpscaler.js
│   └── useImageFile.js
├── workers/
│   └── upscale.worker.js
├── engines/
│   ├── onnxEngine.js
│   ├── tfjsEngine.js
│   └── classicEngine.js
├── utils/
│   ├── image.js           # baca, perkecil, ekspor
│   └── format.js          # format ukuran file dan dimensi
├── App.jsx
├── App.css
└── main.jsx
```

## 9. Prinsip visual yang harus dijaga

- Latar netral agar warna gambar tidak terdistorsi saat dinilai.
- Slider sebelum/sesudah punya gagang besar, label "Asli" dan "Hasil", dan bisa digeser dengan sentuhan maupun keyboard.
- Warna status: hijau untuk selesai, netral untuk proses, kuning untuk peringatan, merah untuk gagal. Jangan mengandalkan warna saja; sertakan ikon atau teks.
- Dimensi ditulis konsisten (`1024 × 768 px`), ukuran file memakai KB atau MB dengan satu desimal.
- Gambar besar tidak boleh melebarkan halaman; pratinjau bisa di-zoom di dalam wrapper sendiri.
- Tombol aksi memakai ikon bermakna plus label teks.
- Konfirmasi untuk aksi destruktif (hapus riwayat).
- Area sentuh minimal 40px di mobile.
- Hormati `prefers-reduced-motion`.

## 10. Backlog UI prioritas berikutnya

### Prioritas P0
- [x] Dropzone dan pratinjau gambar.
- [x] Panel pengaturan dasar (preset, skala).
- [x] Progres dengan tombol batal.
- [x] Slider sebelum/sesudah dan tombol unduh.
- [x] Loading, empty, dan error state.

### Prioritas P1
- [x] Pilihan Cepat/Kualitas.
- [x] Indikator mesin.
- [x] Banner peringatan mode Dokumen.
- [x] Zoom dan geser tersinkron pada slider.
- [ ] Pengaturan lanjutan (artefak kompresi, sharpen).
- [x] Toast, peringatan ukuran gambar, dan mode cadangan.

### Prioritas P2
- [ ] Panel saran AI dengan puter.js.
- [ ] Pemeriksa teks (OCR).
- [ ] Batch dan unduh ZIP.
- [ ] Riwayat lokal.
- [ ] Mode gelap.
- [ ] PWA.

## 11. Kesimpulan

UI yang baik untuk image restorer berpusat pada dua pertanyaan: "Apakah hasilnya benar-benar lebih jelas?" dan "Seberapa jauh saya bisa mempercayainya?" Slider perbandingan, progres yang jujur, peringatan pada teks dan wajah, serta unduhan yang mudah harus menjawabnya dengan cepat.
