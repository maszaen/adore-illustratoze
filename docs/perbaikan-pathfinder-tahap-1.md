# Pathfinder — perbaikan tahap 1

## Yang diubah

- Boolean shape modes memakai polygon clipping untuk banyak objek. Unite mempertahankan semua pulau terpisah; Minus Front/Back dan Exclude mempertahankan lubang dan bagian terpisah; Intersect memproses semua input.
- Divide mempartisi seluruh input, termasuk objek ketiga; Trim menghilangkan bagian yang tertutup objek di atas; Merge menyatukan hasil tampak dengan appearance fill yang identik; Crop memotong semua objek bawah menggunakan objek paling atas.
- Hasil dengan lubang disimpan sebagai path dengan beberapa contour, bukan satu rangkaian titik yang menyambung lubang. Contour dipertahankan oleh path renderer, SVG, thumbnail, PDF stream, copy/move/resize berbasis anchor, dan parsing SVG multi-contour.
- Store menyusun input menurut urutan layer/stack, membersihkan referensi dari semua layer, menyisipkan hasil pada posisi objek teratas, dan mendukung undo. Jika input tidak didukung atau clipping gagal, artwork asli tetap dipertahankan.
- Alt-click untuk live compound shape **sementara tidak didukung**: sekarang memberi pesan dan menjaga objek semula, bukan membuat hasil yang menyesatkan. Input yang terbuka, di dalam grup, tersembunyi/terkunci, bukan vektor, atau memiliki live effect/envelope aktif juga ditolak dengan pesan. Hasil kosong saat ini tidak menghapus objek sumber.

## Verifikasi

- Tes geometri: rectangle terpisah, hole, boolean berulang, Divide tiga objek, Trim/Exclude tiga objek, seleksi lintas layer, undo, dan input yang ditolak.
- Tes SVG roundtrip memeriksa fill-rule dan contour; thumbnail dan content stream PDF memeriksa dua contour.
- Uji Chromium pada fixture Minus Front: pixel raster sisi merah dan pusat transparan; SVG sisi merah dan pusat putih sesuai background SVG. Tidak ada page error pada kasus tersebut.
- `npm test` 48/48, `npm run typecheck`, `npm run build`, dan `git diff --check` lulus. Build memperingatkan ukuran bundle >500 kB.

## Batasan yang masih terbuka

- Kurva disampling menjadi polygon (14 sampel per segmen), sehingga ini bukan boolean Bézier presisi penuh; bentuk sangat kecil, kompleks, self-intersecting, efek, stroke, dan transformasi lanjutan masih perlu audit lebih luas.
- Outline masih menampilkan outline tiap objek, belum mempartisi seluruh segmen persilangan seperti Pathfinder Outline profesional; Merge belum membuktikan semua kombinasi gradient/pattern/transparansi. Hasil kosong tidak mengonsumsi input.
- Live compound shape tidak tersedia sementara; perlu implementasi non-destruktif dan renderer yang benar sebelum diaktifkan kembali. Operasi edit lanjutan seperti simplify/offset yang belum memahami contour terpisah juga perlu diaudit.
- Ini belum menyelesaikan temuan lain: ekspor gambar raster/PDF, SVG import transform/arc, recovery, layout floating, dan fidelity teks lanjutan masih terbuka.
