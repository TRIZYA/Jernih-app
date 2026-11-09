# Jernih — AI Image Restorer & Upscaler

Aplikasi web untuk memperjelas gambar blur, beresolusi kecil, atau berartefak
kompresi. Seluruh pemrosesan dirancang berjalan di browser pengguna; gambar
tidak diunggah ke server secara default.

> Status: mesin Fase 2, alur UI Fase 3, saran AI Puter dengan login Puter
> terpisah, dan OCR dokumen sudah diimplementasikan. Login/analisis Puter
> end-to-end serta WebGPU dan performa perangkat fisik masih perlu diuji.

## Menjalankan secara lokal

Prasyarat: Node.js dan pnpm.

```bash
pnpm install
pnpm dev
```

Buka `http://localhost:5173`. Untuk mengulang benchmark Fase 0, buka
`http://localhost:5173/tests/phase0.html`. Halaman itu hanya memakai fixture
sintetis dan model lokal dalam `public/models`.

Unggah gambar JPG, PNG, atau WebP hingga 20 MB. Hasil dibatasi hingga 32
megapiksel; tombol proses dinonaktifkan jika dimensi hasil melampaui batas.
Skala Kualitas 4× memerlukan login Google, sedangkan Cepat 2× dan Kualitas 2×
tetap dapat dipakai tanpa login. Semua inferensi berjalan lokal melalui worker;
browser mencoba Real-ESRGAN WebGPU lalu WASM, atau UpscalerJS untuk mode Cepat,
dan menggunakan resampling + sharpen jika mesin AI tidak tersedia.

Pada hasil, bandingkan gambar asli dan hasil dengan menyeret garis pembanding.
Gunakan tombol zoom untuk memperbesar; ketika zoom aktif, seret area di luar
garis untuk menggeser kedua gambar secara sinkron. Ctrl/⌘ + gulir juga mengubah
zoom. Tombol Reset mengembalikan tampilan, pan, dan posisi slider. Putar dokumen
90° sebelum proses memakai tombol putar di panel pratinjau. Preset Dokumen
menerapkan ketajaman dan kontras ringan; setelah upscale, OCR Puter dapat
mengekstrak teks agar bisa dibaca atau disalin. OCR bukan jaminan akurasi dan
tidak memperbaiki isi piksel gambar.

## Teknologi

- React + Vite (JSX)
- ONNX Runtime Web untuk mesin kualitas
- UpscalerJS + TensorFlow.js untuk mode cepat
- Kandidat model disajikan dari `public/models`; sumber, lisensi, hash, dan hasil benchmark dicatat di [`.agent/ROADMAP.md`](.agent/ROADMAP.md)

## Roadmap

Lihat [`.agent/ROADMAP.md`](.agent/ROADMAP.md) untuk progres, hasil spike, dan prioritas.
Panduan implementasi ada di [`.agent/AGENTS.md`](.agent/AGENTS.md), sementara
spesifikasi UI ada di [`.agent/UI.md`](.agent/UI.md).

## Batasan dan privasi

Model AI dapat menebak detail yang tidak ada pada gambar asli; periksa teks,
nomor, tanda tangan, dan wajah dengan sumber asli. Gambar diproses di perangkat
dan tidak dikirim ke layanan pihak ketiga kecuali fitur tersebut ditambahkan
dengan persetujuan pengguna.

### Saran AI Puter, login, dan OCR

Fitur saran AI dan OCR opsional menggunakan autentikasi akun Puter yang terpisah.
Login Google Firebase tidak membuat atau mewariskan sesi Puter; tekan **Masuk
dengan Puter** di panel Analisis AI dan selesaikan login Puter secara terpisah.
SDK Puter boleh dimuat untuk menyiapkan tombol login, tetapi tidak mengirim
gambar atau membuat sesi tanpa tindakan pengguna. Pengguna harus menyetujui
dialog sebelum gambar dikirim ke Puter. OCR memakai hasil upscale dan dapat
keliru; periksa kembali teks pada sumber asli. Layanan Puter mungkin memiliki
kuota atau biaya akun. Upscale lokal tetap bisa digunakan tanpa login.

Login Google di header menggunakan Firebase Authentication dan diwajibkan oleh
UI untuk memilih proses Kualitas 4×. Ini hanya gerbang UI di aplikasi frontend:
proses gambar tetap lokal dan bukan kontrol akses server yang kuat. Login Google
tidak melindungi fitur Puter atau API lain. Firebase Web API key memang publik;
jangan pernah memasukkan service-account key atau secret server ke variabel
`VITE_*`.

### Deploy ke Vercel

Vercel cocok untuk hosting frontend statis seperti proyek ini. Repository dan
berkas yang dikirim ke browser harus dianggap publik. Sebelum deploy, periksa
isi repository, jangan commit `.env.local`, private key, atau gambar pengguna.
Tambahkan `VITE_FIREBASE_*` sebagai Environment Variables di Vercel hanya jika
menggunakan Firebase, atur Firebase Authorized domains untuk domain Vercel,
lalu uji login Firebase dan Puter secara terpisah, pemrosesan WASM, dan dialog
persetujuan kirim gambar. Pertimbangkan batas ukuran aset:
runtime ONNX/WASM di build sekitar 29.5 MB mentah (sekitar 7.1 MB gzip).
