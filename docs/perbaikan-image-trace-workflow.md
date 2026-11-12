# Image Trace — perbaikan safety workflow

Menindaklanjuti IT01–IT06 `audit-image-trace.md`. Cakupan ini adalah integritas dan alur dokumen; **algoritma trace belum diperbaiki**. Audit itu mencatat baseline sebelum perbaikan, dengan penanda update di awalnya.

## Kontrak sekarang

- Panel **Trace** membuat grup vektor sebagai salinan tepat di atas sumber dalam daftar stack yang sama. Sumber image tetap ada dan terlihat; ini bukan live trace atau preview non-destruktif yang otomatis diperbarui.
- Panel **Expand Vector** dan modal **Trace & Expand** membuat grup lalu mengganti sumber pada posisinya. Undo mengembalikan image. UI memperingatkan hasilnya aproksimasi dan penggantian menghapus sumber; bila sumber ingin disimpan gunakan Trace (copy). Jika hasil tidak memuaskan, undo dan simpan backup sebelum operasi destruktif.
- Gambar dalam group biasa diproses di daftar children parent; gambar dalam group khusus seperti clipping/blend ditolak daripada mengubah semantik yang belum aman. Referensi export asset dan saved selection pada image diganti dengan ID grup ketika replace; undo memulihkannya.
- Control bar **Expand** untuk image mentah dinonaktifkan, tidak lagi memanggil Expand Appearance; dropdown preset control bar yang tidak meneruskan nilai dihapus. Pilih preset di panel atau modal.
- Satu command dipakai panel dan modal (`src/core/commands/imageTraceCommand.ts`): hanya satu image dipilih, ada data image, layer/node/ancestor visible dan unlocked, dan hierarki harus valid. Minimal salah satu fill/stroke aktif. Validasi ID serta struktur hasil sebelum commit. Tiap commit mempunyai undo step tersendiri tanpa coalescing.
- Command mengamati perubahan dokumen/selection, switch, home dan transaksi selama async. Jika ada perubahan, hasil lama dibuang, termasuk jika pengguna kembali ke dokumen/selection sebelumnya. Dua request bersamaan untuk source yang sama ditolak. Menutup modal/panel membatalkan pekerjaan; loader memiliki timeout 15 detik dan membatalkan decode image saat memungkinkan. Kalkulasi tracing yang sudah berjalan sinkron **belum bisa diinterupsi**.

## Verifikasi

- `src/__tests__/image-trace-workflow-audit.test.tsx` telah diubah dari karakterisasi bug menjadi tes ekspektasi aman: copy, replace root/nested, lock, switch, perubahan source, cancel, undo/redo, referensi, invalid ID, dua operasi cepat, dan control bar disabled. Terdapat tes melewati helper trace asli dengan bitmap/Canvas di-mock, SVG output dan `.adloze` roundtrip.
- `src/__tests__/image-trace-loader-audit.test.ts` menguji pembatalan load; juga mempertahankan karakterisasi masalah resolusi/bounds/rotasi yang **belum** diperbaiki.
- Test UI memakai jsdom, Image/Canvas di-mock pada kasus yang relevan, bukan tes pixel/browser nyata; browser/IndexedDB end-to-end, interaksi/picker native, dan visual fidelity tetap perlu diuji.

## Masih terbuka

- `image-trace-audit.test.ts` sengaja masih mencatat bug kualitas IT07–IT10: lubang, alpha parsial, garis tipis dan method; tes hijau di sana bukan bukti hasilnya benar. Sampling rendah, transform dan bounds IT11, pixel accuracy, gradient/warna, presets, stroke centerline, noise semantics dan performa IT12 masih terbuka.
- Proses sync di main thread tetap berpotensi menghambat interaksi, dan AbortSignal tidak dapat menghentikan komputasi yang sudah berjalan. Perlu worker dan batas resource.
- Tidak ada state live trace atau preview interaktif. Salinan masih berada di atas image asli, yang dapat terlihat pada area transparan. Trace tidak bisa dibuka ulang sebagai parameter trace editable; hasilnya grup path biasa.
- Beberapa format ekspor lain punya bug tersendiri (`audit-mesin-engine.md`); sukses roundtrip dokumen atau SVG string bukan bukti kesamaan hasil visual canvas/PNG/PDF.
