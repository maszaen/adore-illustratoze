# Audit tools — 11 November 2026

Audit statis registry dan jalur interaksi/store/render. Label di toolbar bukan bukti bahwa setiap tool sudah lengkap. Ini bukan sertifikasi kompatibilitas Illustrator; belum semua kombinasi gesture, objek, dan ekspor diuji di browser.

## Perbaikan: Blend

Blend Tool (W): klik dua objek kompatibel berturut-turut, atau pilih dua objek lalu gunakan Make Blend. Membuat wadah dengan dua endpoint dan langkah interpolasi yang dihitung saat render; SVG, raster dan PDF memakai perhitungan yang sama. Blend Options mengubah blend yang dipilih saja; Release mengembalikan endpoint, dan undo tersedia. Steps adalah jumlah objek perantara, Distance adalah jarak perkiraan antara pusat di sepanjang garis lurus, Smooth Color memakai 32 langkah. Batas 250 langkah.

Dua endpoint vektor single-contour, dengan tipe dan warna solid berbeda, kini bisa di-blend. Untuk bentuk berbeda atau jumlah anchor berbeda, outline disampling dan disamakan jumlah titiknya; ini aproksimasi poligon, bukan pencocokan kurva Illustrator. Direct Selection atau Group Selection dapat memilih dan menyeret endpoint; double-click blend masuk isolation mode untuk edit endpoint. Perubahan warna, posisi dan bentuk dihitung ulang. Masih terbatas pada layer yang sama, dua endpoint, kedua path sama-sama terbuka atau tertutup, maksimal satu fill solid dan stroke, tanpa efek, gradient/pattern, teks, multi-contour, custom spine atau multi-object blend. Perubahan endpoint menjadi gaya yang tidak didukung dapat membuat langkah perantara tidak ditampilkan. Data blend placeholder lama tidak otomatis diperbaiki. PDF/raster masih memiliki keterbatasan umum dalam audit ekspor.

Referensi: https://helpx.adobe.com/nz/illustrator/using/selecting-objects.html dan https://bringyourownlaptop.com/blog/using-the-blend-tool-in-illustrator .

## Perbaikan tambahan

- Symbol Sprayer sekarang menaruh instance berjarak 32 unit mengikuti drag (maksimum 100 per gesture), satu undo dan mendukung pembatalan pointer. Ini belum simulasi semprotan acak Illustrator.
- Rectangular Grid dan Polar Grid sebelumnya hanya membuat persegi/ellipse; sekarang menghasilkan subpath grid (masing-masing 5 pembagian dan 5 cincin/12 radial) dalam satu path. Jumlah pembagian belum dapat dikonfigurasi. Bila stroke dimatikan, grid tidak terlihat.
- Hover selection memperlihatkan bounding box dengan warna layer; bounding box selection dan handle juga memakai warna layer objek pertama ketika seleksi lintas layer. Hover ini mengikuti permintaan user: Illustrator biasanya menyorot path saat Smart Guides aktif, bukan bounding box hover: https://community.adobe.com/questions-652/bounding-box-in-illustrator-only-shows-when-i-mouse-over-the-object-798743 .


## Belum lengkap / tidak aktif

- Puppet Warp, Perspective Selection, Live Paint Selection, Slice Selection: tidak ditemukan handler interaksi spesifik yang menyelesaikan fungsi yang dijanjikan; memerlukan implementasi dan pengujian end-to-end.
- Symbol Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler: jalur freehand belum menghasilkan operasi masing-masing. Sprayer memiliki implementasi drag dasar seperti di atas.
- Knife memanggil Pathfinder Divide pada selection, bukan memotong mengikuti jalur drag. Eraser dan Path Eraser menghapus anchor dalam radius, bukan memotong bentuk/segmen. Smooth memproses seluruh path terpilih, bukan area sapuan.
- Type on a Path membuat node teks tanpa mengaitkan path; Touch Type membuat teks biasa, belum mengedit karakter individual. Vertical Type menyimpan mode vertikal, tetapi fidelity ekspor/render dan edit belum lengkap. Flare saat ini berupa bintang, bukan efek flare.
- Shape Builder menggabung/menghapus objek yang dilintasi, belum menghitung dan memilih region secara penuh. Mesh adalah implementasi terbatas, bukan sistem edit mesh profesional.

## Ada jalur implementasi, tetapi perlu audit lanjutan

Registry juga mencakup selection/direct/group/magic-wand/lasso; pen/add/delete/anchor/curvature; type/area/type-on-path/vertical/touch-type; line/arc/spiral/grid; rectangle/rounded/ellipse/polygon/star/flare; brush/blob/pencil; scissors; rotate/reflect/scale/shear/free-transform; width dan liquify; live-paint bucket; perspective grid; gradient/eyedropper/measure; graph; artboard/slice; hand/zoom. Keberadaan cabang kode tidak membuktikan hasil, parity, gesture, undo atau fidelity ekspor. Type/corner, rotation dan snapping memiliki uji spesifik terpisah; jangan menyimpulkan semua tool dalam daftar ini sudah lengkap.

Prioritas berikutnya: alat yang sama sekali belum ada handler, operasi potong berbasis geometri nyata, symbol brush interaktif, lalu uji gesture/render/export/undo per tool. Selain itu masalah penyimpanan dan ekspor yang terpisah masih ada di `audit-save-export-tahap-3.md`.
