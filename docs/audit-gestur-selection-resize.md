# Audit dan perbaikan gesture Selection Tool: resize

## Permasalahan yang diperiksa

Implementasi sebelumnya membatasi width/height minimal sehingga handle tidak bisa melewati sisi lawan. Shift memilih rasio berdasarkan width/height yang lebih kecil, bukan posisi pointer, dan handle sisi tidak memakai sisi lawan sebagai pusat jangkar. Pada rotated vector, selection box tidak mengikuti posisi geometri yang dirender. Pointer resize juga tidak ditangkap sehingga drag melewati batas SVG berisiko terputus; Escape tidak membatalkan transaksi resize.

## Perubahan

- Drag bebas dapat melewati sisi lawan untuk me-reflect vector path/rectangle/ellipse/polygon/star/line; ukuran box tetap positif dan anchor/handle Bézier benar-benar direfleksikan. Bentuk rotated diukur berdasarkan geometri visual dan rotasinya dibake ke anchor saat resize.
- Shift + corner: proyeksi pointer ke diagonal berproporsi terdekat pada kuadran saat ini, berjangkar di corner lawan. Setelah melewati sumbu, arah sisi tersebut ikut terbalik.
- Shift + sisi: faktor skala didasarkan pada jarak pointer dalam arah sisi tersebut ke midpoint sisi lawan; sumbu tegak lurus diskalakan simetris dari midpoint. Proporsi tetap dan jangkar tetap diam.
- Capture pointer dipasang pada SVG selama resize. Escape dan pointercancel mengembalikan node awal dan menutup transaksi; resize tanpa perubahan tidak menambah history. Undo mengembalikan hasil sebelum resize.
- Agar tidak diam-diam merusak dokumen, crossing pada seleksi yang berisi image, text, atau tipe renderer khusus belum direfleksikan: skala dibatasi dan status menjelaskan keterbatasan. Group yang hanya berisi shape vector dapat direfleksikan.

## Bukti

`src/__tests__/selection-resize.test.ts`: 12 tes geometri untuk keempat sisi, keempat corner, nearest projection, flip, Bézier, bentuk berotasi, dan contour Pathfinder. Tes browser Chromium melakukan drag nyata: Shift-e menghasilkan 150×75 dengan midpoint sisi kiri tetap; Shift-se menghasilkan 150×75 dengan corner kiri-atas tetap; drag e melewati sisi kiri membalik segitiga menjadi 50×50; undo dan Escape mengembalikan geometri semula; resize path yang berotasi juga diuji. Tidak ada page error pada fixture itu. `npm test` 60/60, typecheck, build, dan diff-check lulus; build masih memperingatkan bundle >500 kB.

## Cakupan dan hal yang belum selesai

Ini audit khusus Selection Tool resize, **bukan audit semua gesture aplikasi**. Kasus text/image/special nodes tidak mendukung flip via drag; efek, pattern/gradient, round corner, nested transformed groups, touch/stylus, semua zoom/browser dan handle yang tepat berada di luar viewport masih perlu matriks uji. Bentuk berotasi dibake sebagai path points; untuk beberapa tipe live appearance hasil visual bisa berbeda dan perlu pengujian. Pembuatan shape baru dengan Shift masih memakai aturan lain (`StudioCanvas.tsx` bagian `draw-shape`) dan belum diubah. Penyimpanan/recovery dan temuan ekspor dari audit sebelumnya belum diperbaiki dalam batch ini.
