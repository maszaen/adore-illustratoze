# Audit singkat UI workspace — 11 November 2026

## Rujukan
- [Adobe: Customize the Illustrator workspace](https://helpx.adobe.com/illustrator/using/customizing-workspace.html): panel dipindah melalui tab; panel dapat ditutup lewat menu konteks; panel di luar dock mengambang.
- [Adobe: Illustrator workspace basics](https://helpx.adobe.com/ie/illustrator/using/workspace-basics.html): Properties tersedia secara default pada Essentials; Control panel menyediakan kontrol kontekstual.
- [Packt: Workspaces and preferences](https://subscription.packtpub.com/book/business-and-other/9781800569256/2/ch02lvl1sec05/workspaces-and-preferences): Essentials dan Classic berbeda; layout, painting, tracing, typography, dan web menekankan panel berbeda. Nama dan isi workspace dapat berubah antarversi Illustrator.

## Temuan dan tindakan
- Drag tab hanya mengubah highlight; sekarang ada pratinjau yang mengikuti pointer dan garis drop untuk membuat grup di atas/bawah. Escape dan pointer cancel membatalkan drag tab.
- Toolbar mengambang sebelumnya hanya bisa kembali dengan tombol/double click; sekarang juga bisa diseret ke tepi kiri dengan indikator dock.
- Menu utama bisa memotong/membungkus perintah; lebar kini diukur dari isi dan dibatasi viewport, tiap perintah satu baris.
- Tidak ada menu konteks canvas/panel: ditambahkan menu pada canvas dan menu tab panel untuk float/close. Klik kanan objek yang belum terpilih memilih objek tersebut sebelum menampilkan perintah.
- Semua preset sebelumnya selalu menampilkan Control bar. Essentials kini default tanpa Control, Classic dan lainnya menampilkannya. Window > Control bisa mengubah dan menyimpan pilihan per workspace; Reset mengembalikan default. Layout dan Typography mengutamakan panel relevan.
- Susunan preset adalah pendekatan menggunakan panel yang sudah tersedia, bukan salinan pasti versi Illustrator tertentu. Contohnya Libraries, Navigator, Separations Preview, dan CSS Properties belum tersedia sebagai panel di aplikasi ini.

## Batas dan tindak lanjut
- Perlu audit visual seluruh panel, semua tema/resolusi, dan setiap dialog, termasuk isi panel yang masih memakai warna statis.
- Panel floating dan grup dock kini bisa dipindah ke grup dock yang sudah ada; tombol grip memindahkan satu grup utuh. Indikator urutan tab dan target strip ikon tersedia. Toolbar utama kini disimpan per workspace; palette alat tear-off belum disimpan.
- Menu konteks canvas memilih objek yang terkena pointer bila belum termasuk seleksi, sambil mempertahankan seleksi multi-objek saat klik pada salah satu anggotanya. Menu konteks belum tersedia di semua panel/area.
- Uji ulang semua preset dengan kombinasi layout tersimpan dan reset. Layout pengguna yang sudah tersimpan dipertahankan; Reset diperlukan untuk melihat default baru.

## Lanjutan
- Menu Object, Select, Effect, View, Type, File > Document Color Mode, dan Window > Workspace memakai submenu, bukan teks `>` datar. Perintah dan shortcut tetap memakai handler yang sudah ada.
- Pathfinder ditata ulang berdasarkan [contoh panel Illustrator](https://juliannakunstler.com/pathfinder) dan [dokumentasi Adobe](https://helpx.adobe.com/illustrator/desktop/manage-objects/reshape-transform-objects/pathfinder-panel-overview.html): empat Shape Modes dan enam Pathfinders kini punya glyph berbeda serta nama lewat tooltip/aksesibilitas. Tidak mengubah operasi geometrinya.
- Batas tersisa: floating panel belum dapat digabung ke floating panel lain atau memisahkan satu tab dari grup floating; belum semua icon strip memiliki umpan balik visual selengkap dock terbuka. Pastikan opsi layer terkunci, grup bersarang, isolation, dan overlay pemilihan diperiksa lebih jauh untuk context menu.
