# Audit Image Trace — bukti dan rencana perbaikan

Status: **audit saja, belum ada perbaikan Image Trace**. Baseline branch `arena/fc897899-adore-illustratoze` (base `1ff49b65823fc0b8d4911c13d54e81e3edca09b6`) beserta perubahan lokal sebelumnya. Ini kelanjutan `docs/audit-mesin-engine.md`; gunakan bersama audit engine/export/persistence, bukan sebagai bukti seluruh aplikasi sudah diperiksa.

## Update setelah audit

Safety workflow IT01–IT06 telah diperbaiki pada branch ini; detail kontrak baru, tes, dan keterbatasan ada di `docs/perbaikan-image-trace-workflow.md`. Sebagian IT10 (mencegah fill dan stroke keduanya kosong) dan IT12 (abort/timeout image load) juga ditangani. Temuan di bawah adalah bukti **baseline sebelum perbaikan**, bukan klaim bahwa defect workflow masih dapat direproduksi. Tes workflow sekarang menguji perilaku aman; karakterisasi geometri/loader yang belum diperbaiki masih mencatat perilaku salah. Kualitas tracing belum dibenahi.

## Lingkup dan bukti

Alur yang ditelusuri: panel Trace/Expand Vector, modal Trace & Expand, tombol control bar, `traceImageNodeToVectorNodes` (load dan sampling), `traceImageDataToVectorNodes` (quantization, komponen, kontur dan smoothing), struktur dokumen, undo dan konsekuensi render/ekspor. Audit tidak mengubah production source.

**D** = dibuktikan pada test baru di bawah; **S** = pembacaan kode, belum eksperimen lengkap; **H** = bukti historis. Mock `Image`, Canvas atau fungsi trace dipakai bila disebut; tidak sama dengan melihat pixel browser. Klasifikasi: **P0** risiko rusaknya dokumen/kerja atau aplikasi tak responsif; **P1** hasil/aksi tidak sesuai dan dapat menyesatkan; **P2** kelengkapan/UX/fidelity yang perlu spesifikasi atau data lebih lanjut.

```sh
npm test -- --run src/__tests__/image-trace-audit.test.ts src/__tests__/image-trace-loader-audit.test.ts src/__tests__/image-trace-workflow-audit.test.tsx
```

File workflow kini berisi regression tests untuk perilaku yang diperbaiki. File `image-trace-audit.test.ts` dan bagian sampling di `image-trace-loader-audit.test.ts` masih merupakan characterization tests untuk defect yang belum diperbaiki. Test hijau tidak berarti keseluruhan Image Trace sehat. Semua data gambar dibuat di memori, tidak memerlukan foto pengguna.

## Peta arsitektur saat ini

| Langkah | Implementasi yang diperiksa |
| --- | --- |
| Panel | `src/components/panels/ArtboardsAssetHistoryInfoPanel.tsx:314–373, 998–1186`: state opsi lokal; Trace dan Expand memanggil helper yang sama lalu langsung mutate dokumen. |
| Modal | `src/components/modals/StudioModals.tsx:309–317, 2865–3054`: opsi lokal terpisah, tombol Trace & Expand menambahkan grup hasil. |
| Control bar | `src/components/workspace/ControlBar.tsx:35–45, 752–789`: preset membuka modal, Expand fallback ke action lain. |
| Decode & sample | `src/core/io/imageTrace.ts:430–476`: load HTML Image, gambar ke canvas maksimal 96 di sisi panjang (minimum 16 sisi pendek), getImageData; ukuran output pakai bounds node. |
| Engine | `imageTrace.ts:242–424, 522–787`: quantisasi BW/grayscale/RGB, connected components, outer contour, simplifikasi RDP, smoothing, bentuk group + path. |
| Penyimpanan/histori | `src/state/useStudioStore.ts:699–781, 841–875`: setiap mutate membuat history; tidak otomatis mengesahkan semua referensi dokumen. |

## Temuan

### IT01 — P0 / D: panel Trace meninggalkan root node yang tidak terdaftar di layer

**Reproduksi:** `panel Trace keeps source node in map but removes its layer membership` di `image-trace-workflow-audit.test.tsx`. Fixture image root dipilih; helper trace di-mock dengan hasil grup valid; klik **Trace**. Source `doc.nodes.image` masih ada, tetapi `layer.nodeIds` tidak lagi memuatnya; `validateDocument` dari SDK menolak: `root must occur exactly once in its layer`. Undo di fixture memulihkan membership.

**Bukti source:** `ArtboardsAssetHistoryInfoPanel.tsx:344–367` menghapus source dari daftar layer pada kedua mode, tetapi menghapus source dari `nodes` hanya bila `expandImmediately`. Renderer canvas menggunakan `layer.nodeIds` (`StudioCanvas.tsx:3092–3098`), sehingga source tidak lagi menjadi root render normal walau masih ada di map. Ini bukan bukti bahwa seluruh file hilang atau bahwa semua jalur save menolak dokumen.

**Harapan / arahan:** tentukan kontrak: Trace non-destruktif yang mempertahankan sumber + state preview nyata, atau operasi konversi eksplisit. Jangan membuat orphan; pastikan source tetap bisa dipulihkan, hasil dan stacking terdefinisi, selection dan satu langkah undo tepat. Bila live trace belum didukung, jangan menyamarkannya sebagai preview.
**Selesai jika:** Trace, repeat, undo/redo, save/reopen, validasi hierarki dan reselect lulus untuk root dan grouped images; periksa canvas, SDK inspect dan thumbnail. Ganti test defect menjadi invariant, bukan menyembunyikan node orphan saat validasi.

### IT02 — P0 / D: Expand pada gambar di dalam grup merusak referensi parent

**Reproduksi:** `panel Expand on a grouped image leaves a dangling child reference`: dengan image child `wrapper`, klik **Expand Vector**, helper trace di-mock. Source dihapus dari `doc.nodes`, tetapi `wrapper.children` masih menunjuk `image`; validator menolak `invalid children`.
**Bukti source:** panel `:346–363` menghapus node dan hanya memperbarui daftar layer root, tidak memperbarui `parent.children`.
**Harapan / selesai jika:** operasi mengganti child pada slot stack yang tepat sambil menjaga parent/layer/source/selection dan undo; recursive hierarchy & locked ancestors diuji. Bila belum didukung, tolak sebelum mutasi dan beri alasan. Jangan sekadar meletakkan hasil sebagai root dan membiarkan referensi lama.

### IT03 — P1 / D: tombol Expand control bar tidak melakukan Image Trace

**Reproduksi:** `control bar Expand converts an untraced image to a generic path instead of tracing it`: pilih image, klik tombol berjudul `Expand Traced Artwork into Editable Vector Paths`. Node yang sama berubah dari `image` menjadi `path` dengan titik geometris generik; undo mengembalikan tipe image di fixture. Tidak ada bitmap yang ditrace pada test ini.
**Bukti source:** `ControlBar.tsx:777–786` mencoba `expandImageTrace` yang tidak ada di store, lalu memanggil `expandAppearance`; `useStudioStore.ts:2566–2581` mengubah node terpilih menjadi polygon/path; untuk node image fallback `nodeToPolygon` adalah rectangle (`pathfinder.ts:26–72`).
**Harapan / selesai jika:** Expand hanya aktif pada hasil trace yang memang dapat di-expand, bukan image mentah; tidak ada fallback destruktif generik. Uji untraced image, traced state, lock, undo/redo, feedback, dan sampling bitmap asli. Sementara ini **hindari tombol Expand di control bar untuk image**.

### IT04 — P0 / D: hasil async bisa diterapkan ke dokumen lain

**Reproduksi:** `late trace completion is applied to the newly active document`: Promise helper trace ditahan, jalankan Trace pada A, buka B, resolve hasil A; grup hasil muncul dalam B. Helper di-mock untuk mengatur urutan; ini membuktikan race handler dalam React/jsdom, bukan timing riil browser. Dengan layer ID berbeda hasil dapat juga punya referensi invalid; test utama membuktikan aplikasi ke dokumen yang salah.
**Bukti source:** panel menunggu `await traceImageNodeToVectorNodes` (`:342`) dan kemudian `updateDocument` (`:348`), sedangkan store `updateDocument` mengambil dokumen aktif saat dipanggil (`useStudioStore.ts:699–703`). Modal mempunyai pola async serupa (`StudioModals.tsx:3024–3046`), belum dibuktikan ulang pada test modal.
**Harapan / selesai jika:** capture document ID + source ID + revision/fingerprint, batalkan/abaikan hasil usang ketika doc/selection/image/layer berubah; commit hanya ke dokumen target yang masih valid, atomic dan undoable. Test switch/close/delete/ubah source, dua request berurutan, tab/modal unmount, load gagal, dan lock berubah selama menunggu. Jangan menulis ke doc baru hanya berdasarkan layer ID yang kebetulan sama.

### IT05 — P1 / D: Expand tidak menghormati lock

**Reproduksi:** `panel Expand removes locked source image rather than rejecting`: set `node.locked=true`, mock helper berhasil, klik **Expand Vector**; image terhapus dari map. Test mengatur state langsung karena UI normal mungkin tidak membiarkan memilih node terkunci.
**Bukti:** panel `:316–368` tidak memeriksa locked node/layer/ancestor sebelum delete/insert. Layer lock dan ancestor lock adalah risiko source yang belum dites pada audit ini.
**Harapan / selesai jika:** cek target, layer, seluruh ancestor dan recheck saat commit async; locked/hidden/unsupported tidak dimutasi. Tambahkan test lock tiap level dan lock yang berubah saat trace berjalan; pastikan pesan dan undo sesuai.

### IT06 — P1 / D: modal dan panel punya semantik hasil berbeda

**Reproduksi:** `modal Trace & Expand adds a second object without replacing the source image`: modal menambah grup sambil membiarkan image asli di layer. Kebalikannya, panel Expand menghapus source. Kedua hasil berbeda meskipun label menyiratkan konversi serupa; bitmap helper di-mock. Modal tidak memilih hasil secara eksplisit di blok yang diperiksa.
**Bukti:** `StudioModals.tsx:3036–3046` menambah result, tanpa delete source; panel `:346–363` menghapus source untuk Expand. Panel Trace juga bukan live trace (IT01).
**Harapan / selesai jika:** satu command/domain service dengan kontrak dan UI konsisten; nyatakan apakah source disimpan sebagai live object, disembunyikan, atau diganti; jangan menyimpan dua yang terlihat tanpa penjelasan. Test kedua entry point, preset sama, stacking/selection, undo, redo, reopen dan duplikasi.

### IT07 — P1 / D: lubang transparan pada bentuk hilang

**Reproduksi:** `outputs one solid exterior for a black ring with a transparent hole`: bitmap 20×20 berupa ring hitam dan lubang transparan; menghasilkan 1 path dengan fill dan tanpa subpath `moveTo`. Exterior di fixture mengelilingi pusat sehingga output mengisi hole, bukan menjaga transparansi. Bukti struktur, bukan screenshot browser.
**Bukti:** `imageTrace.ts:313–326` hanya memanggil `traceMooreContour` untuk batas luar dari tiap connected component dan membuat satu path per region; tidak menelusuri inner boundaries (`:651–706`).
**Harapan / selesai jika:** multi-contour dengan fill-rule yang tepat untuk holes, nested islands dan batas image; test donut, huruf O/B/8, transparan/putih-ignore, multi-color bersebelahan, compound path dan serialization. Bandingkan pixel mask sumber dan hasil dengan toleransi; tes SVG/raster/PDF karena engine export punya keterbatasan lain.

### IT08 — P1 / D: alpha parsial hilang

**Reproduksi:** `uses the same opaque fill for half-transparent and opaque pixels`: dua bitmap warna sama alpha 128 dan 255 menghasilkan geometri dan fill identik, opacity=1.
**Bukti:** `imageTrace.ts:532–535, 553–556, 582–585` hanya membuang alpha <32; output node/fill opacity =1 pada `:348–384`. Tidak ada bukti bahwa alpha rendah lain akan direpresentasikan.
**Harapan / selesai jika:** sepakati model transparansi: quantize alpha, flatten terhadap warna background terpilih, atau peringatan yang jelas bila tidak didukung. Test alpha 0/31/32/128/255, edges anti-alias, colored transparent, mode BW/grayscale/color dan export; jangan klaim transparansi preserved jika di-flatten.

### IT09 — P1 / D: garis tipis bisa menjadi path tanpa luas

**Reproduksi:** `thin 1-pixel line becomes a zero-area closed filled path`: bitmap 20×20 dengan garis hitam horizontal 16 pixel, `noise=1`, `paths=100`; hasil satu path tertutup, hanya fill, semua anchor dan handle segaris y=10. Luas geometri fill nol meski input memiliki piksel hitam; test tidak melakukan render browser.
**Bukti:** `traceMooreContour` melacak posisi pixel (`imageTrace.ts:651–706`), simplifikasi `:709–734`, result selalu `closed:true` (`:352`); fallback cuma jika jumlah titik <3, tidak memeriksa luas.
**Harapan / selesai jika:** contour di pixel edges menjaga coverage dan thin features, atau line-art menghasilkan centerline dengan width; test garis horizontal/diagonal/vertikal, 1 px dots, filamen, antialias dan berbagai skala, periksa raster pixel. Hindari menghapus input hanya karena trace menghasilkan jumlah path nonzero.

### IT10 — P1 / D + S: method, stroke dan opsi dapat menyesatkan

**Bukti D:** `ignores method setting...` membandingkan bitmap dan output normalisasi yang sama untuk `abutting` vs `overlapping`; `permits invisible paths...` menghasilkan path tanpa fill maupun stroke ketika kedua opsi false. **Bukti S:** `opts.method` tidak dipakai di engine setelah deklarasi/default (`imageTrace.ts`), meskipun panel menampilkan kedua pilihan; `opts.strokes` hanya memberi stroke seragam di sepanjang kontur tertutup (`:365–379`), bukan skeleton/centerline; `maxStrokeWeight` dipakai sebagai berat tunggal bukan batas estimasi; panel tidak menyediakan field untuk nilai itu. `noise` berlabel px namun area ambang `round(noise*0.45)` dalam pixel sample (`:267,313`), sehingga belum tentu sama dengan unit pixel source. BW hitam dipetakan ke `#141414`, bukan `#000000` (`:530`).
**Harapan / selesai jika:** definisikan dan implement semantics, atau nonaktifkan/beri label batas; minimal satu dari fill/stroke harus dipilih. Test per opsi dengan fixtures yang memang membedakan hasil, default preset, centerline vs contour, nilai noise pada ukuran sample berbeda, dan metrik hasil warna. Jangan hanya menyimpulkan opsi berfungsi dari state UI.

### IT11 — P1 / D: sampling rendah, bounds minimum dan transform sumber hilang

**Reproduksi:** `always samples landscape at 96 px wide, enlarges tiny bounds and drops rotation`: Image/Canvas di-mock sebagai image 4000×2000 dengan node 8×10 pada (5,6), rotation 90°. `getImageData` menerima 96×48; grup hasil 20×20 pada (5,6), rotation 0°. Test membuktikan argumen dan metadata, bukan kualitas visual foto aktual.
**Bukti:** `imageTrace.ts:434–450` membatasi sample 96 dan minimum dimensi output 20; tidak menyalin rotation/opacity sumber (`:393–414`). Untuk image ekstrim, min sisi 16 mendistorsi aspect ratio sampling; belum dihitung pixel fidelity di browser.
**Harapan / selesai jika:** ukuran sampling mempertimbangkan natural dimensions, resource budget dan pilihan kualitas; dipetakan ke display bounds dan transform yang benar (rotation/reflection/opacity/clipping), termasuk node <20 dan rasio ekstrem. Test sumber non-square, rotated, scaled, mirrored, group, 1px/detail, no upscaling, kualitas yang berbeda dan performance dengan fixture nyata. Jaga alpha/color profile dengan kebijakan jelas.

### IT12 — P2 / S: input/parameter, lifecycle dan performa belum dipagari

**Bukti source:** raw API menggunakan `Math.max(2, imageData.width/height)` tanpa mengecek ukuran `data`, positive integer, finite bounds atau opsi (`imageTrace.ts:249–255`); 1×1 diperlakukan sebagai 2×2 tanpa padding eksplisit. `traceMooreContour` bisa berjalan hingga `w*h*2` per komponen (`:674–676`), setiap komponen membuat queue/arrays, dan RDP rekursif (`:709–734`); helper normal membatasi resolusi, raw API tidak. Komputasi dilakukan sinkron setelah image load; tidak ada worker/progress/cancellation pada fungsi tersebut. Ini risiko dari struktur kode, **bukan** hasil benchmark atau pembuktian hang pada gambar pengguna. Komentar `imageTrace.ts:426–429` mengatakan sample fallback, tetapi kode kini melempar error saat load gagal; fungsi sample prosedural masih ada namun bukan fallback aktif.
**Harapan / selesai jika:** validasi ukuran, buffer, range/finite opts, budget maksimum pixel/contour/node/time; jalankan di worker untuk pekerjaan berat dengan progress dan cancel, pastikan error tidak mengubah dokumen. Benchmark noise/checkerboard/long contours di browser, data besar, input rusak, load/CORS/canvas failure; tetapkan budget berdasar pengukuran. Tambahkan tes 1×1 tanpa membaca piksel di luar buffer dan perbaiki komentar usang.

## Hal yang sudah ada dan batas bukti

- `src/__tests__/audit-regression.test.ts` sudah membuktikan bitmap transparan 10×10 menghasilkan error, bukan rectangle palsu. `traceImageNodeToVectorNodes` saat ini melempar error jika image tidak bisa dimuat; laporan lama tentang fallback sample (`docs/audit-temuan-ui-mesin-tahap-1.md`) tidak boleh diperlakukan sebagai status sekarang. Tes end-to-end browser untuk CORS/decode gagal belum dilakukan di audit ini.
- Engine mengeluarkan node path yang dapat diedit dan group, tetapi tidak otomatis berarti fidelity memadai. Canvas, SVG, raster dan PDF mempunyai keterbatasan terpisah (`docs/audit-mesin-engine.md`, E03–E07/E11/E14).
- Ada 11 preset dan mode BW/color/grayscale; yang dibuktikan di sini hanya fixture khusus di tests, bukan seluruh preset atau foto. Hasil benchmark, screenshot, quality score, keselamatan multi-tab, dan kompatibilitas browser belum dibuktikan.
- Panel dan modal memakai state opsi terpisah; control bar preset membuka modal tanpa meneruskan nilai (`ControlBar.tsx:765–769`) dan sebagian ID berbeda dari registry (`:35–45`). Perlu verifikasi UX end-to-end sebelum mengklaim preset yang dipilih dipakai. Stats panel juga bersifat state lokal dan belum diuji lifecycle lintas dokumen.

## Urutan implementasi yang disarankan

1. **Safety & kontrak workflow (IT01–IT06):** satukan command Trace/Expand di satu domain service; validasi selection, tipe image, node/layer/ancestor, dokumen, slot/stack dan revision setelah await. Jangan sentuh source sebelum result tervalidasi; buat transaksi atomik dan satu undo. Disable control-bar fallback. Pertama reproduksi dengan test ekspektasi benar; uji browser bila tersedia.
2. **Representasi hasil (IT07, IT09):** bangun contour yang mempertahankan topology/hole dan thin features; buat fixture golden mask dengan metrik yang ditetapkan (IoU/area/pixel tolerance) plus struktur path, tidak sekadar pathCount. Definisikan line-art/centerline secara terpisah dari fill regions.
3. **Input dan fidelity (IT08, IT10, IT11):** tentukan alpha, noise, method, stroke, resolusi dan transform. Implementasikan atau nonaktifkan label yang belum didukung; optimalkan parameter hanya setelah fixture kualitas dan budget ada.
4. **Stabilitas (IT12):** bounded decode, worker/progress/cancel, benchmark dan validasi. Re-test source berubah saat proses berjalan dan failure injection, dan pastikan tidak ada perubahan saat error/cancel.
5. **Integrasi lintas engine:** actual browser canvas & snapshot, group/layer, save/reopen `.adloze`, undo/redo, SVG + PNG + PDF, selection dan agent inspect. Bergantung pada temuan E03–E07/E11/E14 dari audit mesin; jangan menganggap Image Trace sendirian bisa memperbaiki semua export.

**Definition of done per tahap:** test benar merah sebelum perubahan; test batas/invalid dan lock; tidak ada silent destructive conversion; sumber terjaga sesuai kontrak; hierarchy valid; hasil tampil sesuai fixture; roundtrip dan undo; full tests/typecheck/build; catat perbedaan browser/font/CORS dan unsupported secara eksplisit. Jangan menyatakan hasil screenshot browser jika hanya ada test jsdom/mock.
