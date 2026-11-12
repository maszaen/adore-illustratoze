# Render tahap 1 — kontrak render bersama, clipping, efek, outline teks, pengukuran agent

Menindaklanjuti E03, E06, E07 (sebagian), E09, E11 dan E14 di `audit-mesin-engine.md`, plus feedback agent tentang pengukuran teks dan bounds (`agent-capability-audit.md`). Viewport (`StudioCanvas`) dijadikan acuan; renderer lain harus sama dengannya.

## Yang berubah

- **Aturan bersama** di `src/core/render/appearance.ts`: urutan layer, geometri gradient (objectBoundingBox SVG, termasuk skew pada kotak non-persegi dan radial elips), opacity per stop, warna swatch/tint, parameter efek, kontrak clipping mask (child paling atas = mask, harus path/shape), dan bounds render. Canvas, SVG, PNG dan PDF memakai fungsi yang sama.
- **Raster (PNG/JPG/WebP)** ditulis ulang: layer digambar bawah ke atas, path memakai generator yang sama dengan viewport (live corner, compound, envelope), semua fill/stroke di appearance stack, swatch/tint, gradient dengan opacity stop, clipping, dan opacity/blend/efek grup lewat layer offscreen (anak yang tumpang tindih tidak pudar dobel). Blur memakai `ctx.filter`, dengan blur software (`src/core/render/blur.ts`) bila browser tidak mendukung. Layer offscreen dibatasi 100 juta piksel, lebih dari itu ekspor gagal dengan pesan jelas.
- **SVG export**: clipPath untuk clipping group, filter efek dengan region eksplisit, semua fill/stroke, opacity layer, blend mode, swatch/tint, stroke variable-width. Opsi `onWarning` melaporkan yang tidak bisa direpresentasikan (pattern fill, clipping group tanpa mask valid, outline yang gagal).
- **PDF** (`src/core/io/pdfRender.ts`): urutan layer benar, rotasi, gradient asli (shading axial/radial + soft mask untuk stop transparan), clipping, blend mode, fill/stroke stack dengan cap/join/dash. Teks: karakter di luar Helvetica diganti `?` dengan warning, tidak lagi crash. Opsi `onWarning` melaporkan efek, opacity grup/layer, gambar, pattern, teks bergradient, font non-standar.
- **Viewport**: parameter shadow sekarang dibaca dari `dx/dy` (yang ditulis menu dan preset) maupun `offsetX/offsetY` (file lama). Sebelumnya offset dari menu diabaikan. Region filter eksplisit sehingga blur besar tidak terpotong; grup bisa memiliki efek dan blend mode; clipping group benar-benar memotong.
- **Make Clipping Mask** tidak lagi menduplikasi objek teratas: membuat wadah kosong dengan mask = objek paling atas di stack (bukan urutan klik), menolak objek terkunci, beda layer, atau di dalam grup. **Release** membuang fill/stroke mask seperti Illustrator.
- **Create Outlines** sebelumnya mengubah teks menjadi persegi bulat dan isi teks hilang. Sekarang membuat grup glyph asli dari font yang di-upload (semua contour, termasuk lubang O/B/8), mengikuti baris, alignment, tracking, kerning, glyph transform dan rotasi teks hidup, satu langkah undo. Bila file font untuk family itu belum di-upload, perintah dibatalkan dengan pesan dan teks tidak berubah. Generator huruf rekaan dihapus. SVG mode outline menyimpan `<text>` hidup plus warning dalam kasus itu.
- **Modal ekspor** SVG dan PDF menampilkan daftar warning.
- **Agent**: tool MCP `adore_measure_text`, perintah CLI `measure`, fungsi SDK `measureTexts`; inspect menambahkan `visualBounds`, `effectBounds`, `textLines`, `measurement` (sumber pengukuran dan font yang tidak tersedia). Bridge menunggu font dimuat (maks 3 detik) sebelum inspect, measure dan apply.

## Verifikasi

- Vitest: `render-consistency.test.ts`, `text-outline.test.ts`, `agent-measure.test.ts`, tambahan di `agent-live.test.js`. Empat tes karakterisasi yang dahulu mencatat bug (urutan layer raster, opacity stop, rotasi/emoji PDF, outline O) dibalik menjadi tes perilaku benar di file-file tersebut.
- Chrome headless (harness di luar repo, tidak di-commit): 16 skenario dirender ke PNG dan ke SVG lalu dibandingkan per piksel. Rata-rata selisih ≤ 0,57/255 per skenario; selisih maksimum terjadi pada tepi antialias (gradient radial 57, efek rotasi 21, clip + shadow 33) dengan ≤ 0,05% piksel berbeda > 24. Skenario: urutan layer, gradient linear 0/45/90 + stop transparan, radial elips, opacity + rotasi, opacity grup, opacity layer, shadow, shadow pada objek berotasi, glow + blur, blur software, shadow grup, multiply, multi fill/stroke + dash, swatch tint, clipping, clipping + shadow.
- PDF hasil ekspor skenario yang sama dirender dengan pdf.js di Chrome dan diperiksa visual: urutan layer, gradient, radial, stop transparan, clipping, multiply, multi fill/stroke dan swatch benar; efek tidak ada (sesuai warning).
- Outline teks dengan Arial asli di Chrome: posisi dan bentuk sama dengan `<text>` hidup untuk kiri/tengah/kanan, rotasi, tracking dan multi-baris (selisih rata-rata ≤ 4,4/255, hanya di tepi antialias).
- Pengukuran agent di Chrome dibandingkan dengan kotak piksel hasil render: ink teks ≤ 1,3 px (Arial, Georgia italic, bold, dua baris, font tidak terpasang), `visualBounds` ≤ 1,05 px (persegi berotasi + stroke 10, bintang berotasi, kurva, teks berotasi, clipping group dengan frame basi). Deteksi font: Arial/Georgia/Inter tersedia, family palsu terdeteksi tidak tersedia.

## Belum diverifikasi / masih terbuka

- **Viewport di browser nyata belum diuji manual** untuk perubahan ini (filter, clipping, efek grup). Typecheck dan tes jsdom lolos; jalur ekspor yang dicek piksel memakai aturan yang sama.
- PDF: efek (shadow/glow/blur), opacity grup/layer sebagai compositing group, pattern fill, gambar (E04), teks bergradient, embedding font selain Helvetica.
- Raster: gambar (E04), pattern fill, efek extrude-3d dan transform-effect (hanya ada di viewport).
- Create Outlines membutuhkan file font yang di-upload lewat panel Typography; font web/sistem tidak bisa dibaca bentuknya dari browser. Teks vertikal, type on path, touch type, small caps/superscript/subscript ditolak.
- Pengukuran teks mengikuti font yang terpasang di komputer pengguna; di Node (CLI/SDK) hanya perkiraan. `visualBounds` mengabaikan ujung miter dan memperlakukan semua stroke sebagai center-aligned (sesuai cara render saat ini).
- E08 (SVG import), E10 (rotasi dobel offset path) belum disentuh.
