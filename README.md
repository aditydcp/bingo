# IDSurvey FIRST Summit '26 — Bingo App

## Cara Menjalankan

### 1. Install dependencies & jalankan sekaligus
```bash
chmod +x start.sh
./start.sh
```

### 2. Atau jalankan manual (dua terminal)

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev   # or: node server.js
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## URL

| Halaman | URL |
|---|---|
| User Bingo | http://localhost:3000 |
| Master Panel | http://localhost:3000/master |
| Admin Dashboard | http://localhost:3000/admin |
| Backend API | http://localhost:3001 |

## Fitur

- Registrasi nama + entitas (dropdown: ID Survey, Sucofindo, Surveyor Indonesia, BKI)
- Data tersimpan di localStorage — saat buka ulang langsung masuk ke board
- Bingo 5×5 dengan header F-I-R-S-T
- Setiap sel bisa diisi foto (tap/klik untuk upload kamera/galeri)
- Foto menggantikan tampilan sel, dengan tanda centang
- Deteksi bingo otomatis (baris, kolom, diagonal)
- Tombol **FINISH** muncul saat bingo, menyimpan timestamp selesai
- Preview foto saat tap sel yang sudah diisi
- **Master Panel** (`/master`): edit label semua sel, simpan ke server
- **Admin Dashboard** (`/admin`):
  - Statistik total peserta, yang dapat bingo, yang sudah finish
  - Tabel semua peserta + mini bingo board + progress bar
  - Ranking pemenang dengan waktu finish
  - Klik "Lihat" untuk melihat bingo board lengkap beserta foto tiap sel
  - Auto-refresh setiap 30 detik

## Data Storage

Data tersimpan di `backend/data/`:
- `users.json` — data peserta
- `states.json` — status bingo tiap peserta
- `master.json` — konfigurasi label sel
- `completions.json` — data peserta yang menyelesaikan bingo

Foto tersimpan di `backend/uploads/`.
