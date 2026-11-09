# AGENTS.md — Aplikasi Web Image Restorer & Upscaler

## 1. Project Overview

Aplikasi web untuk memperjelas gambar blur, beresolusi kecil, atau berartefak kompresi (foto, ilustrasi, dan dokumen bertulisan) memakai model AI yang berjalan di browser pengguna. Tidak ada backend dan tidak ada database pada MVP; tujuannya proyek ini bisa dibuat dan di-hosting gratis.

Project masih pada tahap awal (MVP). Prioritaskan alur inti yang berfungsi dari ujung ke ujung (unggah, proses, bandingkan, unduh) sebelum menambah fitur lain, dan jangan membangun ulang arsitektur yang sudah berjalan.

Prinsip kerja utama:

**Inspect → Plan → Implement → Run → Preview → Evaluate → Refine → Verify**

Agent harus memeriksa hasil perubahan secara langsung melalui live preview jika alat browser tersedia, lalu memperbaiki lagi apabila hasilnya belum sesuai.

## 2. Project Structure

Struktur yang direncanakan (periksa struktur aktual sebelum membuat asumsi):

```text
image-upscaler/
├── .agent/
│   └── AGENTS.md
├── public/
│   └── models/            # file model ONNX jika tidak memakai CDN
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── workers/           # upscale.worker.js
│   ├── engines/           # onnxEngine.js, tfjsEngine.js, classicEngine.js
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── tests/
│   └── fixtures/          # gambar uji sintetis, tanpa data pribadi
├── index.html
├── vite.config.js
├── package.json
├── .gitignore
├── README.md
├── ROADMAP.md
└── UI.md
```

Folder root adalah area kerja aktif. Struktur dapat berkembang sesuai kebutuhan fitur, tetapi perubahan penting harus dicek ulang sebelum dibuat asumsi.

## 3. Tech Stack

- Frontend: React + Vite (JSX)
- Mesin kualitas: ONNX Runtime Web + model Real-ESRGAN (varian general) berformat ONNX, WebGPU dengan cadangan WASM
- Mesin cepat: UpscalerJS + TensorFlow.js (model ESRGAN ringan)
- Cadangan tanpa AI: Lanczos (pica) + unsharp mask
- Pemrosesan: Web Worker + Canvas/OffscreenCanvas
- Penyimpanan: tidak ada server; opsional IndexedDB di browser
- AI pendukung (opsional): puter.js, sisi klien, hanya untuk fitur yang dipicu pengguna
- Pemeriksa teks (opsional): tesseract.js
- Deploy: hosting statis gratis (Cloudflare Pages, Vercel Hobby, atau GitHub Pages)

Jangan menambahkan framework UI, component library, backend, database, atau dependensi baru tanpa kebutuhan yang jelas. Proyek ini sengaja tanpa backend demi biaya nol.

## 4. Key Commands

Jalankan dari root project. Periksa `package.json` terlebih dahulu dan jalankan hanya script yang benar-benar tersedia.

```bash
npm install
npm run dev
```

URL default frontend:

```text
http://localhost:5173
```

Script lain yang mungkin tersedia: `build`, `lint`, `test`. Jangan mengasumsikan semuanya ada, dan jangan mengganti toolchain hanya untuk memenuhi instruksi ini.

## 5. Mandatory Live Preview Workflow

### 5.1 Keep the Development Server Running

- Periksa apakah server frontend sudah berjalan sebelum memulai yang baru.
- Pertahankan server tetap berjalan selama sesi dan manfaatkan Vite HMR.
- Restart hanya jika konfigurasi atau kondisi server memang memerlukannya.
- Periksa pesan error di terminal setelah perubahan.

### 5.2 Required Edit–Preview–Refine Loop

Setelah setiap perubahan UI yang bermakna:

1. Simpan perubahan dan tunggu HMR.
2. Buka atau refresh halaman terkait pada live preview.
3. Amati tampilan dan perilaku yang sebenarnya.
4. Identifikasi layout rusak, elemen tidak konsisten, interaksi gagal, atau hasil proses yang tidak sesuai.
5. Perbaiki, lalu periksa ulang hasilnya.
6. Ulangi sampai acceptance criteria terpenuhi atau ditemukan hambatan yang harus dilaporkan.

Jangan menunggu seluruh pekerjaan selesai untuk pertama kali membuka browser. Jangan menyatakan selesai hanya karena tidak ada error di editor.

### 5.3 What Must Be Inspected

- Kesesuaian dengan panduan di `UI.md` (alur, komponen, warna status, format dimensi dan ukuran file).
- Layout, navigasi, dan konsistensi warna, tipografi, jarak, serta ikon.
- Dropzone: pilih file, drag and drop, tempel, validasi format dan ukuran.
- Progres, tombol batal, dan hasil akhir pada slider sebelum/sesudah.
- Kualitas hasil: bandingkan gambar asli dan hasil secara visual; periksa sambungan tile, artefak, halo di tepi huruf, dan warna.
- Pada preset Dokumen: periksa apakah karakter berubah atau muncul huruf palsu.
- Loading, empty, dan error state.
- Tampilan desktop dan mobile.
- Scroll horizontal, elemen terpotong, dan layout yang bertumpuk.
- Browser console, penggunaan memori, dan error WebGPU/WebGL jika alat tersedia.

### 5.3.1 Pembuktian inspeksi browser (tugas pertama)

- Jangan mengubah kode terlebih dahulu.
- Pastikan frontend berjalan di `http://localhost:5173`.
- Buka halaman menggunakan browser automation tool dan ambil screenshot aktual.
- Periksa screenshot secara visual dan laporkan tiga temuan konkret yang benar-benar terlihat.
- Jangan menganalisis JSX/CSS sebagai pengganti screenshot.
- Jika tidak ada tool untuk membuka browser atau melihat screenshot, katakan dengan jelas bahwa visual inspection belum bisa dilakukan.
- Setelah terbukti, gunakan workflow screenshot → edit → screenshot ulang untuk semua perubahan UI berikutnya.

### 5.4 Never Fake Visual Verification

Jika agent tidak memiliki browser atau alat live preview:

- Jangan mengaku sudah melihat hasil website atau kualitas gambar.
- Lakukan pemeriksaan kode dan tes yang tersedia.
- Laporkan bahwa verifikasi visual belum dilakukan dan berikan URL preview lokal.
- Jangan menganggap screenshot lama sebagai bukti perubahan terbaru sudah benar.

## 6. Avoid Repeated Builds

**Jangan menjalankan production build setiap kali selesai mengedit kode.**

- Gunakan Vite dev server dan HMR.
- Gunakan test atau pemeriksaan terarah, bukan build berulang.

Production build dilakukan pada tahap akhir, saat diminta pengguna, atau ketika masalah hanya bisa diverifikasi lewat build. Build yang gagal harus dianalisis dan diulang setelah diperbaiki.

## 7. Architecture and Coding Rules

### Frontend

- Ikuti pola React yang sudah digunakan; project ini memakai JSX, bukan TypeScript.
- Gunakan komponen yang sudah ada jika sesuai dan hindari duplikasi logika.
- Pisahkan tanggung jawab halaman, komponen, hook, worker, mesin, dan utilitas.
- Jangan mencampur logika pemrosesan dengan komponen UI; letakkan di `engines/`, `workers/`, dan `hooks/useUpscaler.js`.
- Gunakan state loading, empty, dan error yang konsisten.
- Ikuti `UI.md`; perbarui dokumen itu bila tampilan berubah.

### Mesin pemrosesan

- Semua mesin memakai antarmuka yang sama (gambar, skala, opsi, progres, sinyal batal) agar mudah ditukar.
- Jalankan inferensi di Web Worker agar UI tidak membeku.
- Proses gambar per tile dengan padding; jangan memproses gambar besar sekaligus.
- Bebaskan memori: lepaskan tensor, sesi, dan object URL yang tidak dipakai.
- Sediakan pembatalan yang benar-benar menghentikan pemrosesan, bukan hanya menyembunyikan progres.
- Deteksi kemampuan perangkat dan pilih mesin: ONNX WebGPU, lalu ONNX WASM, lalu mesin Cepat, lalu cadangan klasik. Tampilkan mesin yang dipakai di UI.
- Tetapkan batas ukuran input yang aman dan beri pesan jelas jika terlampaui.
- Jangan menyimulasikan hasil. Jika model belum terintegrasi, katakan belum terintegrasi.

### Kejujuran hasil (penting)

- AI menebak detail; jangan menjanjikan "memulihkan detail asli".
- Pada preset Dokumen, tampilkan peringatan bahwa teks kecil, nomor, dan tanda tangan bisa salah ditebak, dan jangan memposisikan hasil sebagai pengganti dokumen asli.
- Jangan menambahkan fitur yang mengubah isi dokumen secara sengaja (misalnya mengisi karakter yang hilang) tanpa pelabelan jelas.

### Pemrosesan gambar

- Hormati orientasi EXIF dan ruang warna dasar saat membaca dan mengekspor.
- Ekspor PNG sebagai lossless, JPG dan WebP dengan kontrol kualitas.
- Jangan mengubah gambar asli pengguna; selalu bekerja pada salinan.

## 8. Hosting dan Model

- Model disajikan dari `public/models` atau CDN. Putuskan satu pendekatan dan catat di bagian 17.
- Periksa lisensi setiap model dan pustaka sebelum dipakai atau dikemas. Model wajah tertentu punya batasan penggunaan komersial.
- Pakai sumber file ONNX yang dapat dipercaya dan catat asal serta versinya.
- Perhatikan batas ukuran file dan bandwidth di hosting gratis yang dipilih.
- Manfaatkan cache browser untuk model agar tidak diunduh berulang.
- Jangan menambahkan layanan berbayar atau yang memerlukan kartu kredit tanpa persetujuan pengguna.

## 9. Privasi

- Gambar pengguna diproses di perangkat dan tidak boleh diunggah ke server mana pun secara default.
- Jangan menambahkan analytics, logging gambar, atau pelacakan yang menyentuh isi gambar.
- Riwayat lokal (bila ada) hanya di IndexedDB dan harus bisa dihapus semua oleh pengguna.
- UI harus menyatakan jelas bahwa gambar diproses di perangkat.
- Jangan commit dokumen atau foto pribadi (piagam, KTP, wajah orang) sebagai fixture. Gunakan gambar sintetis atau yang bebas hak dan bebas data pribadi.

## 10. AI Features (puter.js)

- Puter.js berjalan di sisi klien dan bergantung pada akun Puter pengguna.
- Gunakan hanya untuk fitur yang dipicu pengguna: analisis gambar (tipe, tingkat blur, saran preset dan skala).
- Meminta saran AI berarti gambar dikirim ke layanan pihak ketiga. Minta persetujuan eksplisit sebelum mengirim, dan jelaskan itu di UI.
- Fitur inti harus tetap berfungsi tanpa AI.
- Tandai jelas hasil AI di UI sebagai saran, bukan fakta.
- Tangani kegagalan atau ketidaktersediaan AI dengan fallback yang wajar.
- Verifikasi cara pemanggilan dan batas puter.js di dokumentasi resminya sebelum mengimplementasikan.

## 11. Priority Features

Gunakan `ROADMAP.md` dan permintaan terbaru pengguna untuk menentukan prioritas. Daftar di bawah hanyalah ringkasan; `ROADMAP.md` adalah rujukan utama.

1. Spike: bandingkan Real-ESRGAN ONNX dan UpscalerJS pada gambar uji.
2. Mesin ONNX dengan tile, progres, dan pembatalan di Web Worker.
3. Dropzone, panel pengaturan, dan slider sebelum/sesudah.
4. Unduh PNG/JPG/WebP.
5. Preset Foto, Dokumen, Ilustrasi dan pra/pasca-proses.
6. Mesin Cepat dan cadangan klasik.
7. Saran AI dengan puter.js dan pemeriksa teks.
8. Batch, riwayat lokal, PWA, dan restorasi wajah.
9. Deploy ke hosting gratis.

Jangan mencoba menyelesaikan semua area sekaligus jika pengguna hanya meminta satu fitur. Utamakan satu perubahan yang selesai, teruji, dan terintegrasi daripada banyak perubahan setengah jadi.

## 12. Testing Rules

- Tambahkan atau perbarui tes untuk fungsionalitas baru jika test framework tersedia.
- Pastikan tes deterministik; gunakan gambar fixture kecil di repository, bukan gambar dari internet.
- Uji jalur sukses, validasi input (format salah, file rusak, gambar terlalu besar), pembatalan, dan fallback antar mesin.
- Uji fungsi utilitas murni (hitung tile, format ukuran, hitung dimensi hasil) dengan unit test.
- Jangan menyatakan test lulus jika belum benar-benar dijalankan.
- Jangan mengabaikan kegagalan test yang berkaitan dengan perubahan.

Untuk perubahan alur penting, uji rangkaian: unggah gambar, proses, bandingkan, unduh, lalu cek dimensi dan format file hasil.

## 13. Environment Variables and Git Safety

- Jangan commit `.env`, file kredensial, atau token.
- Periksa `.gitignore` sebelum staging.
- MVP tidak memerlukan secret. Jika suatu fitur nanti memerlukannya, jangan taruh di kode frontend atau variabel `VITE_*` yang tidak dimaksudkan publik.
- Jangan commit file model yang sangat besar tanpa memeriksa batas repository dan hosting.
- Jangan commit, push, force push, atau mengubah repository remote tanpa izin pengguna.

Jika secret sudah terlanjur terpublikasi, beri tahu pengguna untuk mencabut atau merotasinya.

## 14. Boundaries

### Allowed Without Asking

- Membaca file dan memeriksa struktur direktori.
- Menjalankan development server lokal dan memeriksa live preview.
- Mengedit file yang relevan dengan tugas.
- Menjalankan lint dan tes terarah yang tersedia.
- Memperbaiki bug yang muncul akibat perubahan yang sedang dikerjakan.

### Ask First

- Menginstal, menghapus, atau meng-upgrade dependency (termasuk model baru).
- Menghapus file penting atau aset pengguna.
- Menambahkan backend, database, atau layanan eksternal.
- Mengirim gambar pengguna ke layanan mana pun.
- Mengubah konfigurasi produksi atau deployment.
- Commit, push, force push, atau membuka pull request.
- Perubahan arsitektur besar di luar ruang lingkup tugas.
- Memakai model atau pustaka yang lisensinya belum diperiksa.

### Never

- Commit secret, file `.env`, atau dokumen pribadi.
- Mengunggah gambar pengguna ke server tanpa persetujuan eksplisit.
- Memalsukan hasil atau progres.
- Memproses gambar besar tanpa tile hingga membuat tab kehabisan memori.
- Memodifikasi direktori generated output atau dependencies secara manual.
- Mengaku telah menguji browser, kualitas hasil, build, atau tes jika tidak dilakukan.
- Menyatakan teks pada hasil restorasi dokumen pasti akurat.
- Menjalankan production build berulang sebagai pengganti live preview.
- Menandai tugas selesai jika acceptance criteria belum terpenuhi.

## 15. Definition of Done

Sebuah tugas dianggap selesai jika:

- Kebutuhan pengguna telah diterapkan tanpa perubahan tidak relevan.
- Live preview telah diperiksa jika alat browser tersedia.
- Masalah yang ditemukan selama inspeksi telah diperbaiki dan diperiksa ulang.
- Hasil telah dibandingkan secara visual dengan gambar asli jika tugas berkaitan dengan kualitas.
- Tidak ada kebocoran memori atau tab macet pada gambar uji yang relevan.
- Tes dan pemeriksaan yang tersedia telah dijalankan sesuai kebutuhan.
- Tidak ada secret atau data pribadi yang ikut masuk ke perubahan.
- Keterbatasan verifikasi dilaporkan dengan jujur.

## 16. Final Report

Setelah menyelesaikan tugas, berikan ringkasan:

1. **Perubahan:** file dan fitur yang diperbarui.
2. **Live preview:** halaman dan viewport yang benar-benar diperiksa.
3. **Perbaikan iteratif:** masalah yang ditemukan dan cara memperbaikinya.
4. **Validasi:** tes, lint, atau build yang benar-benar dijalankan, plus gambar uji yang dipakai.
5. **Status integrasi:** memakai model nyata atau masih membutuhkan integrasi.
6. **Catatan:** masalah tersisa dan hal yang membutuhkan tindakan pengguna.

Jangan mengklaim semua fitur berjalan hanya berdasarkan tampilan visual.

**Final principle: Implement carefully, inspect the real application, fix what is wrong, verify the result, and report honestly.**

## 17. Catatan implementasi dan keputusan

Dokumen acuan: `README.md`, `ROADMAP.md`, dan `UI.md`. Perbarui dokumen yang relevan setiap kali ada perubahan fitur atau tampilan.

Bagian ini diisi seiring project berjalan. Catat keputusan penting agar tidak perlu ditebak ulang.

- Arsitektur: sepenuhnya di browser, tanpa backend dan database.
- Kandidat mesin kualitas: Real-ESRGAN general x4v3 ONNX melalui ONNX Runtime Web; WASM sudah diuji, WebGPU belum karena browser uji tidak memperoleh GPU adapter.
- Kandidat mesin cepat: UpscalerJS default ESRGAN 2x melalui TensorFlow.js; sudah diuji di browser dengan fixture sintetis.
- Nama aplikasi: `Jernih`; nama repository yang dipilih: `Jernih-app`.
- Model ONNX disajikan lokal dari `public/models`, tetapi berasal dari konversi pihak ketiga; hash, sumber, ukuran, dan lisensi dicatat di `.agent/ROADMAP.md`.
- UpscalerJS `1.0.0` membutuhkan TensorFlow.js `~4.11.0`; gunakan versi kompatibel itu.
- Ukuran tile final menunggu pengukuran memori dan uji seam pada perangkat; hosting belum ditentukan.
