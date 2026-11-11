# Audit UI/UX mendalam & rencana revisi workspace

**Untuk:** pemilik produk, UX researcher, UI designer, frontend/QA
**Tanggal:** 11 November 2026 · **Status:** draft untuk review
**Basis:** inspeksi statis komponen dan state pada branch saat ini, basis commit `0bb315e`. Ini memperluas `ui-ux-audit-research-plan.md`, bukan hasil tes dengan pengguna.

## 0. Klarifikasi cakupan

Feedback bahwa audit awal belum cukup sangat valid. Dokumen ini memetakan **seluruh keluarga permukaan UI dalam repo** dan menambahkan backlog konkret, terutama posisi/drag, duplikasi dan tab. Namun repo memiliki sekitar 25 ribu baris komponen; **pemetaan keluarga UI bukan berarti setiap kontrol, setiap kombinasi state dan setiap bug visual sudah terverifikasi**. Tidak ada tes visual interaktif, screen reader, validasi ekspor atau studi pengguna yang dilakukan pada putaran ini. Bukti kode berikut adalah temuan statis; hasil visual/gesture disebut sebagai langkah reproduksi, bukan hasil yang telah diamati. Rencana bagian 7–9 menutup gap tersebut secara sistematis.

**Penilaian umum:** desain sekarang bukan sekadar membutuhkan polesan; arsitektur presentasinya punya beberapa sumber kebenaran untuk tab/panel, layout yang sebagian saja dapat dipindahkan, dan affordance yang tidak cocok dengan perilakunya. Solusi tidak cukup dengan menambahkan warna atau mengganti ikon. Perbaikan tertentu membutuhkan wiring/state UI dan pengujian IO; perubahan engine vektor bukan sasaran audit ini.

**Label:** `K` = terbaca langsung pada kode; `U` = perlu uji runtime untuk memastikan dampak; `R` = perlu validasi pengguna. Prioritas P0 = risiko kehilangan kerja; P1 = alur utama rusak/terhalang; P2 = friksi besar; P3 = penyempurnaan. Prioritas bukan jumlah pengguna yang terdampak.

## 1. Peta cakupan seluruh UI

| Area | File utama yang dipetakan | Masalah/risiko yang harus dicek | Status |
|---|---|---|---|
| Shell & breakpoint | `App.tsx`, `illustrator-theme.css` | viewport terkunci, ruang canvas, hierarki, overflow | K/U |
| Header/menu & dokumen | `TopMenuBar.tsx` | tabs, nama, close, banyak tab, menu, mode layar | K/U |
| Context bar | `ControlBar.tsx`, `NumericScrubInput.tsx`, `ColorSwatchButton.tsx` | kontrol berubah sesuai seleksi, overflow, angka dan warna | K/U |
| Toolbar & flyout | `LeftToolbar.tsx`, `toolRegistry.ts`, `IllustratorIcons.tsx`, `FillStrokeProxy.tsx` | tata letak, sub-tool, drag, akses, overflow | K/U |
| Dock & workspace | `DockManager.tsx`, `PanelRegistry.tsx` | floating, docking, reset, layout, duplikasi tab, preset | K/U |
| Canvas & navigasi | `StudioCanvas.tsx`, `RulersAndGuides.tsx`, `GradientAnnotator.tsx`, `PerspectiveGridOverlay.tsx`, `BottomStatusBar.tsx` | discoverability, gesture, feedback, zoom dan overlay | K/U |
| Panel objek & warna | `LayersPanel.tsx`, `AppearancePanel.tsx`, `ColorSwatchesGradientPanel.tsx`, `StrokeBrushesSymbolsPanel.tsx` | nested tabs, density, empty/selected states, action labels | K/U |
| Panel susun/teks/utilitas | `PathfinderAlignPanel.tsx`, `TypographyPanel.tsx`, `ArtboardsAssetHistoryInfoPanel.tsx` | nested tabs, Properties/Info, kontrol, hierarchy | K/U |
| Dialog | `StudioModals.tsx` | 19 jenis modal; fokus, sizing, validasi, preview dan cancel | K/U |
| Dashboard | `HomeDashboard.tsx` | first-run, proyek, pencarian, impor, delete, recovery | K/U |
| Global | `translations.ts`, `useKeyboardShortcuts.ts`, tema CSS | konsistensi bahasa, shortcut, theme, aksesibilitas | K/U |

Tidak mengklaim semua issue dari area-area ini sudah ditemukan. Gunakan coverage matrix dan checklist di bawah untuk menyelesaikan audit interaktif.

## 2. Temuan spesifik — workspace, drag, urutan dan duplikasi

### W01 — Drag panel bukan sistem docking penuh
**P1 · K; pengalaman aktual U.** `DockManager.tsx`: `handleTabPointerDown` merobek tab jadi floating setelah jarak >48px; `handleDragFloatingWindow` memindahkan jendela floating. Tombol dock memanggil `dockFloatingWindowBack(..., 'rightOuter')`, yang memasukkan tab ke grup pertama di kolom kanan luar. Tidak terlihat logika drop target untuk reorder tab, memindah tab antargrup/kolom dengan drag, menyusun ulang grup, atau dock ke kiri/bawah. Tipe layout punya `leftColumn`/`bottomRow`, tetapi pada jalur render utama yang diperiksa hanya right inner/outer yang ditampilkan. Artinya **sebagian panel memang bisa di-float dan digeser**, tetapi bukan workspace yang bebas dikustomisasi.

**Repro yang harus QA jalankan:** buka dua panel; coba drag satu tab di dalam grup, antargrup, ke tepi kiri/bawah dan kembali ke grup asal. Catat preview/drop indicator, posisi akhir dan apakah pengguna menganggapnya berhasil. **Revisi:** model layout dengan target eksplisit: reorder dalam grup; pindah antargrup; float; dock kiri/kanan (bawah jika dipilih sebagai requirement); preview posisi, cancel Escape, batas layar dan fallback non-drag. Jangan menjanjikan semua arah sebelum disepakati. **AC:** setiap operasi hasilnya sesuai drop indicator, panel tidak hilang/duplikat, dan ada alternatif via menu/keyboard.

### W02 — Toolbar utama tampak punya grip tetapi tidak dapat digeser
**P1 · K.** `LeftToolbar.tsx` menampilkan garis titik pada header toolbar sebagai elemen visual tanpa handler drag; toolbar adalah `aside` statis. Tombol hanya mengubah satu/dua kolom. Tear-off tersedia untuk grup tertentu dan floating palette dapat digeser, bukan toolbar utama atau susunan tool. **Repro:** drag grip, pindah urutan tool, tear-off grup dan bandingkan ekspektasi. **Revisi:** pilih produk: toolbar dapat di-dock kiri/kanan/float dan diatur urutannya, atau hilangkan grip menyesatkan; karena permintaan owner menekankan kustomisasi, usulkan kemampuan tersebut sebagai target. Tambah reset dan akses non-drag. Bedakan palette grup yang sudah bisa di-float dari toolbar utama.

### W03 — Duplikasi tab panel dan identitas panel tidak sinkron
**P1 · K.** `PanelRegistry.tsx` merender satu komponen multitabs untuk beberapa ID, sementara `DockManager.tsx` juga menampilkan setiap ID sebagai tab luar. Misalnya grup luar `color/swatches/gradient` memuat `ColorSwatchesGradientPanel` yang di dalamnya punya tab Color/Color Guide/Swatches/Gradient sendiri. Hal yang sama ada pada Appearance/Graphic Styles, Pathfinder/Align/Transform, Stroke/Brushes/Symbols, Character/Paragraph/OpenType dan utilitas. Klik tab dalam mengubah `activeTab` lokal, bukan tab luar. Akibat yang perlu dikonfirmasi secara visual: label tab luar bisa menunjukkan Color sedangkan isi menunjukkan Gradient, serta tab yang sama tampak dua kali.

**Repro:** di workspace Classic buka Color, klik Gradient di baris dalam, bandingkan tab luar/isi; ulangi Transform dan History; float salah satunya. **Revisi:** satu sumber kebenaran identitas panel; idealnya konten panel individual tanpa tab internal, sedangkan grouping/tab jadi tanggung jawab dock. Jika multitabs dipertahankan, tab luar dan dalam harus tersinkron dan tidak menduplikasi navigasi. **AC:** satu panel ID = satu konten/label aktif; membuka panel dari Window mengaktifkan panel yang sama; tidak ada dua tab navigasi identik.

### W04 — Properties sebenarnya diarahkan ke tampilan Info
**P1 · K.** `PanelRegistry.tsx` memetakan `properties` ke `ArtboardsAssetHistoryInfoPanel initialTab="properties"`; komponen itu memperlakukan `properties` dan `info` sebagai blok konten yang sama dan menyorot tab internal Info. Ini bukan panel Properties kontekstual terpisah pada kode yang ditinjau. **Repro:** pilih objek dan buka Properties; cek label luar, tab dalam, dan apakah bisa mengubah atribut yang diharapkan. **Revisi:** definisikan Properties sebagai ringkasan + kontrol kontekstual untuk dokumen/tanpa seleksi, satu objek dan multi-seleksi; Info tetap informatif. Hindari memalsukan kapabilitas; kontrol yang belum tersedia harus jelas. **AC:** label dan isi cocok di semua state.

### W05 — Preset Typography punya active tab yang tidak ada di grup
**P1 · K.** `createPresetLayout('typography')` membuat `grp-typo-outer-1` dengan `tabs: ['properties','appearance','graphic-styles']`, tetapi `activeTab: 'character'`; Character ada di grup lain. `renderTabGroupCard` merender `renderPanel(grp.activeTab)` tanpa memvalidasi membership. **Repro:** pilih Typography; cek konten grup atas, tab aktif dan duplikasi Character. **Revisi:** set active tab yang termasuk grup; validasi invariant untuk semua preset dan operasi. **AC:** setiap grup nonkosong punya tepat satu activeTab dalam `tabs`.

### W06 — Reset workspace tidak mereset layout dock yang dipakai
**P1 · K.** `TopMenuBar.tsx` pada reset memanggil `store.resetWorkspace()` bila tersedia; fungsi itu memang ada di `useStudioStore.ts`, tetapi hanya mengubah `hideAllPanels`, `openPanels` dan status. `DockManager` menyimpan layout pada state lokal dan hanya mendengar event `ai-workspace-preset`; event reset ada pada cabang fallback yang tidak dipakai bila fungsi store tersedia. **Repro:** float panel, ubah lebar/collapse, pilih Reset Workspace; bandingkan dengan preset awal. **Revisi:** satu aksi reset mengembalikan layout, posisi, lebar dan status toolbar sesuai preset; konfirmasi bila menghapus layout kustom. **AC:** reset dapat diulang dan hasilnya identik dengan default preset aktif.

### W07 — Kustomisasi tidak dipersist sebagai layout
**P2 · K pada jalur ditinjau.** Dock layout, lebar dan floating ada pada `useState` lokal di `DockManager`; `LeftToolbar` juga menyimpan state palette lokal. Tidak ditemukan persist layout di `src/state`/`src/components`. `saveCustomWorkspace` di store menyimpan nama pada array, bukan snapshot layout. **Repro:** susun panel, refresh, navigasi Home/kembali, ganti preset lalu kembali. **Revisi:** penyimpanan versi layout per workspace dengan validasi migrasi, fallback ketika viewport berubah, Save/Reset yang jelas; pengguna bisa menghapus presetnya. **AC:** perubahan yang dijanjikan sebagai tersimpan bertahan refresh dan panel tetap terlihat pada resolusi berbeda.

### W08 — Floating panel terbatas
**P2 · K/U.** Floating panel default 280×360 (`DockManager.tsx`), bisa digeser via title bar tetapi tidak tampak resize handle, drag-to-dock, pemilihan grup target, atau urutan fokus/z-index per window; semua menggunakan z-index sama. Posisi dibatasi sebagian, tetapi setelah resize viewport tidak terlihat mekanisme reposition. **Repro:** float 2 panel, tumpuk, klik panel belakang, ubah ukuran browser dan coba resize panel. **Revisi:** resize dengan minimum masuk akal, bring-to-front, clamp setelah viewport berubah, dock target dan tombol keyboard, serta visual handle. **AC:** header dapat dijangkau dan setiap window dapat difokuskan/ditutup/didock kembali.

### W09 — Daftar panel dan metadata punya banyak sumber
**P2 · K.** `TopMenuBar.tsx` mendefinisikan `STUDIO_PANEL_LIST`, `DockManager.tsx` punya `PANEL_METADATA`, dan `PanelRegistry.tsx` punya `STUDIO_PANEL_REGISTRY`. Cakupan dan penamaan berbeda: registry punya misalnya `paragraph`, `opentype`, `color-guide`, `info`, `magic-wand` yang tidak semuanya muncul sebagai entry terpisah pada daftar Window; fallback dock menggunakan ID. **Repro:** bandingkan menu Window, shortcut dan judul tab, termasuk bahasa Indonesia. **Revisi:** registry metadata tunggal, bedakan panel mandiri dari tool setting, uji semua entry bisa dibuka dan judulnya konsisten. **AC:** tidak ada panel yatim, ID mentah, atau shortcut/label yang saling bertentangan.

### W10 — Beberapa preset bernama berbeda berbagi layout yang sama
**P2 · K.** `layout-print`, `web`, dan `essentials-classic` jatuh ke cabang default yang sama dalam `createPresetLayout`. Nama berbeda membangun ekspektasi susunan berbeda. **Repro:** pilih masing-masing dan bandingkan urutan/ketersediaan panel. **Revisi:** buat preset sesuai pekerjaan setelah riset, atau gabungkan label sampai benar-benar berbeda. **AC:** perbedaan preset yang ditawarkan jelas dan dapat dijelaskan; tidak menghilangkan kustomisasi tanpa peringatan.

### W11 — Duplikasi perintah vs duplikasi yang memang berguna
**P2 · K/R.** Fill/stroke muncul di toolbar (`FillStrokeProxy`), control bar dan panel warna; transform/align muncul di control bar dan panel, menu juga membuka panel/aksi. Akses berulang **belum tentu bug**: control bar kontekstual bisa mempercepat expert. Yang jelas bermasalah adalah tab ganda/tidak sinkron W03, bukan otomatis setiap shortcut UI. `TOOL_GROUPS` adalah sumber tool utama; belum ada bukti ID tool literal duplikat yang diverifikasi pada audit ini. **Revisi:** inventaris setiap aksi (ID, label, lokasi, prasyarat, state, hasil), tandai primary/contextual/discovery; satukan yang menyesatkan, pastikan kontrol yang sama sinkron. **AC:** setiap duplikasi punya alasan dan menunjukkan state yang sama; tool yang berbeda tetapi ikon mirip punya label jelas.

## 3. Tab atas, menu dan shell

### T01 — Tombol × tab dokumen memanggil metode yang tidak tersedia
**P1 · K pada kode; U untuk hasil runtime.** `TopMenuBar.tsx` memanggil `store.closeDocumentTab` hanya jika fungsi itu ada; `useStudioStore.ts` mendefinisikan `closeDocument`, dan pencarian repo tidak menemukan definisi `closeDocumentTab`. Maka handler × pada jalur ini tidak memanggil `closeDocument`. Tombol × hanya dirender jika lebih dari satu dokumen. **Repro:** buat dua dokumen, klik × pada keduanya; cek apakah dokumen benar tertutup dan yang aktif tetap sesuai. **Revisi:** hubungkan ke aksi yang benar, definisikan perilaku tab terakhir, aktif/nonaktif, dan perlindungan perubahan belum tersimpan. **AC:** close tepat dokumen yang dimaksud, tidak kehilangan perubahan tanpa pilihan yang jelas, keyboard accessible.

### T02 — Ekstensi ganda, status tab global dan tidak ada dirty indicator
**P1 · K.** Render nama di `TopMenuBar.tsx` menambahkan `.adloze` ke `d.name`, sementara `createDefaultDocument` dan New Document sudah menyimpan nama dengan ekstensi. Jadi default berpotensi tampil `Untitled-1.adloze.adloze`. Semua tab menampilkan `store.zoom` dan `viewMode` aktif yang sama, bukan data masing-masing dokumen. Tidak tampak indikator perubahan belum disimpan di label tab. **Repro:** buka dua nama panjang, zoom salah satu dan bandingkan tab; simpan/ubah. **Revisi:** normalisasi tampilan nama tanpa menambah ekstensi dua kali; jangan menampilkan zoom/view per tab bila bukan milik tab tersebut; tampilkan status save berdasarkan state yang benar. **AC:** nama akurat, status tidak menyesatkan dan dapat diakses.

### T03 — Tab dokumen bukan tab interaktif yang lengkap
**P2 · K/U.** Tab berupa `div` dengan `onClick`, tidak ada `role=tab`, `tabIndex`, keyboard switching, reorder atau konteks menu pada implementasi tersebut. CSS membatasi lebar 240px dan membuat bar scroll horizontal, tetapi teks tanpa aturan ellipsis khusus; keterlihatan nama panjang/close dan tab aktif perlu diuji. **Revisi:** semantik tablist + navigasi keyboard, truncation dengan full name tersedia, scroll-to-active dan overflow menu; reorder bila menjadi requirement. **AC:** 1, 2, 10+ dokumen, nama identik/panjang, keyboard dan zoom tidak membuat tab/close tak terjangkau.

### T04 — Menu dan bagian header bersaing untuk ruang
**P2 · K/U.** Header menampilkan menu, bahasa, tema dan workspace; `ai-controlbar` dan `ai-doctabs-bar` memiliki overflow horizontal. Ikon/tombol banyak berukuran sekitar 18–21px. Perilaku 1366×768, 200% zoom dan menu yang membuka dekat tepi belum dibuktikan. **Revisi:** tetapkan minimum canvas, collapse/overflow yang terindikasi, prioritas kontrol dan keyboard menu. **AC:** tidak ada kontrol penting tertutup atau hilang tanpa alternatif; menu tidak keluar viewport.

## 4. Temuan per area lain

### Toolbar dan kontrol
- **U01 P1:** sub-tool pada `LeftToolbar.tsx` dibuka lewat segitiga kecil, klik kanan atau tahan 320ms; informasi ada di `title`, tidak tampak tombol buka sub-tool lewat keyboard pada grup tersebut. Beri indikator, akses eksplisit/keyboard, uji pengguna pemula dan expert.
- **U02 P2:** toolbar memiliki `TOOL_GROUPS` panjang dengan grid satu/dua kolom; `ai-left-toolbar` tidak mendefinisikan scroll. Root membatasi overflow (`App.tsx`), jadi pada tinggi kecil/kolom tunggal tool bawah berisiko terpotong; verifikasi di viewport. Buat scroll/overflow yang terlihat, tanpa menutupi fill/stroke atau mode.
- **U03 P2:** control bar memilih konteks dari tool dan primary node (`ControlBar.tsx`); perilaku beberapa objek dengan nilai berbeda perlu audit. Jangan tampilkan nilai objek pertama sebagai nilai bersama tanpa tanda “mixed”; uji empty, single, multi dan locked. Pastikan aksi disabled menjelaskan prasyarat.
- **U04 P2:** `NumericScrubInput.tsx`, `AngleDial.tsx`, `ColorSwatchButton.tsx`, `FillStrokeProxy.tsx` perlu checklist input ketik, unit, arrow, drag, invalid, undo, fokus dan akses label; drag tidak boleh jadi satu-satunya cara.

### Canvas, status dan overlay
- **C01 P1:** canvas utama SVG memakai pointer handlers (`StudioCanvas.tsx`); alternatif keyboard untuk seleksi, menggambar, transformasi dan memindahkan guide belum terbukti. `RulersAndGuides.tsx` mendeskripsikan membuat/menghapus guide dengan drag. Buat target dukungan yang realistis dengan jalur non-drag untuk tugas utama, lalu uji dengan peserta yang menggunakan teknologi bantu.
- **C02 P2:** status dan error banyak bergantung pada footer tinggi 22px, font 10.5px (`BottomStatusBar.tsx`). Untuk aksi penting, tampilkan feedback dekat konteks dan live region; keberhasilan tidak boleh tertukar dengan pesan sebelumnya. Periksa pesan panjang, durasi dan multiple documents.
- **C03 P2:** zoom, ruler, guides, selection handles, gradient annotator, perspective grid dan banner mode harus diuji terhadap clipping, overlap, pointer hit area, kontras dan kemungkinan keluar mode. Mode pattern punya Done/Cancel (`StudioCanvas.tsx`); pastikan setiap mode punya jalan keluar terlihat dan konsekuensi jelas.
- **C04 P2:** 64000% tersedia pada selector zoom. Validasi batas yang masuk akal, keterbacaan pan dan fit-to-artboard setelah membuka dokumen/resize; jangan menganggap nilai ekstrem pasti bug tanpa pengujian.

### Panels
- **P01 P1:** `LayersPanel.tsx` memakai banyak kontrol ikon/kolom termasuk visibility, lock, target, selection dan reorder atas/bawah. Audit hierarki layer/sublayer, state terseleksi/tersembunyi/terkunci, label aksesibel, rename, drag/reorder yang benar-benar tersedia, delete dan empty state. Jangan menyimpulkan layer drag sudah/belum berfungsi tanpa uji. Perjelas perbedaan target appearance dan selection.
- **P02 P2:** panel Appearance/Graphic Styles, Color/Guide/Swatches/Gradient, Stroke/Brushes/Symbols, Pathfinder/Align/Transform, Character/Paragraph/OpenType dan utility punya tab internal; selesaikan W03 sebelum merapikan isi agar tidak mendesain navigasi dua kali. Uji setiap panel pada tidak ada seleksi, satu objek, multi objek dan objek yang tidak didukung.
- **P03 P2:** warna hardcoded gelap di beberapa panel (misalnya `bg-[#323232]` di `ColorSwatchesGradientPanel.tsx` dan `ArtboardsAssetHistoryInfoPanel.tsx`) sedangkan shell mendukung empat tema CSS. Uji tema terang: kemungkinan panel tetap gelap/tidak konsisten. Gunakan semantic tokens, lalu ukur kontras di semua tema, bukan sekadar membalik warna.
- **P04 P2:** `ArtboardsAssetHistoryInfoPanel.tsx` menampilkan Y menggunakan `primaryNode?.height ? primaryNode.y : store.cursorY`; jika tinggi nol, nilai Y berpotensi menunjuk cursor, bukan node. Verifikasi dengan objek tinggi nol. Tampilkan data objek secara konsisten dan gunakan label/units yang jelas.
- **P05 P2:** panel `history`, `asset-export`, `image-trace`, `magic-wand`, transparency dan info berada di komponen utilitas bersama; audit apakah state, prasyarat, feedback dan konsekuensi aksi benar dan jelas. Jangan menyatakan hasil ekspor/trace akurat tanpa tes output.

### Dialog
- **M01 P1:** `StudioModals.tsx` menggunakan backdrop `div` dan dialog berbasis `div`, tanpa role/`aria-modal` terlihat pada file. Audit fokus awal, trap, Escape, return focus, accessible name dan screen reader untuk seluruh jenis dialog; close icon perlu label. Pastikan shortcut editor tidak memicu aksi di belakang modal.
- **M02 P1/P2:** modal box `maxHeight: 90vh` dan `overflow: hidden`, beberapa modal punya width 780/760/720px; sebagian bagian internal scroll, tetapi tidak semua konten terbukti dapat discroll atau muat di viewport kecil/zoom. Uji 1366×768, 1024×768, zoom 200%, scroll keyboard dan long text; pastikan header/footer dan primary action tetap terjangkau.
- **M03 P2:** 19 modal yang harus diuji: new-document, recolor-artwork, export-screens, image-trace, blend-options, envelope-warp, envelope-mesh, offset-path, simplify-path, split-into-grid, transform-each, pattern-maker, preferences, save-for-web, shape-dialog, graph-data, keyboard-shortcuts, export-svg, export-pdf. Untuk masing-masing cek judul, default, label/unit, validasi, preview, cancel/close, error, feedback dan akses keyboard. Ini daftar coverage, bukan klaim masing-masing rusak.
- **M04 P2:** warna modal banyak hardcoded gelap (`modalBoxStyle`/header), berbeda dari theme shell. Uji semua tema, dan gunakan token bila desain memang mengharapkan konsistensi.

### Home, file dan kepercayaan
- **H01 P0:** snapshot autosave ditulis dirty lalu heartbeat menulis false; recovery hanya menawarkan snapshot dirty. Storage error diabaikan pada beberapa jalur (`App.tsx`, `HomeDashboard.tsx`). Reproduksi sebelum klaim kehilangan data. Detail eksperimen dan mitigasi ada di audit awal F01.
- **H02 P0:** `handleDeleteProject` langsung menghapus tanpa konfirmasi yang terlihat (`HomeDashboard.tsx`); uji grid/list dan ketersediaan recovery. Tambah konfirmasi bernama atau undo yang benar-benar memulihkan.
- **H03 P1:** impor dari dashboard menulis error hanya ke console. Workspace memakai status message; buat error dapat terlihat, spesifik dan actionable. Dashboard menerima `.adloze,.svg`; workspace juga menerima raster. Jelaskan perbedaan dan tes masing-masing.
- **H04 P2:** default `showHomeScreen: false`; home menawarkan preset dan proyek tetapi pengguna pertama mungkin tidak menemukannya. Riset sebelum mengganti default. Audit empty/search/no results/recovery/loading/blocked storage, grid/list, rename, duplicate dan delete.

### Bahasa, akses, desain visual
- **G01 P1:** ikon-only, focus state, `title`, form label, modal/tab/menu, focus order, target pointer, screen reader, kontras dan keyboard perlu audit terukur. Tidak semua ikon tanpa `aria-label` otomatis tak bernama: periksa accessible name komputasi.
- **G02 P2:** campuran ID/EN, hardcoded copy dan label shortcut berbeda di beberapa registry; inventaris semua strings, format, simbol dan pesan error. Pilihan bahasa harus konsisten lintas home, workspace, dialog, tooltip dan status.
- **G03 P2:** banyak font 10–11px dan target 18–28px; ukur terhadap target aksesibilitas yang dipilih dan uji zoom/spacing, jangan hanya memperbesar semuanya hingga canvas hilang. Tentukan density compact/comfortable dengan user testing.

## 5. Rancangan target informasi dan interaksi

**Prinsip:** satu panel = satu identitas; satu area bertanggung jawab untuk grouping; ada opsi pengaturan tanpa kehilangan orientasi; advanced UI tetap cepat; setiap fitur yang tampak tersedia punya feedback dan perilaku konsisten.

1. **Shell:** menu aplikasi → tab dokumen → control bar kontekstual → toolbar + canvas + dock → status. Tetapkan prioritas lebar minimum canvas dan overflow yang bisa ditemukan.
2. **Toolbar:** tool disusun menurut selection, draw, type, paint, transform, navigation. Grup punya indikator sub-tool, menu eksplisit, shortcut serta penjelasan. Customization mode terpisah dari mode kerja untuk reorder, hide/show, reset; drag toolbar/dock sesuai keputusan produk. Gunakan satu identitas tool, bukan duplikasi permanen.
3. **Dock:** grup panel memiliki satu tab bar, satu active panel dan konten tanpa bar tab ganda. Drag preview menunjukkan reorder/group/float/dock. Menu panel menyediakan Move to…, Float, Dock, Close, Reset untuk non-drag. Perubahan layout disimpan per workspace hanya bila memang dijanjikan.
4. **Properties:** panel kontekstual berdasarkan selection; Info hanya menampilkan informasi. Control bar = tindakan cepat kontekstual, panel = pengaturan detail. Aksi yang ada di lebih dari satu lokasi harus memakai state dan semantics sama.
5. **Dokumen:** nama bersih, active state, status save tepercaya, close/keyboard/overflow yang konsisten. Warn/choice untuk perubahan berisiko hilang; jangan klaim dirty indicator sampai semantics save ditetapkan.
6. **Dialogs:** judul, deskripsi, field/error, preview (jika ada), cancel dan primary action konsisten; fokus dan ukuran adaptif; theme tokens.
7. **Status:** info ringan di status bar, error penting di konteks dan tetap tersedia, keberhasilan singkat dan aksesibel. Bedakan autosave lokal vs file ekspor.

## 6. Backlog implementasi yang siap dipecah

| Urutan | Paket | Issue | Output & acceptance ringkas | Dependency |
|---|---|---|---|---|
| 0 | Lindungi karya | H01–H03, T01 | verifikasi recovery/storage; error terlihat; delete aman; close benar + warning bila diperlukan | definisi saved/dirty; QA fixture |
| 1 | Benahi integritas panel | W03–W06 | registry tunggal; satu tab bar; setiap group active valid; Properties sesuai nama; reset benar | inventaris panel dan desain IA |
| 2 | Dock yang dapat diatur | W01, W07–W08 | reorder/move/float/dock dengan target, fallback keyboard, save/reset layout, clamp viewport | model layout versi + desain drag |
| 3 | Toolbar | W02, U01–U02, W11 | toolbar dapat dipindah/dikustom sesuai scope, grup mudah dibuka, overflow dan reset | keputusan lokasi, inventory tool |
| 4 | Tabs/header | T02–T04 | nama benar, status akurat, close, keyboard, overflow; banyak dokumen diuji | paket 0 untuk state save |
| 5 | Canvas & panels | U03–04, C01–04, P01–05 | state seleksi jelas; feedback kontekstual; alternatif drag; panel tidak tumpang tindih | paket 1 + target akses |
| 6 | Dialog/home/theme | M01–04, H04, G01–03 | seluruh dialog adaptif/accessible; ID/EN dan tema konsisten; first-run diuji | design tokens + copy |
| 7 | Regression & evaluasi | semua | matrix manual/otomatis, user testing, known issues & sign-off | build stabil |

Ini rencana UI/frontend, bukan instruksi mengubah algoritma editor. Integrasi close/save, persist dan event tetap memerlukan perubahan state/IO agar UI tidak berpura-pura berfungsi. Jangan menutup issue hanya karena visual berubah.

## 7. Checklist audit interaktif lengkap — untuk QA/researcher

Gunakan satu spreadsheet: `area | komponen | state/prasyarat | langkah | expected | actual | screenshot/video | severity | browser/viewport | build | owner | status`. Buat dokumen dummy, kosongkan storage saat first-run dan jangan gunakan karya berharga.

**Setiap area:** default/empty/loading/error; hover/focus/active/disabled; pointer/keyboard; teks panjang; tema gelap/terang; ID/EN; 100%/200% zoom; viewport 1366×768 dan 1920×1080, tambah 1024×768 bila didukung; semua browser target. Catat pengukuran dan batas dukungan, bukan hanya checklist centang.

- **Header/menu:** setiap menu & submenu, tepi viewport, click-outside/Escape, disabled, shortcut, screen mode, bahasa, tema, workspace/reset.
- **Dokumen:** 1/2/10+ tab; nama panjang/sama/ekstensi; aktif/nonaktif; close terakhir, close dirty, switch, keyboard, reorder/overflow; apakah zoom/state akurat.
- **Toolbar:** seluruh grup di `TOOL_GROUPS`: tool default dan setiap sub-tool, ikon/label/shortcut, klik/hold/right-click, tear-off, reorder/move, 1/2 kolom, scroll, reset, zoom & viewport kecil. Periksa duplikasi ID vs duplikasi lokasi fungsi.
- **Dock:** semua panel dari registry/menu/shortcut; tab luar/dalam; tear-off, drag, drop, reorder, group, collapse, resize, dock kembali, close/reopen, multi floating z-order, reset, refresh, Home kembali, perubahan viewport, setiap preset.
- **Control bar/primitives:** tanpa seleksi, single/multi mixed, locked, tiap jenis objek/tool; field/unit/invalid/range, scrub, undo, keyboard, tooltip dan scroll horizontal.
- **Canvas:** buat, seleksi/multi, move, transform, direct selection, undo/redo, fit/zoom/pan, artboard, grid/guides/rulers, gradient/perspective, modes dan exit; mouse/trackpad/keyboard; cek overlay di setiap tepi.
- **Semua panel:** uji daftar 24 ID dari `STUDIO_PANEL_REGISTRY`; cek judul dan isi, prasyarat, state, seluruh tombol penting, empty/error, scroll, zoom dan theme. Uji Layers dengan nested/hidden/locked; Appearance/fill/stroke; warna/swatches/gradient; penataan/teks; utilities dan output ekspor.
- **Semua 19 modal:** matriks M03, termasuk Cancel setelah edit, click backdrop, Escape, error/validasi, resize/zoom, focus trap/return dan apakah aksi tertarget benar.
- **Home/files:** new/preset/template/open/place/drag-drop, proyek grid/list, search/sort/rename/duplicate/delete, corrupt/unsupported file, storage blocked/full, refresh dan recovery. Cek output SVG/PDF/raster di aplikasi lain dengan fixture; bukan hanya unduh sukses.
- **Accessibility:** automated scan + keyboard-only, screen reader, contrast, target size, non-drag alternatives, reduced motion bila ada dan 200% zoom; catat mana yang belum didukung secara eksplisit.

## 8. Rencana riset dan validasi desain

Setelah bug kritis dapat direproduksi, ikuti protokol di `ui-ux-audit-research-plan.md`: pilot + 8 sesi formatif (4 pengguna rutin editor vektor, 4 pemula/alternatif), ditambah 2–3 sesi aksesibilitas; gunakan data dummy dan consent. Tambahkan tugas berikut **tanpa menyebut lokasi kontrol**:

1. “Atur ruang kerja agar panel warna berada dekat area gambar dan panel layer di sisi lain; kembalikan seperti semula.” Catat discoverability, lokasi drop, perbedaan harapan/hasil, reset dan kemampuan menyelesaikan tanpa instruksi.
2. “Susun alat yang sering dipakai agar mudah dijangkau.” Catat asumsi grip, kemampuan menemukan customization, upaya drag dan hambatan keyboard.
3. “Buka dua karya, pindah antar-keduanya dan tutup hanya karya pertama.” Catat nama, state aktif, konsekuensi close dan kemampuan menemukan tab lain.
4. “Buka pengaturan gradient, lalu kembali ke color.” Catat apakah tab luar/dalam menimbulkan kebingungan dan mismatch label.
5. “Ubah ukuran satu objek melalui Properties.” Amati apakah panel memenuhi ekspektasi; jangan mengajari bahwa kontennya Info.

Gunakan completion mandiri/terbantu/gagal, error, waktu per tugas yang berhasil, confidence dan kutipan; laporkan n/N, bukan generalisasi populasi. Uji prototype alternatif satu tab bar dan docking sebelum implementasi besar; ulangi tugas pada build baru dengan peserta berbeda. Aksesibilitas divalidasi oleh pengguna relevan dan audit teknis, bukan satu menggantikan yang lain.

## 9. Definisi selesai dan pertanyaan review

**Definition of done:** setiap P0/P1 direproduksi atau ditutup dengan alasan dan bukti; seluruh daftar area/19 modal/24 panel punya status diuji atau secara eksplisit out of scope; tidak ada navigasi tab ganda yang tidak sinkron; semua operasi layout yang dijanjikan punya indikator, alternatif non-drag, reset dan tes persist; tab dokumen benar pada multi-doc; tidak ada data loss/error tersembunyi pada skenario kritis yang disepakati; tema/bahasa dan aksesibilitas diuji; hasil riset dan risiko sisa disetujui owner.

**Butuh keputusan owner:** (1) apakah toolbar dan panel harus bebas dock di semua sisi atau hanya kiri/kanan + floating? (2) Apakah tab dokumen juga perlu reorder/tear-off? (3) layout kustom disimpan otomatis atau manual per preset? (4) seberapa dekat dengan workflow Illustrator vs identitas produk sendiri? (5) platform/browser/viewport minimum dan fitur wajib rilis? (6) bagaimana saved/dirty/backup didefinisikan? Jawaban menentukan detail spesifikasi, bukan alasan menunda reproduksi bug P0/P1.
