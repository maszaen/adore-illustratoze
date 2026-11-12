# Audit UI dan mesin — tahap 2

Tanggal: 11 November 2026. Lanjutan dari `audit-temuan-ui-mesin-tahap-1.md`; tidak ada perbaikan mesin/UI pada tahap ini. Prioritas P0 = risiko hilang/rusak data atau recovery; P1 = hasil ekspor, geometri, atau penempatan salah; P2 = gangguan UI. Pengujian dilakukan dengan Vitest sementara dan jsdom, bukan browser nyata; file pengujian sementara dihapus. Pengujian raster memakai canvas mock untuk merekam pemanggilan gambar, bukan membandingkan piksel PNG. PDF diperiksa dengan mengekstrak dan membandingkan content stream melalui pdf-lib, bukan melihatnya di PDF viewer. Percobaan browser tahap sebelumnya gagal karena Chromium SIGSEGV, jadi tidak ada validasi visual baru.

## Terbukti dengan pengujian

### 1. P1 — Gambar raster tidak diekspor sebagai gambar

- **Langkah:** buat dokumen dengan satu node `type: 'image'`, `imageUrl` data URL, rectangle anchors dan fill putih seperti node yang dibuat saat Place (`src/App.tsx:251–290`). Ekspor SVG, raster, dan PDF. Untuk SVG periksa elemen markup; raster periksa pemanggilan context 2D; PDF bandingkan stream dengan node yang sama tetapi bertipe rectangle.
- **Harapan:** file mempertahankan isi gambar yang ditempatkan.
- **Aktual:** SVG tidak memiliki elemen `<image>` dan menghasilkan path putih; raster memanggil `fillRect` satu kali dan `drawImage` nol kali; content stream PDF sama persis dengan output node rectangle. Fixture data URL tidak didekode dalam pengujian ini; bukti adalah jalur export yang sama sekali tidak mengambil/menggambar konten gambar, bukan uji warna piksel.
- **Lokasi:** `src/core/io/svgIo.ts:200–244`, `src/core/io/rasterExport.ts:148–307`, `src/core/io/pdfExport.ts:145–250`; canvas editor sendiri punya cabang image di `src/components/canvas/StudioCanvas.tsx:2273–2285`.
- **Dampak:** gambar yang terlihat di editor menjadi bidang putih atau hilang pada output, bergantung properti fill. Ini meningkatkan status dugaan tahap 1 menjadi terbukti pada level fungsi/stream.

### 2. P1 — Layer tersembunyi bocor ke PDF, raster, dan thumbnail

- **Langkah:** dokumen berisi satu rectangle merah visible pada layer hidden; semua layer hidden; export PDF/raster dan buat thumbnail.
- **Harapan:** rectangle tidak muncul.
- **Aktual:** raster mock mencatat satu `fillRect`; content stream PDF berbeda dari dokumen kosong dan memuat operasi gambar rectangle; string SVG thumbnail memuat `#ff0000`. Pengujian tahap 1 sudah membuktikan kasus sama pada SVG export.
- **Lokasi:** fallback root nodes `src/core/io/rasterExport.ts:130–145`, `src/core/io/pdfExport.ts:92–108`, `src/core/io/db.ts:82–93`.
- **Batasan:** kasus yang diuji adalah ketika tidak ada root node di visible layer; belum membuktikan semua kombinasi layer. Dampak termasuk bocornya konten yang sengaja disembunyikan.

### 3. P0 — Copy/paste grup antar dokumen menghasilkan grup tanpa anak valid

- **Langkah:** pada dokumen A buat group dari dua node lalu Copy; buka dokumen B kosong dan Paste.
- **Harapan:** grup beserta kedua anak disalin ke B dengan referensi ID baru.
- **Aktual:** node grup hasil paste masih punya `children` berisi ID anak A, tetapi kedua ID itu tidak ada pada B. Grup tidak memiliki artwork anak yang dapat ditemukan dalam dokumen target.
- **Lokasi:** `src/state/useStudioStore.ts:1463–1470`, `:1479–1510`. Clipboard hanya menyalin node terpilih, bukan subtree, dan paste tidak memetakan anak.
- **Dampak:** artwork dapat tampak hilang saat memindahkan grup antar dokumen. Ini berbeda dari duplikasi grup dalam dokumen yang sudah dilaporkan di tahap 1.

### 4. P1 — Paste on All Artboards memakai koordinat global sebagai koordinat lokal

- **Langkah:** dua artboard pada x=0 dan x=220, objek pada x=240 di artboard kedua, pilih artboard kedua, copy, lalu `pasteClipboard('all-artboards')`.
- **Harapan:** posisi relatif 20 pada tiap artboard, yaitu salinan x=20 dan x=240.
- **Aktual:** salinan x=240 dan x=460. `src/state/useStudioStore.ts:1485–1505` menambah posisi artboard tujuan ke koordinat global sumber tanpa mengurangi origin artboard sumber.
- **Dampak:** salinan bergeser ke artboard salah atau ke luar artboard. Pengujian dilakukan pada store; belum mengeklik item menu secara end-to-end.

### 5. P1 — Input geometri Pathfinder mengabaikan rotasi

- **Langkah:** panggil `nodeToPolygon` pada node fixture yang sama dengan rotation=0 dan rotation=90.
- **Harapan:** polygon untuk objek yang tidak simetris ikut berotasi sesuai tampilan.
- **Aktual:** dua array titik identik. `src/core/math/pathfinder.ts:24–72` membentuk polygon dari points tanpa menerapkan `node.rotation`; operasi memakai hasil ini pada `:412`.
- **Dampak:** boolean bisa menghitung bentuk berbeda dari yang terlihat. Pengujian membuktikan konversi input, belum mengukur bentuk output untuk setiap operasi.

### 6. P1 — Merge .adloze menampilkan isi hidden layer dan meratakan struktur layer

- **Langkah:** buat source sample dengan layer pertama hidden lalu panggil `mergeAdlozeIntoDocument` pada target kosong dengan layer aktif visible.
- **Harapan:** struktur dan visibility layer source dipertahankan, sesuai kontrak fungsi; setidaknya konten hidden tidak otomatis terlihat.
- **Aktual:** empat root node dari hidden layer source dimasukkan ke layer aktif target yang visible, bersama root dari layer source lain. `src/core/io/adlozeIo.ts:194–226` memindahkan semua node ke satu targetLayer tanpa mempertahankan layer source.
- **Dampak:** konten tersembunyi muncul, pemisahan layer hilang pada dokumen gabungan. Fungsi diuji langsung; alur Place end-to-end belum diuji.

### 7. P2 — Menutup tab lain menghapus seleksi pada tab aktif

- **Langkah:** render `TopMenuBar` di jsdom dengan A aktif, objek A terseleksi dan B juga terbuka; klik tombol Close pada B dan terima konfirmasi.
- **Harapan:** A tetap aktif dan seleksi A tetap utuh.
- **Aktual:** A tetap aktif, tetapi `selectedIds` menjadi `[]`; `selectedAnchorIds` yang dipasang sebagai fixture justru tetap ada. `src/components/workspace/TopMenuBar.tsx:1259–1267` memanggil `closeDocument`; `src/state/useStudioStore.ts:606–624` selalu mengosongkan seleksi node tetapi tidak membersihkan seleksi anchor.
- **Dampak:** konteks editing A hilang meskipun menutup B; anchor stale adalah inkonsistensi state yang terlihat pada fixture, belum diuji dampaknya di canvas.

### 8. P0/P1 — Kegagalan penyimpanan recovery ditelan tanpa sinyal pemanggil

- **Langkah:** mock `studioDb.recovery.put` agar menolak dengan error quota lalu panggil `saveCrashRecoverySnapshot(doc, true)`.
- **Harapan:** pemanggil dapat mendeteksi kegagalan dan memperingatkan pengguna atau mengambil tindakan lain.
- **Aktual:** promise resolve, bukan reject; catch kosong di `src/core/io/db.ts:260–270`.
- **Dampak:** recovery snapshot bisa tidak tersimpan tanpa indikasi melalui fungsi ini. Ini uji injeksi kegagalan, bukan simulasi storage quota nyata atau crash browser; penyimpanan project terpisah juga perlu diuji.

## Risiko dari inspeksi — belum diuji end-to-end

- **P0/P1 recovery:** debounce menyimpan snapshot `dirty=true`, tetapi heartbeat tiap 20 detik dan beforeunload menulis snapshot yang sama dengan `dirty=false` (`src/App.tsx:123–150`); pemeriksaan awal hanya menampilkan recovery jika `dirty` (`:95–107`). Karena itu crash setelah heartbeat berpotensi tidak memunculkan banner. Belum disimulasikan dengan IndexedDB dan restart; project autosave terpisah mungkin masih menyediakan data.
- **P2 UI:** floating-to-floating, tear satu tab floating, dan persistensi toolbar palette masih terbatas menurut audit tahap 1. Belum ada uji browser baru untuk memastikan gerak, layout/resolusi, atau tema.

## Cakupan dan verifikasi

Audit tahap ini menguji fungsi/store untuk ekspor, copy/paste, polygon, merge, recovery, dan satu interaksi tab lewat React/jsdom. Tidak menyimpulkan semua alat, preset workspace, panel, tampilan, format file, maupun recovery sudah diaudit. `npm test`: 27/27 tes repository lulus; ini tidak meniadakan temuan di atas karena tes regresi reproduksi hanya sementara. `git diff --check` lulus untuk tracked changes. Lanjutan prioritas: uji browser dengan environment yang sehat, recovery dan autosave dengan IndexedDB nyata, seluruh variasi Pathfinder/transform, nested groups, impor/ekspor gambar dengan viewer dan pixel comparison, serta matriks semua panel, tools, workspace, tema dan resolusi.
