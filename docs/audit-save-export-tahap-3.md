# Audit save, recovery, dan ekspor — tahap 3

Pengujian pada checkout branch sesi, menggunakan Chromium headless dan Vite preview baru port 5175. Browser context terisolasi; IndexedDB dalam context tes, bukan data pengguna. Audit ini tidak mengubah mesin. Prioritas P0: berisiko kehilangan kerjaan/recovery; P1: output salah atau ekspor gagal; P2: operasi berbeda dari yang diminta.

## Temuan terverifikasi

### 1. P0 — Edit pada tab A bisa belum tersimpan jika langsung pindah ke B

**Reproduksi:** Buat A (`A before`), tunggu >1 detik sampai autosave IndexedDB selesai. Edit nama menjadi `A changed just now`, lalu dalam kurang dari satu detik buat/pindah ke B. Tunggu >1 detik. Uji memakai store dan IndexedDB nyata di Chromium.

**Harapan:** perubahan A tetap masuk ke penyimpanan masing-masing dokumen walaupun tab berubah.

**Aktual:** A dalam memori bernama `A changed just now`, tetapi record proyek A masih `A before`; B dan satu-satunya recovery snapshot berisi `B new`. Timer autosave untuk A dibatalkan oleh cleanup saat activeDocument berganti (`src/App.tsx:123–134`); heartbeat hanya mengambil dokumen aktif (`:136–144`), recovery hanya satu ID (`src/core/io/db.ts:269–275`). Jika halaman/browser hilang sebelum A disimpan lagi, perubahan A yang terakhir terancam hilang. Tidak diuji untuk semua metode Save manual atau semua urutan tab.

### 2. P0/P1 — Recovery yang sedang ditawarkan tertimpa oleh dokumen awal

**Reproduksi:** simpan snapshot dirty untuk `lost-doc`, buka halaman aplikasi kedua pada origin/browser context yang sama, lalu biarkan banner recovery tampil tanpa menekan Restore. Pada ~350 ms banner ada dan record recovery adalah `lost-doc, dirty=true`. Tunggu 1,4 detik lagi.

**Harapan:** snapshot ditahan sampai pengguna memutuskan Restore atau Dismiss.

**Aktual:** banner masih menunjukkan dokumen lama, tetapi record IndexedDB berubah menjadi `doc-initial, dirty=true`. Jika halaman/banner kemudian hilang sebelum Restore, snapshot lama tidak lagi tersedia dari slot recovery; proyek yang sudah pernah diautosave mungkin masih dapat dipulihkan secara terpisah. Startup check `src/App.tsx:95–113`, autosave aktif `:123–129`, recovery single-key `src/core/io/db.ts:269–275`.

### 3. P1 — Heartbeat menonaktifkan penanda dirty recovery

**Reproduksi:** buat `recovery-audit`, ubah nama, tunggu debounce autosave lalu tunggu heartbeat sekitar 20 detik. Dibaca melalui IndexedDB browser.

**Aktual:** setelah debounce record `dirty=true`, nama `Unsaved edit`; setelah heartbeat record dokumen/nama sama tetapi `dirty=false`. Startup/Home hanya menawarkan recovery untuk `dirty=true` (`src/App.tsx:100–106`, `src/components/home/HomeDashboard.tsx:82–94`). Record project terpisah pada tes tetap ada dengan nama terbaru, jadi ini membuktikan **banner recovery tidak ditawarkan dalam kondisi tersebut**, bukan bahwa semua data pasti hilang. Heartbeat/beforeunload: `src/App.tsx:136–149`.

### 4. P1 — Urutan layer terbalik antara viewport dan SVG/raster/PDF

**Reproduksi:** dua layer visible, masing-masing rectangle 100×100 di koordinat yang sama: layer index 0 merah, index 1 biru. Buka dokumen dan ekspor.

**Harapan:** warna atas di ekspor sama dengan viewport.

**Aktual:** DOM viewport mengurutkan objek `bottom, top`, sehingga merah di atas; pixel tengah canvas raster `[0,0,255,255]` dan SVG yang dirasterisasi browser juga `[0,0,255,255]` (biru di atas). Content stream PDF mencatat paint merah lalu biru. Viewport membalik urutan layer (`src/components/canvas/StudioCanvas.tsx:3033–3044`); SVG (`src/core/io/svgIo.ts:255–263`), raster (`src/core/io/rasterExport.ts:131–138`), dan PDF (`src/core/io/pdfExport.ts:92–100`) memakai urutan maju. PDF diperiksa melalui urutan operator, bukan rasterisasi PDF viewer.

### 5. P1 — Gambar yang tampil di viewport hilang dari raster/PDF

**Reproduksi:** node image seperti hasil Place dengan data URL PNG merah dan fill putih; render raster, SVG, dan PDF. Pengujian browser memakai gambar PNG merah buatan canvas.

**Aktual:** pixel tengah raster putih `[255,255,255,255]`, sedangkan SVG memiliki `<image>`. PDF tidak memiliki image resource untuk fixture ini dan pada audit sebelumnya content stream sama dengan rectangle putih. Viewport punya cabang image (`src/components/canvas/StudioCanvas.tsx:2256–2271`), renderer raster/PDF berjalan ke path/fill umum (`src/core/io/rasterExport.ts:149–240`, `src/core/io/pdfExport.ts:145–243`). Ini memperkuat temuan tahap 2 dengan fixture gambar valid di browser. Hasil PDF belum diperiksa pixel di viewer.

### 6. P1 — Ekspor PDF gagal untuk karakter di luar WinAnsi

**Reproduksi:** buat node teks `Halo 😀`, panggil `exportDocumentToPdfBytes` dalam browser.

**Harapan:** PDF berhasil menampilkan teks, atau aplikasi memberi penjelasan sebelum ekspor.

**Aktual:** fungsi reject dengan `WinAnsi cannot encode ... (0x1f600)`. `src/core/io/pdfExport.ts:170–180` memakai font built-in Helvetica untuk seluruh teks. Kasus yang dibuktikan adalah emoji; karakter dan font lain perlu diuji. Alur modal memanggil fungsi async, tetapi penanganan error UI tiap jalur belum dibuktikan.

### 7. P1 — Rotasi objek diabaikan oleh PDF

**Reproduksi:** rectangle 80×20 pada (10,20), buat PDF dengan rotation=0 lalu rotation=90, seluruh opsi printer marks dimatikan. Bandingkan content stream halaman.

**Aktual:** stream identik, berisi path dari (10,20) ke (90,40) untuk kedua nilai rotasi. Viewport/raster memakai `node.rotation`, PDF path memakai points tanpa transformasi rotasi (`src/core/io/pdfExport.ts:145–243`). Pengujian satu rectangle, bukan semua jenis objek atau nested group.

### 8. P1 — Gagal render raster bisa berubah menjadi file 1×1 palsu tanpa error

**Reproduksi:** dalam Chromium, injeksikan error pada `canvas.getContext` lalu panggil `exportDocumentToDataUrl(doc, { format: 'jpg' })`.

**Aktual:** fungsi resolve dengan `data:image/jpeg;base64,iVBORw0KGgo...`; prefix bytes base64 tersebut adalah PNG, bukan JPEG, dan gambar fallback hanya 1×1. Error ditelan di `src/core/io/rasterExport.ts:323–333`. Injeksi error hanya membuktikan perilaku saat kegagalan; belum ada pembuktian frekuensi kegagalan sebenarnya. Jalur download memakai hasil tersebut di `src/components/modals/StudioModals.tsx:1369–1377` dan `:1594–1607`.

### 9. P2 — Place `.adloze` membuka dokumen baru, bukan merge

**Reproduksi:** buka target, kirim event `ai-place-file` dengan File `.adloze` valid yang dibuat dari dokumen source. Pada browser target memiliki 5 node sebelum dan sesudah.

**Harapan:** Place memasukkan konten source ke target sesuai fungsi merge yang tersedia.

**Aktual:** activeDocumentId menjadi ID source, source dibuka sebagai dokumen baru, dan target tidak bertambah node. `src/App.tsx:162–183` mengabaikan `mode='place'` untuk `.adloze`. Pengujian mengirim event yang digunakan UI, bukan klik file picker native.

## Prioritas lanjutan

1. Autosave per dokumen dan perlindungan snapshot recovery sampai keputusan pengguna; pengujian tab cepat, restart, quota, dan browser-tab concurrency.
2. Urutan layer dan rendering image yang konsisten untuk semua format, dengan pengujian pixel/failures dan font Unicode PDF.
3. Hapus fallback ekspor palsu dan pastikan error terlihat; uji ukuran canvas, storage diblokir dan format tidak didukung.
4. Audit lanjutan PDF rotation, clipping/group/layer opacity, Place native, dan perbandingan viewport-ekspor lintas format.

Temuan yang diuji tidak berarti semua UI, tools, preset, efek, font, browser, atau skenario kehilangan data telah diaudit. Chromium sempat gagal start sekali; pengujian akhir berhasil setelah memakai server baru tanpa modul HMR ganda. Tidak ada perbaikan source dalam batch audit ini.
