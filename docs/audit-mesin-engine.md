# Audit mesin Adore — baseline untuk eksekusi bertahap

Status: **audit, bukan daftar fitur selesai atau sertifikasi Illustrator**. Snapshot: branch `arena/fc897899-adore-illustratoze`, base `1ff49b65823fc0b8d4911c13d54e81e3edca09b6`, termasuk perubahan agent yang belum di-commit pada branch ini. Cek ulang nomor baris saat mulai pekerjaan karena source terus berubah. Audit ini tidak memperbaiki mesin. Jangan berasumsi bahwa fitur bisa diekspos aman ke agent hanya karena model data atau menu sudah ada.

## Update setelah audit

**Render tahap 1** (rincian dan batas: `docs/perbaikan-render-tahap-1.md`): E03 (urutan layer raster/PDF) dan E11 (clipping group) diperbaiki di semua renderer. E06 (gradient/opacity/radius) diperbaiki untuk canvas, SVG, PNG dan PDF; teks bergradient di PDF masih warna stop pertama dengan warning. E14 diperbaiki untuk canvas/SVG/PNG (shadow, glow, blur, group/layer opacity, blend mode, multi fill/stroke); PDF belum punya efek dan opacity group-nya per objek, keduanya dengan warning. E07 sebagian: rotasi PDF diperbaiki dan karakter di luar font standar diganti `?` dengan warning, bukan crash; font tetap Helvetica. E09: outline memakai glyph font asli dengan semua contour, dan menolak bila file font tidak dimuat (tidak lagi membuat huruf rekaan). E04, E08, E10 belum disentuh. Bagian temuan di bawah tetap baseline sebelum perbaikan.

Sebagian safety gate sudah dikerjakan pada branch ini: E01 parser hang dan E05 fallback raster ekspor ditangani; E02 autosave/recovery diperkuat **sebagian**, tetapi belum aman untuk konflik dua tab, crash sebelum async selesai, atau diverifikasi pada browser nyata. Rincian perubahan, tes, dan batas terbaru ada di `docs/perbaikan-safety-tahap-1.md`. Bagian E01/E02/E05 di bawah adalah bukti baseline sebelum fix, bukan klaim bahwa semua gejalanya tetap ada. Test parser dan raster yang dahulu karakterisasi defect kini diubah menjadi regression perilaku benar.

## Cara membaca bukti

- **D — dibuktikan sekarang**: probe dapat diulang di `src/__tests__/engine-audit-characterization.test.ts` atau `engine-audit-parser-loop.test.ts`. Ini *characterization test* yang sengaja mencatat perilaku salah saat ini, bukan spesifikasi benar; ketika memperbaiki temuan, ubah assertion ke hasil benar dan pertahankan sebagai regression test.
- **S — bukti source**: jalur kode dicek pada snapshot ini, tetapi skenario lengkap belum diujicobakan. Dampak disebut sebagai risiko/keterbatasan, bukan klaim hasil pixel atau kehilangan data.
- **H — hasil audit browser historis**: skenario dan hasil ada di `docs/audit-save-export-tahap-3.md`; kode pemicunya masih ada, tetapi browser nyata tidak dijalankan ulang pada audit ini. Harus direproduksi lagi sebelum menentukan hasil saat ini.
- **P0**: berisiko kehilangan kerja atau membekukan aplikasi. **P1**: karya/ekspor salah atau fitur penting tidak faithful. **P2**: keterbatasan fidelity/skalabilitas, atau butuh pengujian untuk menentukan dampak. Prioritas ini untuk desain dan keselamatan data, bukan penilaian keamanan formal.

Jalankan probe secara terisolasi:

```sh
npm ci
npm test -- --run src/__tests__/engine-audit-characterization.test.ts src/__tests__/engine-audit-parser-loop.test.ts
npm test
npm run typecheck
npm run build
```

Probe parser kini memeriksa bahwa input malformed ditolak tanpa hang; sebelumnya probe dijalankan dalam child process dengan timeout. Probe raster memakai mock Canvas dan membuktikan pemanggilan/perintah, bukan perbandingan pixel. PDF diperiksa via content stream, bukan PDF viewer. Hasil tes hijau pada file characterization justru berarti defect lama masih teramati.

## Peta mesin & batas audit

| Mesin / alur | Source utama | Catatan |
| --- | --- | --- |
| Model & edit | `src/core/types/index.ts`, `src/state/useStudioStore.ts`, `src/core/presets/*` | Dokumen berisi layer, node, artboard, appearance dan referensi; update clone penuh dan snapshot history. |
| Geometri & seleksi | `src/core/math/bezier.ts`, `selectionResize.ts`, `selectionRotate.ts`, `snapping.ts`, `liveCorners.ts` | Titik/handle absolut, rotation per node; uji regresi tersebar di `selection-*`, `rotation-gesture`, `snapping-*`, `live-corners`. |
| Operasi bentuk | `pathfinder.ts`, `blend.ts`, `gridShapes.ts` | Pathfinder pakai polygon clipping berbasis sampel, Blend live punya batas kompatibilitas. Detail tool di `docs/audit-tools.md`. |
| Tipografi | `textLayout.ts`, `opentypeHelper.ts` | Canvas measure dan fallback berbeda; shaping/font/outline belum satu kontrak. |
| Viewport | `src/components/canvas/StudioCanvas.tsx` | SVG React untuk artwork sekaligus gesture, hit-test, effects dan overlays. Bukan otomatis sama dengan renderer ekspor. |
| Render/ekspor | `src/core/io/svgIo.ts`, `rasterExport.ts`, `pdfExport.ts` | Tiga jalur terpisah, pilihan fitur dan urutan berbeda. Thumbnail memakai SVG di `db.ts`. |
| Import/persistensi | `App.tsx`, `adlozeIo.ts`, `svgIo.ts`, `db.ts` | Native ZIP, SVG parse, IndexedDB/autosave/recovery; masalah safety dan kegagalan perlu ditangani. |
| Image/warna | `imageTrace.ts`, `color.ts`, image di `App.tsx` | Trace dan konversi warna ada, tetapi tidak diaudit mendalam dalam semua mode/gambar/profil. |
| External agent | `src/agent/design.ts`, `src/components/agent/liveBridge.ts` | Konsumen subset engine, **bukan** prioritas ekspansi tahap ini. Batas rinci: `docs/agent-capability-audit.md`. |

Audit ini fokus pada jalur yang bisa dibuktikan dan pada risiko kode yang spesifik; belum mencakup semua tool, browser, OS, font, kompleksitas file, performa, akurasi warna, format PDF atau perilaku cetak. Jangan anggap item yang tidak disebut sudah aman.

## Temuan terurut berdasarkan dampak

### E01 — P0 / D: SVG malformed bisa membuat parser loop tanpa akhir

**Bukti & reproduksi:** `npm test -- --run src/__tests__/engine-audit-parser-loop.test.ts`. Child memanggil parser dengan `M0 0 L10 0 Z 1` dan mencapai timeout 1,5 detik. `src/core/io/svgIo.ts:813–821, 1023–1031`: sesudah `Z`, token angka tidak dikonsumsi dan command tetap `Z`. SVG file ingestion ada di `src/App.tsx:188–194`. Ini input malformed; bukti menunjukkan loop fungsi, bukan pengujian crash browser nyata. Berisiko memblokir main thread jika dipakai lewat jalur UI.

**Ekspektasi:** setiap iterasi maju atau gagal dengan pesan import yang jelas; data yang sudah terbuka tidak berubah.
**Arah kerja:** validator tokenizer/state machine dengan batas token/point, pastikan progress di semua command termasuk `Z`, argumen tidak lengkap, command tak dikenal dan input ekstrem; proses parse di worker bila perlu. Hindari menerima path invalid dengan `nextNum` diam-diam menjadi 0.
**Selesai jika:** input malformed di atas ditolak/ditangani dengan bounded time; corpus fuzz + timeout, SVG valid multiple subpath, undo/atomic import dan UI error diuji. Ubah test timeout menjadi tes terminasi, tetap isolasi input berisiko.

### E02 — P0 / H + S: autosave tab dan recovery bisa kehilangan snapshot terakhir

**Bukti:** skenario historis lengkap dengan timing/observasi di `docs/audit-save-export-tahap-3.md` temuan 1–3: debounce A dibatalkan saat beralih B; snapshot recovery yang sedang ditawarkan bisa ditimpa; heartbeat mengubah dirty menjadi false. Jalur masih ada di `src/App.tsx:95–149` dan slot tunggal `src/core/io/db.ts:269–294`. Audit saat ini belum mengulang browser/IndexedDB historis; tidak boleh klaim bahwa semua data pasti hilang.
**Ekspektasi:** setiap dokumen dirty punya snapshot terakhir yang aman; recovery lama tidak ditimpa sebelum keputusan; kegagalan penyimpanan terlihat.
**Arah kerja:** per-document queue/debounce dan revision sequencing; bedakan saved/dirty; recovery multi-doc, lindungi snapshot pending restore/dismiss, desain conflict antar tab; jangan mengandalkan async IndexedDB sebelum unload selesai. Tetapkan kebijakan durable save dan state status error/quota.
**Selesai jika:** browser test dengan dua dokumen dan dua tab, switch cepat, crash/reload, restore/dismiss, out-of-order write, quota/private mode, storage blocked; konfirmasi bahwa save lama tidak menimpa revisi lebih baru.

### E03 — P1 / D + H: urutan layer raster dan PDF tidak sama dengan canvas/SVG

**Bukti:** test `raster paints layers in reverse of the SVG stacking order`: layer teratas merah lalu bawah biru pada mock raster, SVG bawah lalu atas. Canvas dan SVG membalik layer (`StudioCanvas.tsx` render layer, `svgIo.ts:272`), raster/PDF menggunakan urutan maju (`rasterExport.ts:132–140`, `pdfExport.ts:94–102`). Audit browser historis menunjukkan raster dan SVG pixel biru pada kode saat itu (lihat H #4); SVG sudah memakai urutan terbalik pada snapshot sekarang, sehingga hasil historis SVG tidak boleh dianggap masih berlaku tanpa uji ulang.
**Ekspektasi:** seluruh renderer dan hit-testing berbagi definisi stack order, termasuk nested group/layer hidden.
**Selesai jika:** fixture overlap dua/tiga layer, opacity dan group dibandingkan di viewport, SVG yang dirasterisasi, PNG/WebP dan PDF viewer; termasuk layer tersembunyi dan multi-artboard. Jangan menyamakan urutan root dengan urutan child secara membabi buta.

### E04 — P1 / D + H: gambar tidak ikut raster/PDF

**Bukti:** `raster does not call drawImage for an image node` memakai mock dan SVG memiliki `<image>`; `rasterExport.ts:205–242` tidak memiliki cabang image, `pdfExport.ts:148–265` juga tidak. Audit historis H #5 menguji PNG nyata dalam Chromium dan memeriksa PDF resource.
**Ekspektasi:** image ditempatkan dengan ukuran, alpha, rotasi, layer dan clipping yang sama, atau ekspor gagal jelas bila gambar tidak bisa di-load.
**Selesai jika:** test pixel file data URL PNG/JPEG/WebP valid, image dengan alpha dan rotation, bad URL/CORS/tainted canvas, nested group dan PDF image resource + visual viewer. Renderer raster kemungkinan perlu asynchronous image loading; jangan diam-diam output placeholder.

### E05 — P1 / D: ekspor raster dapat sukses palsu / salah MIME

**Bukti:** `raster data URL hides canvas failure...` menginjeksi error getContext: hasil berlabel `image/jpeg` padahal base64 berawalan PNG 1×1. `rasterExport.ts:115–116, 332–348` menelan error, `:355–375` dapat resolve Blob kosong. Frekuensi error pada perangkat nyata belum diukur. Native archive memakai jalur ini untuk preview (`adlozeIo.ts:95–103`), yang berbeda dari data dokumen itu sendiri.
**Ekspektasi:** explicit error, tidak membuat file palsu, tampilkan status yang bisa ditindaklanjuti; jangan hilangkan kemampuan penyimpanan native hanya karena thumbnail gagal tanpa kebijakan jelas.
**Selesai jika:** test getContext null/throw, toDataURL invalid/format tidak didukung, toBlob null, canvas terlalu besar dan CORS; periksa MIME/bytes/dimensi serta UI yang menyajikan error. Pisahkan fallback preview internal dari ekspor final.

### E06 — P1 / D + S: gradient/opacity/radius tidak konsisten antar renderer

**Bukti:** `raster ignores gradient-stop opacity; SVG writes the opacity` mengamati stop transparan dikirim ke Canvas sebagai warna solid (`rasterExport.ts:283`); linear memakai diagonal dan radial lingkaran maksimal (`:263–281`), sedangkan canvas/SVG memakai SVG objectBoundingBox (`StudioCanvas.tsx:2042–2081`, `svgIo.ts:374–393`). Raster text memakai `primaryFill.color` bukan gradient (`rasterExport.ts:216–222`); PDF hanya warna pertama (`pdfExport.ts:167–177`). Raster/PDF pakai path tanpa live-corner generator (`rasterExport.ts:232–237`, `pdfExport.ts:249–252`); SVG live corners telah diperbaiki pada branch ini. Tidak semua perbedaan visual sudah dibuktikan pixel.
**Ekspektasi:** definisi koordinat gradient, alpha per stop, fill stack, corner dan text sama antar output yang didukung.
**Selesai jika:** fixture linear sudut 0/45/90, radial non-square, transparent stops, rounded rect/star, gradient text dan opacity; pixel comparison toleransi didokumentasi lintas viewport/SVG/raster/PDF. Jika PDF tidak mampu, warning/block jelas, bukan silently solid.

### E07 — P1 / D: PDF mengabaikan rotation dan font Unicode

**Bukti:** `PDF ignores rectangle rotation and fails on emoji`: content stream rectangle rotation 0 dan 90 identik; `Hello 😀` melempar WinAnsi. PDF menanam Helvetica saja (`pdfExport.ts:59–60, 179–199`) dan tidak menerapkan rotation pada jalur path (`:220–265`); font family/italic/tracking juga tidak sepenuhnya direpresentasikan. Test stream tidak memverifikasi rendering viewer.
**Ekspektasi:** transform lengkap pada setiap node; font/shaping sesuai atau ada warning/error sebelum output.
**Selesai jika:** embedded fonts yang legal/tersedia atau fallback eksplisit, Unicode lintas script, rotation+group+artboard offset dan visual PDF rasterized di viewer; absence of glyph/embedding error harus terlihat. Hindari klaim print-ready/CMYK sebelum diuji terpisah.

### E08 — P1 / D + S: SVG import mengubah geometri dan appearance tanpa peringatan

**Bukti:** `SVG import ignores group transform and inherited fill`: group `translate(40,20)` merah berisi rect di (1,2) diimpor tetap (1,2), hitam. `different SVG arc sweep flags produce identical geometry`: arc sweep 0/1 menghasilkan handle sama. Parser melompati `<defs>`/`<style>` (`svgIo.ts:458–467`), tidak membaca transform/inherited style di jalur `elementToVectorNode` (`:551–570`); arc `:996–1021` mengabaikan rotation/flags dan membuat handle perkiraan. SVG CSS, gradient/clip/use dan banyak format lain belum tervalidasi menyeluruh.
**Ekspektasi:** impor yang faithful untuk subset yang dinyatakan; untuk fitur tidak didukung beri daftar warning yang jelas atau tolak, jangan diam-diam berubah.
**Selesai jika:** fixture transform nested/matrix, inherited CSS, gradient refs, `A` flags dan relative commands, viewBox nonzero, multi-contour, zero dimensions, roundtrip SVG; bandingkan pixel browser, bukan hanya jumlah node. XML invalid dan SVG tidak tepercaya diuji dengan batas resource.

### E09 — P1 / D: text-to-outline kehilangan counter, bentuk fallback bukan font

**Bukti:** `text outlines drop inner contours for O`: hasil node `compound-path` tetapi `points` tidak punya subpath lubang. `opentypeHelper.ts:102–110, 143` hanya menyimpan `subpaths[0]`; bila font kustom tidak tersedia dibuat glyph geometris sintetis. Konversi dapat dipakai SVG export mode outline (`svgIo.ts:111–118`). Probe membuktikan struktur O fallback, bukan seluruh font.
**Ekspektasi:** outline memakai font/glyph yang benar dan semua contour, termasuk holes; jika font tidak tersedia, jangan diam-diam membuat huruf rekaan.
**Selesai jika:** O/B/8 dan glyph multi-contour font asli; visual serta fill-rule, kerning/ligature dan non-Latin diuji. Bila belum ada shaping, tampilkan warning/fail dan pertahankan teks original, tidak overwrite artwork.

### E10 — P1 / D: offset path dapat menerapkan rotation dua kali

**Bukti:** `offsetting rotated vectors...`: rectangle 80×20 dirotasi 90°, output path berorientasi vertikal tetapi `rotation` masih 90. `nodeToPolygon` menerapkan rotasi (`pathfinder.ts:72–76`), `offsetVectorNode` memakai titik tersebut dan menyebarkan node lama tanpa reset (`:570–598`). Probe menguji struktur, bukan pixel. `outlineStrokeNode` juga memanggil `nodeToPolygon` dan menyebarkan node lama (`:660–704`): risiko serupa, belum dites spesifik.
**Ekspektasi:** transform dibake sekali atau dipertahankan sekali, tidak keduanya; posisi dan visual output benar.
**Selesai jika:** rotated/non-rotated rectangle, curved path, open path, holes, berbagai ukuran stroke/offset, undo dan ekspor; pixel/geometry compare. Audit pula endpoint terbuka, self-intersection dan multiple contours sebelum menjanjikan offset profesional.

### E11 — P1 / S: clipping group saat ini tidak benar-benar clip

**Bukti:** viewport branch group/clipping-group pada `StudioCanvas.tsx:2186–2206` hanya merender children; tidak ada `clipPath` pada cabang tersebut. SVG export memperlakukan clipping group sebagai `<g>` biasa (`svgIo.ts:121–135`); raster/PDF juga menelusuri children tanpa clip spesifik. Ini bukti source untuk jalur tersebut, belum ada pixel fixture browser pada audit ini.
**Ekspektasi:** clip shape dan urutan/group transform, fill-rule, nesting sama dalam viewport/ekspor/hit-test.
**Selesai jika:** bangun spesifikasi model clip, fixture artwork melampaui mask, nested clipping, transform/opacity, undo dan roundtrip, test pixel; sampai itu jangan ungkap sebagai fitur yang faithful.

### E12 — P1 / S: arsip native di-unzip sebelum batas atau validasi penuh

**Bukti:** `adlozeIo.ts:110–122,187–191`: `unzipSync` dan `JSON.parse` langsung pada bytes input; UI `App.tsx:178–180` membuka hasil tanpa `validateDocument` SDK. SDK memvalidasi struktur sebagian setelah unpack (`src/agent/design.ts`), tetapi batas ukuran terkompresi CLI bukan batas ukuran hasil dekompresi. Ini risiko resource/integritas, bukan bukti exploit atau bahwa file pengguna tertentu berbahaya. Arsip juga menyimpan data URL di JSON plus `assets/` (`adlozeIo.ts:63–93`), jadi komentar deduplikasi tidak membuktikan dedup nyata.
**Ekspektasi:** impor bounded, validasi versi/schema/referensi, error jelas dan perubahan atomik.
**Selesai jika:** version migration policy, ukuran entry/total terdekompresi dan jumlah file dibatasi sebelum alokasi besar, node/depth/reference/finiteness valid, duplicate/missing IDs dan unknown version diuji, input tidak trusted tidak membekukan UI. Security review terpisah; jaga roundtrip file lama.

### E13 — P1 / H + S: Place `.adloze` membuka dokumen alih-alih menempatkan

**Bukti:** audit historis #9 menggunakan event `ai-place-file`; cabang `.adloze` masih memanggil `openDocument` tanpa memakai `mode` (`App.tsx:174–183`). `mergeAdlozeIntoDocument` memang ada tetapi itu saja belum membuktikan merge semua referensi benar.
**Ekspektasi:** Open dan Place punya semantik berbeda; Place atomic dan undoable ke dokumen aktif.
**Selesai jika:** uji native picker/dispatch, referensi layer/group/symbol/swatch/brush/pattern dan ID collision, source tidak berubah, target save/reopen, undo/redo. Jika merge belum aman, nonaktifkan Place atau beri pesan jelas.

### E14 — P1/P2 / S: compositing dan efek tidak satu semantik

**Bukti:** viewport hanya membuat subset filter di `StudioCanvas.tsx:2088–2133`; SVG export menangani primary fill/stroke dan tidak mengeluarkan efek setara (`svgIo.ts:143–194`); raster mencari drop-shadow saja (`rasterExport.ts:193–203`), PDF memakai fill/stroke pertama (`pdfExport.ts:167–177`). Group opacity PDF tidak diwariskan melalui anak (`:148–165`), sedangkan SVG group memakai `<g opacity>` dan raster mengalikan alpha pada tiap anak—dua hasil itu bisa berbeda saat anak saling overlap. Ini audit source, belum pixel per efek.
**Ekspektasi:** spesifikasi rendering urutan appearance, alpha grup sebagai compositing group, blend modes, filter dan clip; unsupported diberi warning.
**Selesai jika:** matriks satu-per-satu: dua child overlap dengan group opacity, multiply, multi-fill/stroke, shadow/blur/glow, nesting/clip; golden render viewport/SVG/raster/PDF dengan toleransi dan unsupported-case tests. Jangan mengiklankan fidelity universal berdasarkan satu format.

### E15 — P2 / S: batas geometri dan numerik belum menjadi kontrak eksplisit

**Bukti:** Pathfinder mengubah Bézier ke polygon dengan 14 sampel per segmen (`pathfinder.ts:412–443`), pembulatan ke 2 desimal (`bezier.ts:590–598`), dan `outlineStrokeNode` memakai minimum half-width 1 (`pathfinder.ts:660–668`). Keterbatasan input/compound dan dukungan boolean saat ini didokumentasikan `docs/perbaikan-pathfinder-tahap-1.md`; Blend juga memakai sampling dan pembatasan ketat `blend.ts:6–16, 34–49`. Hasil kosong Pathfinder saat ini mempertahankan input menurut audit sebelumnya; perlu kesepakatan UX.
**Ekspektasi:** tetapkan unit, toleransi skala, aturan self-intersection/fill-rule/multi-contour, apa yang bisa menghasilkan destructive edit; reject yang tidak aman.
**Selesai jika:** test skala sangat kecil/besar, kurva tajam, tangent, coincident edges, islands/holes, nonzero/evenodd, stroke <2, rotasi, multiple contours, transform serta property-based invariants dan undo. Bandingkan reference geometry; jangan mengganti algoritma tanpa tolerance budget.

### E16 — P2 / S: text metrics tidak menjamin kesamaan browser/headless/font siap

**Bukti:** `textLayout.ts:8–23` mengukur canvas bila tersedia dan fallback `length * size * 0.56` bila tidak; frame dihitung di `:84–96`, bounds ink memakai fallback `:101+`. Font loading, shaping, ligatures dan script kompleks belum dibuktikan. Inspect bounds dari agent pada branch ini adalah geometry dan bukan rendered ink.
**Ekspektasi:** kontrak metrik jelas, font readiness/fallback diketahui, frame tetap stabil ketika font baru dimuat, tidak mengklaim pengukuran tepat pada headless.
**Selesai jika:** uji delayed font load, fallback/family hilang, non-Latin, RTL/emoji/combining marks, multiline, tracking/alignment dan resize/rotate lintas SVG/raster/PDF; tetapkan mana yang didukung dan warning yang tepat.

### E17 — P2 / S: biaya history, concurrency dan transaksi perlu pengukuran

**Bukti:** `useStudioStore.ts:62–70,699–704,743–781` clone dokumen tiap update dan history snapshot maksimal sekitar 50; coalescing ditentukan label sama + 350 ms, bukan identitas gesture. Per-document history sudah ditest di `audit-regression.test.ts`. Risiko memori dan kemungkinan dua tindakan terpisah bergabung adalah inferensi source, belum benchmark atau reproduksi UX lengkap.
**Ekspektasi:** atomic transaction dengan batas eksplisit, cancel/undo konsisten, skala proyek diukur dan UI responsif.
**Selesai jika:** benchmark proyek dengan path banyak dan gambar, ukuran heap/waktu update/undo, tests gesture terpisah berlabel sama, abort/cancel dan tab switch saat transaksi. Gunakan patch/command history hanya bila invariants, data migration dan hasil undo tetap terbukti.

### E18 — P2 / S: keamanan dan kapasitas media / ekspor belum memiliki budget

**Bukti:** `rasterExport.ts:105–116` mengalokasikan canvas dari ukuran × scale tanpa limit eksplisit; `adlozeIo.ts` sinkron zip/unzip; `db.ts` menelan error recovery. `imageTrace.ts` melakukan pemrosesan kontur/simplifikasi. Belum ada benchmark memori/waktu atau pengujian adversarial lengkap.
**Ekspektasi:** batas dimensi/pixel/ZIP/node/contour dan timeout atau worker, error yang bisa ditindaklanjuti, tidak silently menghasilkan file kosong.
**Selesai jika:** ukur beberapa ukuran desain/image/node dan low-memory device; test terkontrol untuk batas dimensi, large/invalid assets, cancellation, quota; dokumentasikan angka budget per platform alih-alih mengarang angka sekarang.

## Rencana eksekusi yang tidak membingungkan

1. **Safety gate — E01, E02, E05, E12:** buat regression reproduksi valid/invalid, lindungi dokumen dan tampakkan error sebelum menambah kemampuan. E02 harus memakai browser + IndexedDB nyata dan mencakup restart/two-tab; tidak cukup unit mock. E12 perlu batas sebelum dekompresi penuh.
2. **Kontrak scene dan render — E03, E04, E06, E07, E11, E14:** tentukan canonical urutan/layer/group/transform/appearance dan matriks dukungan. Perbaiki secara vertikal: satu fixture yang sama untuk canvas, SVG, raster, PDF; pilih pipeline bersama bila memungkinkan, bukan refactor besar tanpa golden tests. SVG preview approximate tetap dinyatakan apa adanya.
3. **Geometri & import — E08, E10, E15:** implement parser dengan invariants/progress, matrix/inheritance dan arc; geometri boolean/offset/toleransi/transform dengan fixtures + property tests. Jangan mengubah model tanpa migrasi file lama.
4. **Tipografi — E09, E16:** putuskan font ownership, loading/embedding dan shaping; jaga kontur dan metrik; cross-render tests dan warning untuk kasus yang tak bisa dijamin.
5. **Integritas/workflow/performa — E13, E17, E18:** Place setelah model referensi aman; ukur data dulu baru optimasi; buat batas resource dan pengujian concurrency.
6. **Baru perluas agent:** expose kemampuan yang sudah melewati test engine, file roundtrip, undo, inspect, preview, validation, per-edit approval. Tidak menjanjikan screenshot atau edit kompleks sampai renderer benar.

**Definition of done setiap item:** test merah untuk ekspektasi benar sebelum fix; kasus negatif/invalid, undo/redo dan serialisasi; pemeriksaan viewport serta setiap format terkait; keterangan supported/unsupported; tidak ada perubahan diam-diam; typecheck, full tests, build; dan bukti browser nyata jika berkaitan dengan pixel, storage, font, picker, atau MCP. Update temuan ini menjadi resolved hanya dengan tautan test/hasil dan sisa batas yang tepat. Characterization test yang saat ini mengharapkan defect harus dibalik/diganti ketika defect diperbaiki.

## Bukti yang sudah ada dan area yang belum diaudit

- Jalankan `engine-audit-characterization.test.ts` (9 probe) + `engine-audit-parser-loop.test.ts` (1 probe) untuk temuan D; kedua file tidak mengubah production code.
- `docs/audit-save-export-tahap-3.md`: bukti browser historis; beberapa status telah berubah (terutama urutan SVG), pakai per temuan dan recheck, bukan copy status mentah.
- `docs/perbaikan-pathfinder-tahap-1.md`, `docs/audit-tools.md`, `docs/audit-teks-dan-perbaikan-tahap-1.md` dan `docs/audit-gestur-selection-resize.md`: konteks dan regresi sebelumnya, tidak otomatis bukti keadaan terbaru.
- Belum diaudit lengkap: font embedding/licensing dan shaping; ICC/CMYK/separations/bleed print verification; SVG CSS penuh; PDF viewer pixels; semua efek/masks; raster color management; image trace secara menyeluruh (audit lanjutan: `docs/audit-image-trace.md`); accessibility dan security formal; semua gesture multi-input; multi-tab concurrency real; cross-browser; stres storage dan performa. Ini backlog investigasi, bukan klaim bahwa semuanya rusak.
