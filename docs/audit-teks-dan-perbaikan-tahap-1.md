# Audit teks dan perbaikan temuan — tahap awal

Tanggal: 11 November 2026. Ini **bukan** penyelesaian seluruh temuan audit; masih ada pekerjaan penting di bawah. Audit teks dilakukan melalui pembacaan jalur editor/ekspor dan tes fungsi, bukan pembandingan visual browser atau PDF viewer.

## Audit teks

Sebelum perubahan, viewport membagi baris dan membungkus area text secara perkiraan, memakai baseline `y + fontSize`, alignment, tracking dan sebagian style; SVG menghasilkan satu elemen text dengan baseline `y + 0.85 * fontSize` tanpa layout baris; raster memakai textBaseline `top` dan tidak menerapkan alignment/area wrap; PDF memakai baseline lain dan Helvetica. Teks kosong di viewport memakai placeholder `Text`, sementara hasil ekspor berbeda. Nilai tracking viewport memakai `/50 em`, bukan satuan per seribu em.

Perubahan: `layoutText` menyediakan layout baris, posisi, alignment dan tracking yang dipakai editor/SVG/raster/PDF. SVG mengeluarkan tspan per baris dan mempertahankan spasi; raster memakai baseline alphabetic dan alignment; viewport tidak lagi mengganti string kosong dan menghormati fill/stroke visible/opacity. Perubahan ini menyamakan aturan dasar, **bukan** menjamin kesamaan visual sempurna: wrapping masih berbasis perkiraan panjang karakter, bukan pengukuran glyph; PDF masih menggunakan Helvetica dan belum mendukung fitur font, tracking, vertical text, decoration, dan rotation setara viewport. Raster juga belum mendukung semua fitur itu. Text on path, area clipping/overflow, style run, shaping, fallback font, kerning, typography tingkat lanjut dan huruf non-Latin belum diaudit atau diperbaiki tuntas.

## Perbaikan teruji

- History disimpan per dokumen saat membuat/membuka, pindah dan menutup tab; menutup tab tidak aktif mempertahankan seleksi tab aktif.
- Duplicate dan clipboard grup mengkloning subtree, memberi ID baru, memperbaiki parent/children dan mempertahankan anak saat ungroup. Paste on All Artboards menggunakan origin artboard sumber.
- Sampling polygon Pathfinder menerapkan rotation; masalah boolean lain masih terbuka.
- SVG mengekspor image dengan elemen `<image>`; import mempertahankan opacity nol dan pusat circle nol. Parser transform, inheritance, dan arc masih terbuka.
- Fallback root node SVG, raster, PDF dan thumbnail tidak memasukkan node yang terdaftar di hidden layer ketika tidak ada visible layer yang menghasilkan node.
- Merge `.adloze` menambahkan layer source dengan ID baru dan menjaga visibility/layer membership.
- Image Trace kosong atau gagal memuat kini melaporkan error dan tidak mengganti image dengan sample/persegi palsu.

## Belum selesai / perlu ditangani

1. **P0:** Boolean Pathfinder masih membuang komponen/hole dan beberapa operasi mengabaikan input ketiga; perlu representasi multipath yang benar dan tes geometri luas. Perubahan rotasi saja tidak menyelesaikan ini.
2. **P1:** Ekspor gambar raster/PDF masih belum menggambar image. SVG saja yang diperbaiki; jalur raster sinkron perlu loading image yang benar, dan PDF perlu embedding format yang sesuai. Jangan mengandalkan ekspor tersebut untuk dokumen berisi image.
3. **P1:** SVG import transform, inheritance fill dan arc sweep masih belum diselesaikan. SVG yang memakai fitur itu berisiko berubah.
4. **P0/P1:** Recovery: error storage masih ditelan, dan heartbeat dapat menandai snapshot tidak dirty; perlu uji IndexedDB dan simulasi restart/crash.
5. **P2:** floating-to-floating, memisahkan satu tab floating, dan persistensi palette toolbar belum diperbaiki atau diuji ulang secara visual.
6. **P1:** kesamaan teks viewport dan semua format ekspor masih parsial sebagaimana dijelaskan di atas.

## Verifikasi

`npm test` 37/37 (termasuk 10 tes regresi baru), `npm run build` dan `git diff --check` lulus. Build masih memperingatkan bundle >500 kB. Preview Vite tersedia pada port 5174. Chromium headless pada environment sempat SIGSEGV, sehingga perubahan ini belum diuji secara visual di browser oleh agent; terutama posisi, jenis font dan ekspor harus dibandingkan dengan fixture aktual.
