# Audit UI/UX & rencana riset — Adore Illustratoze

**Status:** draft untuk review pemilik produk dan UX researcher
**Tanggal:** 11 November 2026
**Basis:** inspeksi statis kode pada commit dasar `0bb315e` di branch kerja. Belum ada sesi pengguna, pengukuran analytics, audit screen reader, atau pengujian browser/device dalam audit ini. Severity dan dampak adalah perkiraan awal, bukan hasil riset. Tidak ada perubahan produk yang dilakukan.

## 1. Ringkasan untuk pengambil keputusan

Adore Illustratoze adalah editor vektor dengan workspace menyerupai Illustrator: canvas, toolbar berkelompok, control bar, panel, menu, shortcut, pengelolaan dokumen lokal, impor dan ekspor. Fondasi untuk workflow pengguna berpengalaman sudah terlihat: banyak shortcut, panel kontekstual, beberapa dokumen, preset, dan fitur recovery.

**Prioritas awal:** (1) kepercayaan atas penyimpanan dan recovery, (2) pencegahan penghapusan tak sengaja dan penanganan error, (3) aksesibilitas interaksi utama, (4) discoverability untuk pengguna baru, tanpa mengorbankan kecepatan expert. Tiga pertama perlu diverifikasi secara teknis segera; riset pengguna menentukan bentuk solusi dan urutan masalah discoverability.

**Keputusan yang perlu disepakati sebelum riset:** siapa pengguna utama (profesional migrasi vs pemula), desktop/browser yang didukung, apakah penyimpanan lokal adalah janji produk, dan workflow paling penting untuk rilis pertama. Jangan menganggap kesamaan antarmuka dengan Illustrator otomatis membuat aplikasi mudah digunakan.

## 2. Ruang lingkup dan cara baca

Audit menelusuri kode `src/App.tsx`, dashboard, toolbar, status bar, modal, canvas, store, shortcut, style, dan sebagian menu serta test. Ini **review heuristik berbasis implementasi**, bukan verifikasi visual menyeluruh atau klaim bahwa masalah pasti dialami pengguna. Bukti di bawah menunjuk perilaku yang tampak di kode; konsekuensi terhadap pengguna adalah hipotesis. Temuan tidak mencakup seluruh fitur atau akurasi hasil ilustrasi/ekspor.

Prioritas: **P0** = potensi kehilangan data/akses kritis, verifikasi segera; **P1** = menghambat tugas utama atau akses; **P2** = friksi penting; **P3** = penyempurnaan. Keyakinan **tinggi** berarti pola kode terlihat langsung, bukan dampaknya telah terbukti.

## 3. Peta pengalaman saat ini

| Tahap | Yang tersedia dalam kode | Pertanyaan riset |
|---|---|---|
| Masuk | Default `showHomeScreen: false`, workspace langsung terbuka; dashboard tersedia lewat tombol Home. | Apakah pengguna paham cara memulai dan menemukan proyek? |
| Buat/buka | New Document, preset/template di dashboard, impor `.adloze`/SVG; drag-drop dan input workspace juga menerima gambar raster. | Apakah perbedaan Open dan Place, format dan tujuan impor jelas? |
| Buat/edit | Toolbar berbasis ikon dan grup, canvas SVG, kontrol kontekstual, panel dan shortcut. | Bisakah pengguna menemukan tool, memahami seleksi, dan memperbaiki kesalahan? |
| Simpan/pulihkan | IndexedDB, snapshot, ekspor arsip `.adloze`, dashboard proyek dan recovery. | Apakah pengguna tahu mana tersimpan lokal, mana file yang dapat dipindah, dan apa yang bisa dipulihkan? |
| Ekspor/lanjut | Menu menyediakan ekspor SVG/PDF dan Export for Screens; proyek dapat dibuka lagi. | Apakah output sesuai tujuan dan pengguna yakin pekerjaan selesai? |

## 4. Temuan prioritas

### F01 — Status penyimpanan dan recovery berpotensi menyesatkan
**P0 · keyakinan tinggi pada pola kode; risiko aktual perlu reproduksi.** `src/App.tsx`, efek autosave: snapshot dibuat `dirty=true` setelah perubahan, tetapi heartbeat 20 detik dan `beforeunload` menulis `dirty=false`; dashboard hanya menampilkan recovery jika `dirty` (`src/components/home/HomeDashboard.tsx`, `refreshData`). Kegagalan IndexedDB di beberapa jalur diabaikan dengan `catch`. Ada potensi snapshot terbaru tidak ditawarkan setelah crash, dan pengguna tidak tahu jika penyimpanan gagal. `beforeunload` juga memulai operasi async sehingga tidak boleh diasumsikan pasti selesai. IndexedDB sendiri bukan cadangan lintas perangkat dan bisa dihapus browser.

**Verifikasi:** edit dokumen, tunggu >20 detik, hentikan tab secara tidak normal, buka kembali; ulangi segera setelah edit, dengan storage ditolak/penuh, dan beberapa dokumen. Catat isi snapshot dan versi yang dipulihkan; jangan gunakan karya asli. **Arah solusi:** definisikan arti dirty/saved dan lifecycle snapshot, tampilkan status penyimpanan lokal/error serta pilihan unduh backup; uji integritas dan urutan penyimpanan. Jangan janjikan pemulihan sampai terbukti. **Owner:** engineering; UX untuk bahasa status dan recovery.

### F02 — Hapus proyek tanpa konfirmasi yang terlihat
**P0 · tinggi.** `HomeDashboard.tsx`, `handleDeleteProject` memanggil `deleteProjectFromDb` langsung; tombol Delete memanggil handler tersebut. Tidak terlihat konfirmasi atau undo pada jalur ini. Risiko salah klik pada proyek lokal. **Verifikasi:** hapus proyek dummy di grid/list dan cek apakah ada pemulihan di luar handler. **Arah:** konfirmasi dengan nama proyek atau undo yang benar-benar memulihkan data, jelaskan dampak; uji keyboard dan error. **Owner:** engineering + design.

### F03 — Error buka file di dashboard tidak diberitahukan ke pengguna
**P1 · tinggi.** `HomeDashboard.tsx`, `handleFileImport` menangkap error dan hanya `console.error`; pengguna bisa tidak tahu kenapa file tidak terbuka. Workspace `src/App.tsx` menaruh pesan gagal di status bar yang kecil. **Verifikasi:** file `.adloze` rusak dan SVG tidak valid, bandingkan kedua entry point. **Arah:** pesan terlihat dengan nama file, alasan aman bila diketahui, langkah coba lagi/format didukung; jangan mengekspos detail teknis mentah.

### F04 — Dialog perlu audit aksesibilitas dan manajemen fokus
**P1 · tinggi pada markup yang diperiksa, cakupan dialog perlu diuji.** `StudioModals.tsx` memakai backdrop `div` dan dialog New Document `div`; pada file tidak terlihat `role="dialog"`, `aria-modal` atau label dialog. Backdrop klik menutup modal; belum terbukti ada focus trap, fokus awal/kembali, dan Escape yang konsisten. Tombol close berupa ikon juga perlu nama aksesibel. **Verifikasi:** Tab/Shift+Tab, Escape, fokus kembali, nama dan role dengan screen reader untuk New Document dan Export; periksa seluruh dialog. **Arah:** pola dialog aksesibel dengan nama, fokus awal/terperangkap/kembali, Escape bila aman, dan konfirmasi perubahan yang akan hilang.

### F05 — Sub-tool tersembunyi di belakang interaksi pointer
**P1 · tinggi pada mekanisme; dampak perlu riset.** `LeftToolbar.tsx` membuka grup melalui segitiga kecil, klik kanan atau tahan 320 ms; informasi gesture ada di `title`; klik biasa memilih tool saat ini. Pengguna keyboard tidak tampak memiliki aksi eksplisit untuk membuka grup pada tombol tersebut. **Verifikasi:** temukan ellipse/sub-tool tanpa instruksi dengan mouse, trackpad, keyboard; cek apakah flyout tertutup saat lepas pointer. **Arah:** indikator grup dan kontrol buka yang eksplisit, label aksesibel, keyboard navigation dan tooltip yang dapat diakses tanpa hover; pertahankan shortcut expert.

### F06 — Kepadatan dan keterbacaan workspace
**P2 · tinggi pada ukuran kode, dampak visual belum diuji.** `illustrator-theme.css` banyak memakai font 10–11px; `BottomStatusBar.tsx` tinggi 22px dan font 10.5px; toolbar dan panel memakai banyak ikon. Risiko keterbacaan, target klik kecil dan beban kognitif, terutama pada layar kecil/zoom. **Verifikasi:** desktop 1366×768 dan 1920×1080, browser zoom 200%, empat tema, pengukuran kontras dan target; amati tanpa mengasumsikan semua gagal WCAG. **Arah:** skala UI/teks, focus indicator dan penataan responsif, dengan mode padat opsional untuk expert.

### F07 — Titik awal dan onboarding perlu divalidasi
**P2 · tinggi pada default, hipotesis pada dampak.** `useStudioStore.ts` menginisialisasi `showHomeScreen: false`, walaupun dashboard punya New, Open, preset, dan proyek. Pengguna baru langsung menghadapi workspace. **Verifikasi:** first-run dengan storage bersih: apa yang pengguna kira harus dilakukan, apakah menemukan Home dan membuat dokumen? **Arah:** uji welcome/empty state ringan dan shortcut ke New/Open; jangan wajibkan tutorial untuk expert.

### F08 — Ketidakkonsistenan bahasa dan format masuk
**P2 · tinggi.** Default bahasa `en` (`useStudioStore.ts`); dashboard menerjemahkan sebagian label dengan `language === 'id'`, tetapi beberapa teks recovery dan aksi tetap Inggris (`HomeDashboard.tsx`). Input dashboard membatasi `.adloze,.svg`, sedangkan input workspace juga menerima raster (`App.tsx`). Perbedaan bisa punya alasan, tetapi perlu dijelaskan. **Verifikasi:** jalankan seluruh journey ID/EN, impor dari kedua lokasi dan dokumentasikan hasil sebenarnya. **Arah:** audit string terpusat, konsistenkan istilah dan jelaskan format serta perbedaan Open/Place; jangan menyamakan perilaku tanpa memutuskan model dokumen.

### F09 — Reliance pada gesture canvas dan panel
**P1 · sedang.** Canvas SVG menggunakan banyak handler pointer (`StudioCanvas.tsx`); dock menggunakan pointer untuk drag/resize (`DockManager.tsx`). Ada katalog shortcut (`useKeyboardShortcuts.ts`), tetapi belum terbukti semua tugas utama dapat diakses keyboard atau melalui alternatif non-drag. **Verifikasi:** seleksi, pindah, ubah ukuran, atur panel dengan keyboard dan teknologi bantu; pisahkan keterbatasan aplikasi dari kebutuhan operasi gambar presisi. **Arah:** alternatif keyboard untuk operasi inti, kontrol numerik dan opsi susun ulang panel tanpa drag, dengan target dukungan yang disepakati.

### F10 — Umpan balik dan pengujian journey belum jelas
**P2 · sedang.** Banyak tindakan menghasilkan `statusMessage` di store dan ditampilkan pada status bar (`BottomStatusBar.tsx`), bukan selalu di dekat aksi; belum terlihat apakah feedback terbaca teknologi bantu. Test yang diperiksa (`src/__tests__/studio.test.ts`) berfokus pada math, store dan IO; tidak membuktikan usability end-to-end. **Verifikasi:** uji konfirmasi simpan, undo, impor dan ekspor serta baca test suite lengkap. **Arah:** feedback proporsional dan persisten untuk error penting, live region yang sesuai, serta test journey dan aksesibilitas.

## 5. Hipotesis dan pertanyaan riset

| ID | Hipotesis yang bisa dibantah | Sinyal dukungan / pembantah |
|---|---|---|
| H1 | Pengguna baru kesulitan memulai saat langsung masuk workspace. | Tersesat atau meminta bantuan vs langsung membuat dokumen dengan yakin. |
| H2 | Pengguna tidak menemukan sub-tool tanpa petunjuk. | Tidak menemukan ellipse sendiri vs menemukan via grup/shortcut dengan lancar. |
| H3 | Pengguna menyamakan autosave lokal dengan backup file. | Menyatakan aman di perangkat lain vs menjelaskan batas storage lokal dengan tepat. |
| H4 | Pengguna sulit membedakan Open, Place, Save dan Export. | Memilih jalur salah atau output tidak sesuai vs dapat menjelaskan perbedaan dan menyelesaikan tugas. |
| H5 | Kepadatan workspace membantu expert tetapi menghambat pemula. | Perbandingan pola kendala, waktu dan preferensi antarsegmen; jangan bandingkan waktu tanpa konteks keahlian. |

## 6. Rencana studi untuk UX researcher

### Tujuan dan desain

Riset formatif moderasi 60–75 menit, desktop/laptop menggunakan mouse atau trackpad, rekam layar dan audio **hanya dengan persetujuan**. Gunakan build dan data dummy yang sama, storage bersih untuk first-run; dokumentasikan commit, browser/OS, resolusi, zoom, metode input dan kondisi storage. Pilot 1 sesi dulu; revisi instrumen yang membingungkan dan tandai hasil pilot bila protokol berubah. Moderator tidak mengajari produk saat tugas berjalan; catat bantuan dan waktu pemberiannya.

**Sampel awal yang diusulkan: 8 peserta**, 4 pengguna rutin editor vektor profesional dan 4 pemula/berpengalaman dengan tool desain lain tetapi bukan pengguna rutin editor vektor. Rekrut berdasarkan perilaku nyata, bukan jabatan; usahakan variasi OS, bahasa ID/EN dan kebutuhan aksesibilitas. Ini studi eksploratif, bukan sampel representatif atau angka prevalensi. Tambahkan 2–3 sesi aksesibilitas terpisah dengan pengguna keyboard/screen reader dan kompensasi setara; libatkan ahli aksesibilitas untuk audit teknis. Screening: frekuensi, tool, proyek terbaru, perangkat, preferensi bahasa dan kebutuhan akomodasi; hindari orang yang terlibat membuat produk. Tentukan insentif, persetujuan dan jadwal dengan pemilik produk.

### Alur sesi

1. **5–10 menit:** perkenalan, consent, konteks kerja dan terakhir kali membuat ilustrasi; tegaskan yang diuji produk, bukan peserta.
2. **5 menit:** first impression, tanpa memberi tahu letak fitur. “Apa yang Anda harapkan bisa dilakukan di sini?”
3. **35–45 menit:** tugas di bawah; think-aloud ringan, jangan menyebut nama kontrol yang dicari. Counterbalance urutan tugas edit bila memungkinkan; tugas save/reopen tetap setelah membuat karya.
4. **10 menit:** pertanyaan kepercayaan simpan, prioritas, bandingkan kebiasaan tool lain; minta rating kemudahan per tugas 1–5 sebagai sinyal, bukan ukuran kepuasan populasi.
5. **5 menit:** debrief, hapus data dummy sesuai kebijakan dan jelaskan langkah berikutnya.

### Tugas dan kriteria observasi

| Tugas (prompt netral) | Sukses observasional | Data yang dicatat / probe setelah selesai |
|---|---|---|
| Mulai karya baru untuk gambar 1200 × 800 px. | Dokumen dengan dimensi benar terbuka, tanpa bantuan. | Jalur, percobaan, waktu; “Apa yang Anda harapkan saat pertama membuka aplikasi?” |
| Buat gambar sederhana dengan persegi panjang dan lingkaran, beri warna berbeda. | Kedua bentuk terlihat dan warna berbeda. | Temuan sub-tool, seleksi, kontrol warna, kesalahan dan bantuan. |
| Pindahkan salah satu bentuk, lalu batalkan langkah terakhir. | Bentuk berpindah dan undo memulihkan posisi. | Cara mengenali seleksi dan hasil undo. |
| Simpan agar bisa melanjutkan nanti, tutup lalu buka lagi. | Peserta berhasil membuka kembali karya dummy; catat apakah lokal atau file. | “Di mana karya tersimpan? Apa yang terjadi di perangkat lain?” Jangan simulasi crash pada data pribadi. |
| Buka SVG contoh, lalu siapkan hasil untuk dibagikan sebagai SVG. | File ekspor ada dan dapat dibuka untuk pemeriksaan dasar. | Pilihan Open/Place/Export, ekspektasi dan masalah; evaluasi fidelity terpisah. |
| Temukan dan hapus proyek dummy yang salah. | Proyek yang dimaksud terhapus; peserta memahami konsekuensi. | Ekspektasi konfirmasi/undo. Jangan meminta penghapusan file pribadi. |

Untuk setiap tugas: mulai/akhir, sukses mandiri / sukses dengan bantuan / gagal / tidak dicoba, waktu, langkah salah, kutipan dengan persetujuan, tingkat keyakinan peserta dan tingkat keparahan observasi. Ukur waktu hanya untuk tugas yang selesai dan tampilkan bersama jumlah bantuan; jangan anggap waktu singkat berarti pemahaman benar. Gunakan prompt lanjutan netral: “Apa yang Anda harapkan terjadi?” dan “Apa yang Anda lihat sekarang?”

### Validasi teknis paralel

- Reproduksi F01–F03 dengan fixture aman, termasuk reload, crash, storage blocked/full dan file rusak; catat langkah, expected/actual, video/log dan build. Verifikasi juga perilaku multi-tab dan multi-dokumen.
- Audit keyboard, fokus, screen reader, label, kontras, zoom/reflow dan alternatif drag terhadap WCAG 2.2 AA yang relevan; desktop support/pengecualian perlu diputuskan. Catat hasil pengukuran, bukan hanya checklist.
- Uji Chrome, Firefox, Safari/OS yang disepakati; resolusi 1366×768, 1920×1080, zoom 100%/200%, dan setiap tema. Mobile/tablet hanya jika termasuk target produk.
- Uji format `.adloze`, SVG, raster serta hasil ekspor/reopen pada fixture kecil dan kompleks. Tandai perbedaan dari ekspektasi, termasuk error dan fidelity.

## 7. Sintesis, prioritas dan metrik

Setelah tiap 2–3 sesi, tim melakukan debrief tanpa mengubah skenario secara sembarangan. Kelompokkan observasi berdasarkan tugas dan penyebab, simpan bukti per peserta anonim, pisahkan bug teknis dari kendala pemahaman. Laporkan frekuensi **n/N dalam sampel**, konteks, kutipan, kasus berlawanan dan tingkat keyakinan; jangan menyimpulkan prevalensi pasar dari 8 orang. Triangulasikan dengan reproduksi teknis; jika hasil berbeda, investigasi sebelum memilih solusi.

Prioritaskan dengan dampak × frekuensi teramati × risiko × cakupan tugas, serta usaha/ketergantungan. Risiko kehilangan data dan hambatan akses diberi jalur cepat walau frekuensi sampel rendah. Usulan target berikut **bukan baseline**; tetapkan target akhir setelah pilot dan kesepakatan produk:

| Ukuran | Definisi | Target awal untuk validasi berikutnya |
|---|---|---|
| Penyelesaian tugas mandiri | Peserta mencapai kriteria tanpa bantuan / peserta yang mencoba. | ≥6/8 pada setiap tugas inti, tetap laporkan per segmen. |
| Pemahaman penyimpanan | Peserta menjelaskan lokasi lokal dan batas lintas perangkat setelah tugas, tanpa prompt jawaban. | ≥6/8; perbaiki copy bila belum. |
| Recovery | Dalam matriks crash yang disepakati, dokumen dummy terakhir yang berhasil disimpan dapat dipulihkan tanpa korupsi. | Semua skenario kritis lulus; catat batas interval kehilangan data. |
| Error & hapus | Error storage/impor terlihat dan bisa ditindaklanjuti; hapus dummy dikonfirmasi atau dapat di-undo. | Semua skenario kritis lulus. |
| Aksesibilitas | Audit manual + otomatis terhadap journey yang disepakati. | Tidak ada temuan blocker/critical terbuka pada journey tersebut. |

Angka studi kecil hanya gate pembelajaran, bukan signifikansi statistik. Jika instrumen/versi berbeda, jangan bandingkan mentah antar putaran. Analytics opsional setelah persetujuan: event agregat task funnel seperti create/open/export success/failure, tanpa nama file, isi dokumen atau artwork; privacy review, consent yang sesuai, retensi dan opt-out harus ditentukan dulu.

## 8. Roadmap usulan dan acceptance criteria

| Tahap | Aktivitas & output | Exit / acceptance |
|---|---|---|
| 0. Alignment & safety (2–3 hari kerja) | Sepakati pengguna dan platform; reproduksi F01–F03; daftar bug dengan fixture. | Owner menyetujui scope, risiko data punya keputusan mitigasi dan langkah reproduksi. |
| 1. Baseline research (1–2 minggu) | Rekrut, pilot, 8 sesi, audit aksesibilitas/teknis paralel; laporan temuan. | Bukti per tugas, n/N, severity, ketidakpastian dan keputusan prioritas direview bersama researcher. |
| 2. Desain & prototipe (1 minggu) | Rancang status save/recovery, delete/error, dialog dan discoverability; bandingkan alternatif sederhana dengan expert/pemula. | Prototype diuji cepat pada 4–5 peserta baru/berbeda; task kritis dan akses keyboard diuji; keputusan terdokumentasi. |
| 3. Implementasi (estimasi 2–4 minggu, bergantung scope) | Perbaikan P0/P1 lebih dulu; test unit/integrasi dan end-to-end untuk journey; konsistensi bahasa. | Recovery dan error memenuhi matriks; penghapusan aman; fokus modal, nama kontrol dan alternatif keyboard lulus tes yang disepakati. |
| 4. Evaluasi & rilis | Uji ulang tugas inti dengan peserta baru, regresi lintas browser, review output ekspor dan accessibility. | Target tabel di atas ditinjau, tidak ada blocker kritis; risiko tersisa dan rencana tindak lanjut disetujui. |

Durasi adalah perkiraan kerja, bukan janji; beberapa aktivitas paralel. Owner produk memutuskan scope dan prioritas; researcher memimpin desain studi/sintesis; designer membuat dan menguji solusi; engineering mereproduksi dan mengimplementasikan; QA/accessibility specialist memverifikasi regresi. Tidak ada solusi visual yang harus langsung dibangun sebelum temuan divalidasi, kecuali mitigasi risiko data yang telah direproduksi.

## 9. Etika, privasi, dan handoff

Gunakan proyek dummy; jangan kumpulkan karya sensitif. Siapkan informed consent untuk rekaman, tujuan, akses, masa simpan dan hak menarik diri; tetapkan penyimpanan terbatas, pemisahan identitas dari catatan, retensi dan penghapusan sebelum rekrutmen. Jangan mengirim file peserta ke layanan eksternal tanpa izin. Beri kompensasi dan akomodasi aksesibilitas, termasuk alternatif apabila peserta tidak mau direkam.

**Handoff yang diharapkan dari researcher:** protokol final dan screener; log sesi anonim; matriks tugas dan temuan dengan bukti/counterexample; daftar isu yang direproduksi; rekomendasi dan tingkat keyakinan; serta keputusan prioritas bersama owner. Sertakan semua perubahan protokol dan keterbatasan, bukan hanya highlight reel.

## 10. Pertanyaan untuk review pemilik produk

1. Siapa pengguna pertama yang ingin dimenangkan, dan apa pekerjaan utama yang harus selesai di produk ini?
2. Platform, browser, bahasa dan kebutuhan aksesibilitas apa yang wajib untuk rilis?
3. Apakah penyimpanan lokal saja memang positioning produk? Apa toleransi kehilangan perubahan dan ekspektasi backup?
4. Fitur dan format mana yang merupakan janji rilis, dan mana yang masih eksperimental?
5. Apakah ada akses ke pengguna nyata, anggaran insentif, deadline dan data riset sebelumnya?
6. Apakah target awal dan prioritas P0/P1 disetujui, atau ada constraint teknis/bisnis yang perlu dicatat?

---
**Audit lanjutan:** untuk pemetaan seluruh keluarga UI dan backlog detail tentang drag/dock, duplikasi panel, tab dokumen serta checklist audit interaktif, lihat [Audit UI/UX Workspace Mendalam](ui-ux-audit-workspace-detail.md). Dokumen lanjutan memperjelas keterbatasan inspeksi statis pada audit ini.
