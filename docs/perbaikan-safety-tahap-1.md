# Perbaikan safety tahap 1

Menindaklanjuti `audit-mesin-engine.md` E01, E02 dan E05. Ini bukan penutupan seluruh audit, atau sertifikasi bebas kehilangan data.

## Yang diubah

- **SVG:** parser path menolak token/argumen tidak valid, koordinat non-finite, input terlalu besar, dan angka sesudah `Z` tanpa command; parse error tidak lagi ditelan di tengah import. Test `engine-audit-parser-loop.test.ts` sekarang memeriksa terminasi dan jalur valid; `safety-raster.test.tsx` menguji import yang memiliki elemen valid sebelum path rusak. Arc, transform dan CSS belum diperbaiki.
- **Autosave/recovery:** debounce per dokumen tidak dibatalkan oleh switch tab dokumen; penulisan same-document di halaman ini diserialkan. Project dan snapshot dicoba secara independen, kegagalan memunculkan status. Snapshot recovery dipisah per sesi halaman dan dokumen, sehingga startup/heartbeat tidak menimpa snapshot sebelumnya; pilihan Restore/Dismiss menghapus ID yang dipilih saja dan snapshot lama `latest_session` tetap dapat dibaca. Saat restore, project disimpan sebelum snapshot dihapus. Snapshot lain ditawarkan satu per satu. Test `safety-autosave.test.ts` menggunakan fake IndexedDB dan fake timers.
- **Raster:** `getContext` gagal, MIME hasil yang tidak cocok, data kosong, `toBlob` null/kosong/type berbeda kini menolak/throw; UI Save for Web dan Export for Screens menangani error, preview gagal menampilkan keterangan, asset panel menampilkan status error. Archive native punya fallback preview internal 1×1 yang eksplisit agar data dokumen tetap bisa disimpan saat canvas tidak ada; ini bukan fallback untuk ekspor final. Test `safety-raster.test.tsx` menginjeksi failure dan memeriksa UI serta roundtrip native.

## Batas penting / tindak lanjut

- Autosave tetap **debounced** dan async. Crash, power loss atau browser menutup sebelum penulisan selesai masih dapat kehilangan edit terakhir; `pagehide` hanya meminta flush dan browser tidak menjamin IndexedDB selesai. Ekspor backup `.adloze` tetap diperlukan untuk karya penting.
- Antrean berlaku dalam satu halaman; **dua tab browser yang mengedit project ID sama masih dapat saling menimpa record project**, dan konflik/revision merge belum ditangani. Snapshot per session mencegah kedua tab menimpa record recovery satu sama lain, tetapi bukan sistem kolaborasi. Snapshot dapat terakumulasi dan memerlukan kebijakan pembersihan; jangan hapus otomatis snapshot yang belum diputuskan pengguna.
- Penanda recovery saat ini bukan dirty-state yang sebenarnya: snapshot session sebelumnya dapat ditawarkan walaupun project terakhir sudah tersimpan. Ini konservatif agar snapshot tidak dihilangkan diam-diam. UI menawarkan satu snapshot per keputusan.
- Status error autosave melalui status bar dapat tertimpa pesan berikutnya; perlu indikator persistent dan handling khusus di home. Multi-tab, quota, storage diblokir, restart dan power-loss perlu diuji dengan browser/IndexedDB nyata. Fake IndexedDB bukan bukti durability browser.
- Batch export dapat menghasilkan sebagian file sebelum satu file gagal; UI menampilkan error, tetapi batch belum atomik. Error asset panel menggunakan status bar. Preview fallback archive internal adalah placeholder dan bukan screenshot; ini sudah menjadi batas SDK/CLI headless.
- Test dan typecheck tidak menjamin fidelity output. Image, layer order, gradient, PDF, Image Trace dan temuan audit lain belum dibenahi oleh tahap ini.
