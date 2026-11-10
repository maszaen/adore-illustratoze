# SPESIFIKASI LENGKAP: Adore Illustratoze (Professional Vector Graphics & Illustration Studio)

Buatkan aplikasi desktop-grade vector graphics dan desain ilustrasi berbasis web bernama **"Adore Illustratoze"** secara lengkap, modular, dan siap produksi sesuai seluruh spesifikasi di bawah ini.

**Adore Illustratoze** adalah klon 100% dari **Adobe Illustrator** yang dirancang khusus untuk pembuatan ilustrasi vektor presisi tinggi, desain logo, tipografi, ikonografi, kemasan (packaging), dan materi cetak maupun digital. Aplikasi ini mengadopsi sistem **Plug-and-Play Dockable Workspace**, **Multi-Artboard Canvas**, **True Bezier Vector Engine**, **Appearance Stack non-destruktif**, **Pathfinder & Shape Builder**, serta **Print/Digital Export Pipeline**.

Aplikasi ini memiliki dua jalur keluaran utama:
1. **Export Artwork & Print-Ready Files**: Ekspor ke format industri (`SVG`, `PDF Vector` lengkap dengan Bleed & Crop Marks, `EPS`, `PNG`, `JPG`, `WebP`) baik per objek, per slice, maupun multi-artboard sekaligus (*Export for Screens*).
2. **Export Project (`.adloze`)**: File arsip native `.adloze` yang menyimpan seluruh scene graph vektor, artboard, swatches, brushes, symbols, graphic styles, dan embedded assets secara *lossless round-trip*.

---

## 0. ARSITEKTUR TEKNIS, REKOMENDASI TECH STACK (OPSIONAL) & KEPUTUSAN PRODUK

### 0.1 Panduan Tech Stack (Fleksibel / Tidak Dipatok Kaku)
Kamu **bebas memilih** kombinasi teknologi yang paling stabil, cepat, dan mudah di-maintain. Namun, agar arsitektur tidak buta pada perhitungan geometri vektor tingkat lanjut, gunakan **rekomendasi opsional** berikut sebagai referensi utama:
* **Core UI Framework**: React (TypeScript), Vue 3, atau SolidJS/SvelteKit untuk reaktivitas tinggi pada puluhan panel properti dan kontrol numerik.
* **Modular Dockable UI Engine (100% Adobe Illustrator UI)**: Direkomendasikan menggunakan arsitektur *Docking Layout Tree* (`Dockview`, `FlexLayout`, atau `GoldenLayout` + `@dnd-kit`) untuk mendukung panel yang bisa di-dock di kiri/kanan/bawah, ditumpuk (stack), dijadikan tab, dilepas menjadi *floating palette*, atau diciutkan menjadi barisan ikon (*Collapse to Icons*).
* **Vector & Geometry Math Engine**:
  * **Rendering & Scene Graph**: `Paper.js`, `CanvasKit-WASM` (Skia), `Fabric.js`, atau Hybrid `SVG + HTML5 Canvas 2D / WebGL` untuk *rendering* ribuan titik anchor pada 60fps.
  * **Boolean & Pathfinder Operations**: `Paper.js` boolean engine, `Clipper2-WASM`, atau `Martinez-Rueda polygon clipping` untuk operasi Unite, Minus Front, Intersect, Exclude, Divide, Trim, Merge, dan Shape Builder.
  * **Bezier & Offset Math**: `Bezier-js` untuk kalkulasi kurva kubik, *tangent/perpendicular snapping*, *Offset Path*, dan *Variable Width Stroke*.
  * **Typography & Create Outlines**: `opentype.js` untuk membaca file font (`TTF`, `OTF`, `WOFF`) dan mengonversi teks menjadi kurva bezier murni (*Create Outlines*).
  * **Bitmap to Vector (Image Trace)**: `ImageTracerJS` atau `Potrace-WASM` yang dijalankan di dalam *Web Worker* untuk melakukan tracing gambar raster menjadi path vektor tanpa membekukan UI.
  * **PDF & Print Engine**: `pdf-lib` atau `svg2pdf.js` untuk mengekspor vektor murni ke dokumen PDF dengan dukungan ukuran cetak presisi, *Bleed*, dan *Trim/Crop Marks*.
* **State Management & History**: `Zustand` + `Immer` (atau setara) dengan *Command Pattern / Delta Patch* untuk mendukung *Unlimited Undo/Redo* dan *History Panel*.
* **Storage & Archiving**: `IndexedDB` (via `Dexie.js`) untuk autosave proyek lokal & library aset, serta `fflate` / `JSZip` untuk pemrosesan file native `.adloze`.

### 0.2 Keputusan Produk Inti
* **Multi-bahasa (i18n)**: Antarmuka tersedia dalam Bahasa Indonesia dan Inggris, bisa diganti secara live dari menu Preferences/Top Bar, dengan seluruh string terpusat di satu tempat.
* **Sistem Unit & Konversi Fisik Nyata**: Mendukung penuh satuan **Points (pt), Picas (pc), Millimeters (mm), Centimeters (cm), Inches (in), dan Pixels (px)**. Mengubah unit dokumen atau mengetik unit berbeda di dalam input (misal mengetik `50mm` saat dokumen memakai `px`) langsung dikonversi secara matematis dengan akurat (standar $1 \text{ inch} = 72 \text{ pt} = 25.4 \text{ mm}$).
* **Color Mode Dokumen**: Setiap dokumen memiliki mode warna utama (**RGB** untuk layar/digital atau **CMYK** untuk pratinjau cetak), dengan konversi nilai warna yang konsisten di Color Picker dan Swatches.
* **Starter Preset Libraries & Built-in Templates Bawaan Pabrik**: Saat pertama kali dibuka, aplikasi **tidak boleh kosong melompong**. Wajib menyediakan pustaka bawaan siap pakai:
  * **Default Swatches**: Palet warna standar Illustrator (RGB/CMYK Swatches, Gradients linear/radial siap pakai, beberapa Pattern Swatches geometris, dan Global Colors).
  * **Default Brushes**: Minimal 8–12 kuas vektor bawaan yang mencakup ke-4 kategori (*Calligraphic, Scatter, Art,* dan *Pattern Brush*).
  * **Default Graphic Styles**: Minimal 6–8 preset *Graphic Style* (contoh: *Neon Glow, Retro 3D Extrude, Road/Double Stroke, Sticker Outline, Halftone/Scribble*).
  * **Default Symbols**: Minimal 8–10 ikon/elemen vektor *Dynamic Symbol* siap semprot dengan Symbol Sprayer.
  * **Starter Templates**: Minimal 4–6 dokumen template siap buka di tab *Templates* Home Screen (misal: *Logo & Brand Identity Grid, Isometric Illustration Poster, Packaging Box Die-Cut with Bleed, Icon Set 24px Grid*).

### 0.3 Arsitektur Modular, Reusable & Extensible (From Scratch Engineering)
Karena aplikasi dibangun dari nol (*from scratch*), kode wajib diorganisir secara **sangat modular, decoupled, dan reusable**:
1. **Strict Separation of Concerns**:
   * `core/math & geometry`: Kalkulasi murni Bezier, matriks transformasi 2D/3D, *bounding box*, konversi unit fisik, konversi warna (`RGB <-> CMYK <-> HSB <-> Hex`), dan *spatial index (R-Tree)*—bebas dari ketergantungan framework UI.
   * `core/scene-graph`: Model dokumen, Artboard, Layer, Sublayer, Group, Compound Path, Compound Shape, Path, Text, Mesh, Symbol, dan Appearance Stack.
   * `core/commands`: Sistem *Command Pattern* / *Transaction History* terpusat untuk *Undo/Redo* yang bersih dan deterministik.
   * `core/tools`: Arsitektur **Tool Plugin Registry** (`BaseTool` interface dengan lifecycle `onPointerDown`, `onPointerMove`, `onPointerUp`, `onKeyDown`, `renderOverlay`, `getCursor`, `getControlBarConfig`). Menambah atau memodifikasi salah satu dari 40+ tool tidak boleh merusak tool lain.
   * `core/effects & pathfinder`: Pipeline **Live Effect Processor** dan boolean geometry yang modular.
   * `core/io`: Serializer/Deserializer `.adloze`, parser & generator `SVG`, eksportir `PDF` (dengan Bleed & Crop Marks), dan rasterizer `PNG/JPG/WebP`.
2. **Reusable Studio UI Primitives (Design System Internal)**:
   * Seluruh panel dan dialog wajib dibangun menggunakan komponen atomik yang *reusable* dan konsisten: `<NumericScrubInput>` (mendukung drag label, ekspresi matematika `+ - * /`, dan auto-konversi unit), `<ColorSwatchButton>`, `<FillStrokeProxy>`, `<AngleDial>` (roda sudut interaktif khas Illustrator), `<GradientRamp>`, `<BezierCurveEditor>`, `<DockablePanelShell>`, `<FlyoutMenu>`, dan `<ToolbarButton>`.

### 0.4 Identitas Visual & Estetika UI: 100% Adobe Illustrator CC (Spectrum Dark Pro)
Tampilan antarmuka **wajib terlihat, terasa, dan memiliki kepadatan informasi (high-density professional UI) persis seperti aplikasi desktop Adobe Illustrator CC**:
* **Skema Warna & Tema (4 Pilihan Brightness Khas Preferences Illustrator)**:
  * Default menggunakan **Dark (`#323232` panel surface, `#262626` header/toolbar bar, `#1e1e1e` pasteboard, `#1a1a1a` garis border 1px tegas, `#3f3f3f` input field background, `#e8e8e8` teks utama, `#9e9e9e` label sekunder)**.
  * Tersedia opsi pergantian tema UI di Preferences > User Interface: **Dark**, **Medium Dark (`#535353`)**, **Medium Light (`#b8b8b8`)**, dan **Light (`#f0f0f0`)**, plus pengaturan warna **Canvas/Pasteboard** (Match User Interface Brightness atau White).
  * Aksen warna identitas: **Illustrator Brand Badge (`#330000` background dengan teks/ikon `#ff9a00` jingga khas Ai)** di pojok kiri atas, serta warna fokus/aktif tombol menggunakan **Adobe Spectrum Blue (`#1473e6` / `#0d66d0`)**.
* **Tipografi & Kepadatan Ergonomi Desktop**:
  * Ukuran font UI mikro yang tajam dan padat (`11px` – `12px` sans-serif sistem seperti `Inter`, `Segoe UI`, atau `Adobe Clean`), angka menggunakan `tabular-nums` agar nilai koordinat `X/Y/W/H` tidak bergoyang saat berubah cepat.
  * Tinggi baris, padding panel (`6px–8px`), tab header panel dengan teks ringkas dan tombol menu hamburger (`≡` Panel Options Menu) di pojok kanan atas setiap panel, serta strip barisan ikon aksi kecil di bagian bawah setiap panel (misal: *New, Duplicate, Delete/Trash* berukuran `14px`).
  * Ikonografi vektor SVG kustom bergaya monokrom presisi tinggi (`1px - 1.5px stroke`) yang merepresentasikan setiap tool Illustrator secara autentik (Pen, Direct Selection panah putih vs Selection panah hitam, Pathfinder icons, Shape Builder, Width Tool, Free Transform, Artboard, dll.).

---

## 1. HOME DASHBOARD (PROJECT LIST) & WORKSPACE ERGONOMI ALA ADOBE ILLUSTRATOR

Aplikasi terdiri dari dua bagian utama: **Home Screen (Start & Project Dashboard)** dan **Studio Workspace (100% Adobe Illustrator Modular UI)**.

### 1.1 Home Screen (Halaman Awal & Project List)
Saat aplikasi dibuka (atau saat menekan ikon **Home** di pojok kiri atas aplikasi), tampil **Home Dashboard** bergaya Adobe Illustrator:
* **Left Sidebar Navigation**: *Home*, *My Projects (Local IndexedDB)*, *New Document*, *Open `.adloze` / `.svg`*, *Templates*, dan *Preferences*.
* **Quick Preset Bar (kategori tab seperti Illustrator "New Document" modal)**:
  * **Saved**: Preset kustom yang disimpan pengguna.
  * **Mobile**: iPhone Pro, Android, iPad Pro.
  * **Web**: Web Large ($1920 \times 1080\text{ px}$), Web Medium ($1440 \times 900\text{ px}$), Minimum ($1024 \times 768\text{ px}$).
  * **Print**: Letter, A4 ($210 \times 297\text{ mm}$), A3, Legal, Tabloid, Business Card.
  * **Film & Video**: HDV/HDTV 1080p, 4K UHD, 8K.
  * **Art & Illustration**: Poster, Postcard, Square ($1000 \times 1000\text{ pt}$).
* **Modal "New Document" Lengkap**:
  * Input Nama Dokumen, Lebar (Width), Tinggi (Height), Satuan (px, pt, mm, cm, in, pc), Orientasi (Portrait / Landscape), dan **Jumlah Artboard Awal** (beserta pengaturan Grid by Row/Column dan Spacing antar artboard).
  * Pengaturan **Bleed** (Top, Bottom, Left, Right) dengan tombol rantai kunci (*Link*).
  * Pengaturan **Color Mode** (RGB / CMYK) dan **Raster Effects Resolution** (Screen 72 ppi, Medium 150 ppi, High 300 ppi).
* **Project List Manager**:
  * Tampilan **Grid View** (kartu dengan *thumbnail* pratinjau artwork, nama dokumen, dimensi, mode warna, jumlah artboard, waktu modifikasi) dan **List View**.
  * Pencarian real-time, filter, pengurutan, serta menu aksi per project: *Open, Rename, Duplicate, Export `.adloze`, Delete*.

### 1.2 Sistem Panel Plug-and-Play (100% Modular Dockable Workspace)
Di dalam Studio Editor, **tidak ada satu pun panel yang dipatok mati**. Semua panel menggunakan sistem **Plug-and-Play Modular Docking**:
* **Mekanisme Drag, Dock, Float, Tab, dan Collapse**:
  * **Dock Zones**: Panel bisa di-drag ke sisi Kiri, Kanan, atau Bawah layar, serta mendukung **Multi-Column Dock** (misal 2 kolom panel berdampingan di kanan seperti standar Illustrator).
  * **Tab Grouping & Vertical Stack**: Panel bisa digabung menjadi grup tab berdampingan atau ditumpuk secara vertikal dalam satu kolom dengan pemisah yang bisa di-resize.
  * **Tear-Off Floating Palette**: Panel apa pun bisa ditarik keluar ke tengah layar menjadi jendela melayang (*floating window*) yang bebas dipindah, diubah ukurannya, atau diciutkan menjadi bar judul tipis.
  * **Collapse to Icons (`<<` / `>>`)**: Setiap kolom dock memiliki tombol untuk menciutkan panel menjadi strip ikon vertikal yang ringkas. Mengklik ikon akan membuka panel secara *flyout*, mengklik lagi akan menutupnya.
* **Workspace Switcher (Kanan Atas Menu Bar)**:
  * Preset siap pakai: **Essentials**, **Essentials Classic**, **Illustration & Painting**, **Typography**, **Layout & Print**, **Tracing & Vectorizing**, dan **Web**.
  * Fitur **New Workspace** (simpan susunan panel kustom), **Reset Current Workspace**, dan penyimpanan otomatis state panel di penyimpanan lokal.

### 1.3 Lima Komponen Ergonomi Utama Editor
1. **Top Application Menu Bar**:
   * Ikon **Home**, Menu Dropdown lengkap: **File**, **Edit**, **Object**, **Type**, **Select**, **Effect**, **View**, **Window** (berisi daftar centang seluruh panel untuk membuka/menutup panel apa pun), dan **Help**.
   * **Document Tabs Bar**: Mendukung pembukaan beberapa dokumen/project sekaligus dalam tab (bisa berpindah antar dokumen dan *copy-paste* objek lintas tab dokumen).
   * Indikator status simpan, Zoom, GPU/CPU Preview indicator, dan Workspace Switcher.
2. **Control Panel (Contextual Sub-Header Bar)**:
   * Bar horizontal di bawah Menu Bar yang isinya berubah secara dinamis mengikuti tipe seleksi saat ini:
     * *Default / Shape*: Fill swatch, Stroke swatch, Stroke weight, Variable Width Profile, Brush definition, Opacity, Graphic Style, Align buttons, Select Similar, Recolor Artwork, Transform (X, Y, W, H).
     * *Anchor Point (Direct Selection)*: Convert to Corner / Smooth, Handles visibility, Cut path at selected anchor points, Connect selected end points (Join), Remove selected anchor points, Align points.
     * *Text*: Font Family, Font Style, Size, Leading, Alignment, Character/Paragraph panel popup, Make Envelope Warp.
     * *Bitmap Image*: Image Trace (dengan dropdown preset), Mask, Embed/Unembed, Opacity, Align.
     * *Artboard Mode*: Preset ukuran, W, H, Orientation, New Artboard, Delete Artboard, Name, Move/Copy Artwork with Artboard toggle, Artboard Options.
3. **Illustrator Tool Palette (Left Toolbar - 1 Kolom atau 2 Kolom)**:
   * Tombol `<<` / `>>` di atas toolbar untuk beralih antara **1 Kolom** atau **2 Kolom padat khas Illustrator**.
   * Mendukung klik-tahan / klik-kanan pada tool berikon segitiga kecil untuk membuka *flyout sub-tools*, lengkap dengan bar vertikal di ujung kanan flyout untuk melakukan **Tear-Off** (melepas grup sub-tool menjadi palet kecil yang melayang di kanvas).
   * Di bagian bawah toolbar terdapat:
     * **Fill & Stroke Proxy Box** yang saling bertumpuk (klik untuk memilih aktif, `X` untuk tukar fokus, `Shift+X` untuk tukar warna Fill & Stroke, tombol kecil Default Black/White `D`, dan tiga tombol kecil di bawahnya: **Color** `<`, **Gradient** `>`, **None** `/`).
     * **Drawing Modes Toggle (`Shift+D`)**: *Draw Normal*, *Draw Behind* (menggambar langsung di bawah semua objek atau di bawah objek terpilih), dan *Draw Inside* (menggambar langsung di dalam objek terpilih sebagai Clipping Mask dengan bingkai garis putus-putus di keempat sudutnya).
     * **Screen Mode Toggle (`F`)**: Normal Screen Mode, Full Screen Mode with Menu Bar, Full Screen Mode.
4. **Pasteboard & Multi-Artboard Canvas**:
   * Area luar artboard disebut **Pasteboard** (berwarna gelap `#1e1e1e` atau bisa diatur di Preferences: Dark, Medium Dark, Medium Light, Light).
   *Berbeda dengan WebDsg, di Adore Illustratoze **objek diizinkan diletakkan di area Pasteboard (di luar artboard)** sebagai tempat mencorat-coret / menyimpan aset sementara sebagaimana kebiasaan desainer di Adobe Illustrator!
   * Dilengkapi Rulers (`Ctrl+R`), Global Rulers vs Artboard Rulers, Guides, Smart Guides (`Ctrl+U` dengan teks petunjuk *anchor, path, intersect, center* berwarna magenta/hijau), Grid (`Ctrl+'`), Perspective Grid (`Shift+Ctrl+I`), dan Transparency Grid (`Shift+Ctrl+D`).
5. **Bottom Status Bar**:
   * Zoom dropdown (`3.13%` hingga `64000%`), **Artboard Navigation** (First, Previous, Dropdown daftar artboard, Next, Last), informasi Tool aktif, dan indikator status Undo/Selection.
* **Kontrol Input Profesional**: Semua input angka mendukung **Scrubby Sliders** (drag label untuk ubah angka), `Shift + Panah Atas/Bawah` untuk kelipatan 10, **ekspresi matematika di dalam input** (`+`, `-`, `*`, `/`, `%`), serta konversi unit otomatis.

---

## 2. SISTEM ARTBOARD, RULERS, GUIDES, DAN BLEED

Berbeda dari editor web, Artboard di Adore Illustratoze dirancang untuk fleksibilitas penuh ilustrasi dan percetakan:
* **Artboard Bebas Diubah Ukurannya**:
  * Saat **Artboard Tool (`Shift+O`)** aktif, pengguna bebas mengubah **Width** dan **Height** artboard dengan menarik ke-8 titik handle di kanvas, memasukkan nilai W dan H di Control Bar / Artboard Panel, atau memilih dari daftar preset (A4, Letter, iPhone, 1080p, Custom).
  * Pengguna juga bisa **menggambar artboard baru secara bebas dengan klik-drag** di area kosong Pasteboard saat Artboard Tool aktif, atau menahan `Alt+drag` pada artboard untuk menggandakannya.
* **Move/Copy Artwork with Artboard**:
  * Terdapat tombol toggle **"Move/Copy Artwork with Artboard"**. Jika aktif, menggeser atau menduplikasi artboard akan ikut memindahkan/menyalin seluruh objek yang berada di atasnya. Jika nonaktif, hanya bingkai artboard yang berpindah sementara objek tetap di tempatnya.
* **Pengaturan & Tampilan Artboard**:
  * Satu dokumen mendukung hingga ratusan artboard dengan ukuran dan orientasi berbeda-beda.
  * Setiap artboard menampilkan nomor urut dan nama di pojok kiri atas saat mode Artboard Tool aktif (`01 - Logo Primary`).
  * Opsi tampilan per artboard (Artboard Options): **Show Center Mark**, **Show Cross Hairs**, **Show Video Safe Areas**, serta pengaturan warna background simulasi kertas.
  * Fitur **Rearrange All Artboards**: Menyusun ulang seluruh artboard secara otomatis menjadi Grid by Row, Grid by Column, satu baris, atau satu kolom dengan jarak (*Spacing*) yang ditentukan.
  * **Fit Artboard to Artwork Bounds** dan **Fit Artboard to Selected Art** tersedia di menu Object > Artboards.
* **Bleed & Print Marks**:
  * Garis **Bleed** ditampilkan sebagai bingkai garis merah (`#ff0000`) di sekeliling luar artboard sesuai ukuran bleed yang diatur (misal $3\text{ mm}$).
  * **Trim View**: Mode tampilan untuk menyembunyikan seluruh bagian objek yang keluar melewati batas artboard dan menyembunyikan Pasteboard agar desainer bisa melihat hasil akhir potong cetak.
* **Rulers & Custom Guides**:
  * Menarik dari Ruler horizontal atau vertikal akan membuat **Guide** (garis bantu).
  * fitur **Make Guides (`Ctrl+5`)**: Mengubah objek vektor apa pun (garis, kotak, lingkaran, poligon) menjadi Guide! **Release Guides (`Alt+Ctrl+5`)** mengembalikannya menjadi path vektor biasa. Guides bisa dikunci (`Alt+Ctrl+;`) atau disembunyikan (`Ctrl+;`).

---

## 3. ARSITEKTUR LAYER, SUBLAYER, DAN ISOLATION MODE

Panel **Layers (`F7`)** di Adore Illustratoze wajib meniru hirarki unik Adobe Illustrator:
* **Layers vs Sublayers (Objects)**:
  * Setiap **Layer Utama** memiliki **Warna Label Seleksi** tersendiri (Light Blue, Red, Green, Medium Blue, Magenta, Cyan, Orange, Gray, dst.). Saat objek di dalam layer tersebut dipilih, warna garis *bounding box*, *path*, dan titik *anchor*-nya di kanvas mengikuti warna Layer tersebut!
  * Di dalam Layer terdapat **Sublayers** dan daftar seluruh objek (`<Group>`, `<Compound Path>`, `<Path>`, `<Clipping Group>`, `<Rectangle>`, `<Type>`).
* **Target Column (Meatball / Bullseye Icon)**:
  * Di sebelah kanan setiap baris di panel Layers terdapat lingkaran **Target Icon** (ikon bulatan ganda khas Illustrator) dan **Selection Column** (kotak warna kecil).
  * Mengklik kotak warna di kanan baris akan memilih seluruh objek di dalam Layer/Group tersebut.
  * Mengklik bulatan **Target Icon** akan menargetkan Appearance (Fill, Stroke, atau Efek seperti Drop Shadow) langsung ke level **Group** atau **Layer** secara keseluruhan tanpa merusak appearance masing-masing anak di dalamnya!
* **Kontrol Baris Layer**:
  * **Eye Icon** (Toggle Visibility): `Ctrl+klik` pada ikon mata mengubah hanya layer tersebut ke mode **Outline View** (mata berlubang), sementara layer lain tetap dalam mode Preview!
  * **Lock Icon** (Toggle Lock), **Template Layer Mode** (meredupkan gambar di layer tersebut menjadi 50% dan menguncinya untuk keperluan *tracing* manual), **Locate Object**, **Collect in New Layer**, dan **Release to Layers (Sequence / Build)**.
* **Isolation Mode**:
  * Double-click pada `<Group>` atau `<Clipping Group>` (atau memilih *Isolate Selected Object* di klik kanan) akan memasukkan editor ke **Isolation Mode**: bar abu-abu dengan *breadcrumb* hirarki muncul di atas kanvas (`Layer 1 > <Group> > <Group>`), seluruh objek lain di luar grup diredupkan (*dimmed*) dan dikunci sementara, sehingga pengguna bebas mengedit bagian dalam grup. Tekan `Esc` atau klik panah kembali untuk keluar dari Isolation Mode.

---

## 4. SELEKSI PRESISI & MANIPULASI OBJEK

* **Selection Tool (`V` - Panah Hitam)**:
  * Memilih objek utuh atau grup. Menampilkan *Bounding Box* (`Shift+Ctrl+B` untuk sembunyikan/tampilkan) untuk move, scale, dan rotate (arahkan kursor sedikit di luar sudut handle untuk memutar; tahan `Shift` untuk snap kelipatan $45^\circ$).
* **Direct Selection Tool (`A` - Panah Putih)**:
  * Memilih titik **Anchor Point** individual atau segmen garis individual tanpa memilih seluruh objek.
  * Titik anchor yang **terpilih** tampil sebagai **kotak berisi (solid)**, sedangkan titik anchor yang **tidak terpilih** tampil sebagai **kotak berongga (putih di tengah)** sehingga perbedaannya sangat jelas.
  * Menggeser segmen kurva secara langsung akan melengkungkan kurva dan menggerakkan kedua *Bezier Handle*-nya secara mulus.
* **Group Selection Tool (Panah Putih dengan tanda `+`)**:
  * Klik pertama memilih satu objek di dalam grup; klik kedua pada objek yang sama memilih grup induknya; klik ketiga memilih grup di atasnya lagi secara bertingkat.
* **Magic Wand Tool (`Y`) & Panel Magic Wand**:
  * Memilih seluruh objek di dokumen yang memiliki atribut serupa dengan objek yang diklik.
  * Panel pengaturan Magic Wand mengizinkan centang kriteria: **Fill Color**, **Stroke Color**, **Stroke Weight**, **Opacity**, dan **Blending Mode** beserta nilai **Tolerance** masing-masing!
* **Lasso Tool (`Q`)**:
  * Menggambar area seleksi bebas (*freehand marquee*) untuk memilih hanya titik-titik anchor yang masuk ke dalam area gambar.
* **Menu Select Lengkap**:
  * *All (`Ctrl+A`)*, *All on Active Artboard (`Alt+Ctrl+A`)*, *Deselect (`Shift+Ctrl+A`)*, *Reselect (`Ctrl+6`)*, *Inverse*, *Next Object Above (`Alt+Ctrl+]`) / Below (`Alt+Ctrl+[`)*.
  * **Select > Same**: *Appearance, Blending Mode, Fill & Stroke, Fill Color, Opacity, Stroke Color, Stroke Weight, Graphic Style, Symbol Instance*.
  * **Select > Object**: *All on Same Layers, Direction Handles, Bristle Brush Strokes, Clipping Masks, Stray Points, Text Objects*.
  * **Save Selection** & **Edit Selection**: Menyimpan kumpulan seleksi dengan nama tertentu agar bisa dipanggil kembali kapan saja dari menu Select.

---

## 5. DRAWING, BEZIER PATH, LIVE SHAPES, DAN BRUSH ENGINE

### 5.1 Pen Tool & Curvature Engine
* **Pen Tool (`P`)**:
  * Klik untuk membuat titik *Corner Point*, klik-drag untuk menarik *Direction Handles* dan membuat *Smooth Point*.
  * **Rubber Band Preview**: Menampilkan pratinjau garis kurva berikutnya mengikuti gerakan kursor sebelum diklik.
  * Indikator simbol kecil di samping kursor Pen Tool: `*` (membuat path baru), `/` (melanjutkan dari ujung path terbuka), `o` (menutup path / close path), `^` (mengubah titik ujung menjadi corner), `+` (menambah titik pada segmen), `-` (menghapus titik anchor).
  * Modifier saat menggambar: tahan `Spasi` untuk menggeser posisi titik anchor yang sedang ditarik, tahan `Alt` untuk mematahkan pasangan handle (*break handles* menjadi sudut lancip), tahan `Shift` untuk mengunci sudut $45^\circ / 90^\circ$, tahan `Ctrl` untuk beralih sementara ke Direct Selection.
* **Add Anchor Point (`+`)**, **Delete Anchor Point (`-`)**, dan **Anchor Point Tool (`Shift+C`)**:
  * Dengan Anchor Point Tool, klik pada titik *Smooth* untuk menghapus handle-nya menjadi *Corner*; klik-drag pada titik *Corner* untuk menarik keluar handle baru; klik-drag satu handle untuk memisahkannya dari pasangannya.
* **Curvature Tool (`Shift+~`)**:
  * Menggambar kurva mulus secara intuitif hanya dengan menempatkan titik-titik tanpa perlu menarik handle manual. Double-click pada titik (atau tahan `Alt` saat klik) untuk mengubah titik tersebut menjadi sudut tajam (*Corner Point*).
* **Operasi Path Penting**:
  * **Join (`Ctrl+J`)**: Menyambungkan dua titik ujung terbuka terdekat dengan garis lurus (atau jika memakai `Shift+Ctrl+Alt+J` akan melakukan **Average & Join** sekaligus di satu titik temu).
  * **Average (`Alt+Ctrl+J`)**: Meratakan posisi titik-titik anchor terpilih pada sumbu Horizontal, Vertical, atau Both.
  * **Simplify Path**: Mengurangi jumlah titik anchor berlebih sambil mempertahankan bentuk kurva asli, lengkap dengan slider *Curve Precision* dan *Angle Threshold* serta pratinjau jumlah titik sebelum vs sesudah.
  * **Offset Path**: Membuat path baru di luar atau di dalam path asli dengan jarak tertentu (positif/negatif), pilihan Joins (*Miter, Round, Bevel*), dan Miter Limit.
  * **Outline Stroke**: Mengonversi ketebalan garis stroke (termasuk dashed line dan variable width stroke) menjadi objek tertutup ber-fill (*closed vector shape*).
  * **Split Into Grid**: Membagi satu persegi panjang menjadi sejumlah Baris dan Kolom dengan ukuran dan jarak (*Gutter*) yang presisi.
  * **Clean Up**: Menghapus *Stray Points* (titik anchor tunggal tanpa segmen), *Unpainted Objects*, dan *Empty Text Paths*.

### 5.2 Live Shapes & Geometric Tools
* **Rectangle (`M`)**, **Rounded Rectangle**, **Ellipse (`L`)**, **Polygon**, **Star**, dan **Flare Tool**:
  * Tahan `Shift` saat drag untuk membuat bujur sangkar/lingkaran sempurna; tahan `Alt` untuk menggambar dari titik tengah (*draw from center*); tekan `Panah Atas/Bawah` saat masih menahan klik mouse ketika menggambar Polygon/Star untuk menambah/mengurangi jumlah sisi atau sudut bintang secara live; tekan `Panah Kiri/Kanan` pada Rounded Rectangle untuk mengatur radius sudut.
  * Klik satu kali di kanvas tanpa drag akan membuka **Dialog Input Numerik** untuk memasukkan ukuran eksak (Width, Height, Radius, Sides, Points, Radius 1 & Radius 2).
* **Live Corner Widgets**:
  * Saat memilih sudut lancip dengan Selection atau Direct Selection, muncul bulatan target kecil **Live Corners Widget** di dalam setiap sudut.
  * Menarik widget tersebut ke dalam akan membulatkan sudut secara interaktif. `Alt+klik` pada widget akan mengganti gaya sudut antara **Round** (melengkung), **Inverted Round** (cekung ke dalam), dan **Chamfer** (potong miring lurus).
  * Jika ditarik melewati batas maksimal pertemuan dua sudut, muncul garis indikator merah tanda *Maximum Radius Reached*.
* **Line Segment (`\`)**, **Arc Tool**, **Spiral Tool**, **Rectangular Grid Tool**, dan **Polar Grid Tool** (konsentris/radial):
  * Mendukung pengaturan jumlah pembagi, kelengkungan, dan skew secara interaktif dengan tombol panah keyboard saat menggambar maupun lewat dialog klik tunggal.

### 5.3 Brushes, Pencil, Eraser & Cutting Tools
* **Paintbrush Tool (`B`) & Panel Brushes (`F5`)**:
  * Mendukung 4 tipe kuas vektor:
    1. **Calligraphic Brush**: Kuas miring elips dengan pengaturan *Angle*, *Roundness*, dan *Size* (Fixed atau Random/Pressure).
    2. **Scatter Brush**: Menyebarkan objek vektor di sepanjang path dengan pengaturan *Size, Spacing, Scatter,* dan *Rotation*.
    3. **Art Brush**: Merentangkan sebuah ilustrasi vektor mengikuti panjang dan lekukan path, dengan opsi arah tarikan dan *Colorization Method* (None, Tints, Tints and Shades, Hue Shift).
    4. **Pattern Brush**: Mengulang ubin pola di sepanjang segmen lurus, sudut luar (*Outer Corner Tile*), sudut dalam (*Inner Corner Tile*), awal, dan ujung path.
* **Blob Brush Tool (`Shift+B`)**:
  * Menggambar langsung menghasilkan **Closed Compound Path (Fill)**, bukan garis Stroke! Jika goresan baru bersentuhan dengan objek di warna/layer yang sama, keduanya langsung menyatu (*auto-merge*) menjadi satu shape vektor utuh. Tekan `[` atau `]` untuk memperkecil/memperbesar ukuran kuas secara live.
* **Pencil Tool (`N`)**, **Smooth Tool**, dan **Path Eraser Tool**:
  * Menggambar bebas dengan pengaturan *Fidelity* (Accurate vs Smooth). Menggores ulang di dekat path yang sedang dipilih akan membentuk ulang (*reshape*) bagian segmen tersebut.
  * **Smooth Tool** menghaluskan kurva yang bergerigi dengan menggesekkan kursor di sepanjang path.
* **Eraser Tool (`Shift+E`)**, **Scissors Tool (`C`)**, dan **Knife Tool**:
  * **Eraser (`Shift+E`)**: Menghapus area di tengah-tengah objek vektor tertutup dan otomatis menutup kembali pinggiran path yang terbelah (seperti menghapus tanah liat), tanpa memengaruhi objek yang tidak dipilih jika ada seleksi aktif.
  * **Scissors (`C`)**: Mengklik pada titik di path untuk memotong (*split*) path di titik tersebut menjadi dua ujung terbuka.
  * **Knife**: Mengiris objek tertutup dengan goresan bebas (atau garis lurus dengan `Alt+Shift`) dan membelahnya menjadi dua atau lebih objek tertutup yang terpisah.

---

## 6. TRANSFORMASI, DISTORSI, ENVELOPE, DAN BLEND

* **Rotate (`R`)**, **Reflect (`O`)**, **Scale (`S`)**, dan **Shear Tool**:
  * Klik satu kali untuk memindahkan titik pusat transformasi (**Transform Origin Pin** berwarna cyan), lalu drag untuk memutar/menskala/mencerminkan terhadap titik tersebut.
  * `Alt+klik` pada kanvas menetapkan titik pusat sekaligus membuka dialog numerik (Sudut Rotasi, Sumbu Refleksi, Persentase Skala Uniform/Non-Uniform) lengkap dengan checkbox **Preview** dan tombol **Copy** (menerapkan transformasi ke salinan baru!).
  * **Transform Again (`Ctrl+D`)**: Mengulang transformasi terakhir (atau duplikasi + transformasi) secara beruntun—sangat esensial untuk membuat pola kelopak bunga melingkar atau deretan objek berjarak sama.
* **Transform Each (`Alt+Shift+Ctrl+D`)**:
  * Mengubah Skala (Horizontal/Vertical), Posisi (Move X/Y), dan Rotasi pada banyak objek terpilih secara **individual dari titik pusat masing-masing objek**, dilengkapi checkbox **Random** untuk menghasilkan variasi acak!
* **Width Tool (`Shift+W` - Variable Width Stroke)**:
  * Mengklik dan menarik di titik mana saja pada garis Stroke untuk memperlebar atau mempersempit ketebalan garis di titik tersebut secara non-linier (*Width Point*).
  * Tahan `Alt` saat menarik untuk mengatur ketebalan hanya pada satu sisi garis (asimetris). Profil lebar garis dapat disimpan ke dalam **Variable Width Profiles** di panel Stroke.
* **Free Transform Tool (`E`) & Puppet Warp**:
  * Memiliki widget melayang dengan 4 mode: *Constrain*, *Free Transform*, *Perspective Distort* (menarik sudut secara perspektif), dan *Free Distort* (menarik keempat titik sudut secara bebas).
  * **Puppet Warp**: Menaruh pin paku (*Mesh Pins*) di beberapa bagian ilustrasi (misal tangan dan kaki karakter) lalu menggeser atau memutar satu pin untuk menekuk bagian tubuh tersebut secara elastis melalui *triangulated mesh*.
* **Liquify / Reshape Tools**:
  * *Warp (`Shift+R`)*, *Twirl*, *Pucker*, *Bloat*, *Scallop*, *Crystallize*, dan *Wrinkle Tool* untuk mendistorsi path vektor menggunakan lingkaran kuas (ubah ukuran kuas dengan `Alt+drag`).
* **Envelope Distort**:
  * **Make with Warp (`Alt+Shift+Ctrl+W`)**: Membengkokkan objek atau teks dengan 15 preset bentuk (*Arc, Arc Lower, Arc Upper, Arch, Bulge, Shell, Flag, Wave, Fish, Rise, Fisheye, Inflate, Squeeze, Twist*) beserta slider Bend, Horizontal, dan Vertical Distortion.
  * **Make with Mesh (`Alt+Ctrl+M`)**: Membungkus objek ke dalam jaring baris $\times$ kolom yang titik-titik simpulnya bisa ditarik bebas.
  * **Make with Top Object (`Alt+Ctrl+C`)**: Memaksa objek/teks di bawah mengikuti bentuk kontur objek vektor paling atas secara presisi!
  * Mendukung mode **Edit Contents** vs **Edit Envelope**, serta **Expand** untuk mempermanenkan distorsi menjadi path biasa.
* **Blend Tool (`W`) & Menu Object > Blend**:
  * Membuat objek peralihan morfologi (*morphing* bentuk, ukuran, posisi, warna, dan opasitas) di antara dua atau lebih objek vektor (`Alt+Ctrl+B` untuk Make Blend).
  * **Blend Options**: *Smooth Color*, *Specified Steps* (jumlah objek di antaranya, misal 8 langkah), dan *Specified Distance*.
  * Garis jalur blend (**Spine**) berupa path vektor yang bisa dilengkungkan dengan Pen/Anchor Point Tool, atau diganti dengan path lain lewat **Replace Spine** dan dibalik urutannya lewat **Reverse Spine / Reverse Front to Back**.

---

## 7. PATHFINDER, SHAPE BUILDER, LIVE PAINT, DAN COMPOUND PATH

* **Panel Pathfinder (`Shift+Ctrl+F9`)**:
  * **Baris 1 - Shape Modes**:
    1. **Unite**: Menggabungkan objek terpilih menjadi satu kontur luar.
    2. **Minus Front**: Memotong objek paling belakang dengan objek-objek di depannya.
    3. **Intersect**: Menyisakan hanya area perpotongan dari semua objek terpilih.
    4. **Exclude**: Membolongi area yang saling tumpang tindih (*even-odd overlap*).
    * *Fitur Compound Shape*: Menahan tombol `Alt` saat mengklik salah satu dari ke-4 tombol Shape Modes di atas akan membuat **Non-Destructive Compound Shape**—objek aslinya tetap utuh di dalam grup dan bisa digeser/diedit kapan saja sementara hasil potongannya ter-update secara live, sampai tombol **Expand** ditekan!
  * **Baris 2 - Pathfinders**:
    5. **Divide**: Memecah seluruh area perpotongan garis menjadi kepingan-kepingan objek tertutup yang terpisah.
    6. **Trim**: Menghapus bagian objek belakang yang tertutup objek depan dan menghapus stroke.
    7. **Merge**: Sama seperti Trim, tetapi menggabungkan objek bersebelahan yang memiliki warna Fill identik.
    8. **Crop**: Memotong seluruh objek di bawah menggunakan bentuk objek paling atas (seperti pemotong kue).
    9. **Outline**: Mengubah seluruh objek menjadi segmen-segmen garis tepi yang terpecah di setiap titik perpotongan.
    10. **Minus Back**: Memotong objek paling depan dengan objek-objek di belakangnya.
* **Shape Builder Tool (`Shift+M`)**:
  * Saat beberapa objek terpilih dan Shape Builder aktif, mengarahkan kursor ke tiap bidang perpotongan akan menampilkan **arsiran grid halus (mesh highlight preview)**.
  * **Klik-dan-seret (Drag)** melintasi beberapa bidang akan menyatukan (*merge*) bidang-bidang tersebut menjadi satu shape baru menggunakan warna Fill aktif (atau warna Swatch yang dipilih lewat panah kiri/kanan di kursor).
  * **Tahan `Alt` + Klik/Drag** (tanda `-` muncul di kursor) akan langsung menghapus bidang atau segmen garis yang dilewati!
* **Live Paint Bucket (`K`) & Live Paint Selection Tool (`Shift+L`)**:
  * Mengubah sekumpulan garis atau path yang saling berpotongan menjadi **Live Paint Group (`Alt+Ctrl+X`)**, di mana setiap celah ruang yang terkurung oleh garis (meskipun garisnya adalah path terbuka!) bisa langsung diwarnai dengan sekali klik seperti buku mewarnai.
  * Dilengkapi **Gap Options (Gap Detection)** untuk tetap mengenali celah ruang meskipun ujung garis memiliki sedikit celah yang belum tertutup rapat (*Small, Medium, Large, Custom Gaps*).
* **Compound Path (`Ctrl+8` Make / `Alt+Shift+Ctrl+8` Release)**:
  * Menggabungkan dua atau lebih path menjadi satu objek Compound Path (misal untuk membuat lubang di tengah huruf `O` atau donat), dengan kontrol aturan **Non-Zero Winding Fill Rule** vs **Even-Odd Fill Rule** di panel Attributes.

---

## 8. APPEARANCE PANEL, MULTI-FILL/STROKE, LIVE EFFECTS & GRAPHIC STYLES

Panel **Appearance (`Shift+F6`)** adalah jantung kekuatan non-destruktif Adobe Illustrator:
* **Multiple Fills & Multiple Strokes pada Satu Objek**:
  * Satu objek vektor tunggal atau satu teks tunggal dapat memiliki **banyak lapisan Fill** dan **banyak lapisan Stroke** yang ditumpuk di dalam panel Appearance!
  * Pengguna bisa mengubah urutan tumpukan (misal menaruh Stroke di bawah Fill, atau menumpuk 3 Stroke berbeda lebar untuk membuat efek jalan raya/teks retro), menduplikasi baris Fill/Stroke, mengatur **Opacity & Blend Mode tersendiri untuk tiap baris Fill/Stroke**, serta menerapkan **Live Effect hanya pada satu baris Fill/Stroke tertentu**!
* **Live Vector & Raster Effects (Menu Effect & Panel Appearance)**:
  * Seluruh efek di bawah ini bersifat **Live (Non-Destruktif)**: muncul sebagai item di dalam panel Appearance, bisa diklik kapan saja untuk mengedit ulang parameternya, bisa dimatikan ikon matanya, atau dihapus tanpa merusak path asli:
    * **3D and Materials (Extrude & Bevel, Revolve, Rotate)**: Mengekstrusi objek 2D menjadi bentuk 3D isometrik/perspektif dengan pengaturan sudut rotasi X/Y/Z, Extrude Depth, Bevel shape, dan arah pencahayaan (*Lighting & Shading*).
    * **Convert to Shape**: Mengubah tampilan objek (misal teks hidup) menjadi Rectangle, Rounded Rectangle, atau Ellipse dengan tambahan margin relatif secara otomatis (sangat berguna untuk membuat tombol yang ukurannya otomatis mengikuti panjang teks).
    * **Distort & Transform**: *Free Distort, Pucker & Bloat, Roughen, Transform Effect* (membuat puluhan salinan *Copies* berputar/bergeser secara live dari satu objek tunggal!), *Tweak, Twist, Zig Zag* (membuat gelombang atau gerigi secara live).
    * **Path**: *Offset Path* (sebagai live effect!), *Outline Object*, *Outline Stroke*.
    * **Pathfinder Effects**: Seluruh operasi Pathfinder diterapkan sebagai efek live pada Group/Layer.
    * **Stylize**: *Drop Shadow*, *Feather*, *Inner Glow*, *Outer Glow*, *Round Corners*, dan *Scribble* (mengubah fill solid menjadi arsiran corat-coret tangan dengan pengaturan Angle, Path Overlap, Variation, Stroke Width, Curviness, dan Spacing).
    * **Warp**: Ke-15 efek lengkung Warp sebagai live effect.
    * **SVG Filters & Blur**: *Gaussian Blur*, *Radial Blur*.
* **Expand & Expand Appearance**:
  * **Expand Appearance** membekukan seluruh multi-fill, multi-stroke, variable width, brush, dan live effect menjadi path vektor murni yang siap dicetak/diekspor.
* **Panel Graphic Styles (`Shift+F5`)**:
  * Menyimpan seluruh susunan Appearance kompleks (multi-stroke, efek 3D, drop shadow, transform copies) menjadi satu kotak preset **Graphic Style** yang bisa diterapkan ke objek atau teks lain hanya dengan sekali klik. Menahan `Alt` saat mengklik Graphic Style akan *menambahkan (merge)* style tersebut ke appearance objek saat ini tanpa menghapus style yang sudah ada.

---

## 9. WARNA, SWATCHES, GLOBAL COLORS, RECOLOR ARTWORK, GRADIENT, MESH, DAN PATTERN

### 9.1 Color, Swatches, Global Color & Recolor Artwork
* **Panel Color (`F6`) & Color Guide (`Shift+F3`)**:
  * Slider warna dalam mode **RGB, CMYK, HSB, Grayscale, dan Web Safe RGB** lengkap dengan input kode Hex (`#RRGGBB`), spektrum bar di bawah untuk klik cepat, serta peringatan ikon **Out of Gamut Warning** (segitiga seru) jika warna terlalu terang untuk dicetak CMYK (klik untuk mengoreksi ke warna CMYK terdekat).
  * **Color Guide**: Menghasilkan harmoni warna otomatis (*Complementary, Analogous, Monochromatic, Triad, Compound, Shades & Tints*) dari warna dasar yang sedang aktif.
* **Panel Swatches**:
  * Menyimpan Solid Color, Gradient, dan Pattern Swatch dalam grup folder (**Color Groups**).
  * **Global Color** (ditandai segitiga putih kecil di pojok kanan bawah kotak swatch): Saat sebuah warna dicentang sebagai *Global*, mengedit warna swatch tersebut akan **langsung mengubah warna di seluruh objek di dokumen yang memakainya secara real-time**, serta menampilkan slider **Tint (`0%` – `100%`)**!
  * **Spot Color**: Opsi warna khusus untuk pemisahan pelat cetak (*Pantone / Spot*).
* **Recolor Artwork (Modal Interaktif)**:
  * Menampilkan daftar seluruh warna yang saat ini ada pada kumpulan objek terpilih (*Current Colors*) dan memetakannya ke warna baru (*New Colors*).
  * Dilengkapi **Interactive Color Wheel** di mana semua warna objek terhubung sebagai titik-titik pada roda warna: memutar satu titik dengan ikon **Link Harmony Colors** aktif akan menggeser seluruh palet warna ilustrasi secara harmonis (misal mengubah ilustrasi suasana siang menjadi suasana senja dalam 1 detik), dilengkapi fitur *Randomly change color order* dan *Color Reduction* (mengurangi jumlah warna menjadi 2, 3, atau $N$ warna).

### 9.2 Linear, Radial & Freeform Gradient + Gradient Annotator
* **Panel Gradient (`Ctrl+F9`) & Gradient Tool (`G`)**:
  * Mendukung 3 tipe gradasi:
    1. **Linear Gradient**: Gradasi lurus dengan pengaturan sudut (*Angle*) dan rasio.
    2. **Radial Gradient**: Gradasi melingkar dengan pengaturan **Aspect Ratio** (elips pipih) dan titik fokus.
    3. **Freeform Gradient**: Meletakkan titik-titik warna (**Points Mode**) atau garis lengkung warna (**Lines Mode**) langsung di dalam bentuk objek untuk menghasilkan gradasi organik yang mengikuti lekukan ilustrasi! Setiap titik memiliki lingkaran radius *Spread* dan *Opacity* yang bisa diatur.
  * **On-Canvas Gradient Annotator**: Saat objek bergradasi dipilih dan tombol `G` ditekan, muncul batang pengatur (**Gradient Annotator**) langsung di atas objek di kanvas untuk menggeser posisi awal/akhir gradasi, memutar sudutnya, menggeser *color stops*, mengatur *midpoint diamond*, dan menambah warna baru dengan double-click langsung di kanvas.
  * **Gradient on Stroke**: Jika gradasi diterapkan pada garis Stroke, tersedia 3 metode di panel Gradient: **Apply gradient within stroke**, **Apply gradient along stroke** (mengikuti aliran garis), dan **Apply gradient across stroke** (melintang dari tepi dalam ke tepi luar garis).

### 9.3 Gradient Mesh Tool (`U`)
* Mengklik di dalam objek vektor dengan **Mesh Tool (`U`)** (atau lewat *Object > Create Gradient Mesh...* dengan jumlah Rows $\times$ Columns dan *Appearance: Flat, To Center, To Edge*) akan mengubah objek menjadi **Mesh Object**.
* Setiap titik persimpangan garis jaring (**Mesh Point**) dan area di antara 4 titik (**Mesh Patch**) dapat dipilih dengan Mesh Tool atau Direct Selection Tool lalu diberi warna dan Opacity yang berbeda-beda untuk menciptakan pencahayaan fotorealistis 3D pada vektor (seperti menggambar buah, wajah, atau kilap logam).

### 9.4 Pattern Maker (Pattern Editing Mode)
* Memilih objek lalu menekan **Object > Pattern > Make** akan memasukkan kanvas ke **Pattern Editing Mode**:
  * Seluruh kanvas langsung menampilkan pengulangan ubin (*tiling preview*) secara live dengan tingkat peredupan (*Dim Copies to 50%*) yang bisa diatur.
  * Panel **Pattern Options** memungkinkan pemilihan **Tile Type**: *Grid*, *Brick by Row* (dengan Brick Offset $1/2, 1/3, 1/4$, dst.), *Brick by Column*, *Hex by Column*, dan *Hex by Row* (sarang lebah).
  * Pengaturan Width & Height ubin, *Size Tile to Art*, *H Spacing / V Spacing*, dan urutan tumpang tindih (*Overlap: Left in Front / Right in Front, Top in Front / Bottom in Front*).
  * Saat ditekan **Done**, pola tersebut langsung tersimpan sebagai Pattern Swatch baru di panel Swatches. Pola yang diterapkan pada objek bisa di-transformasi (diperkecil/diputar isinya saja tanpa memutar kotaknya) dengan mencentang **Transform Patterns** dan mematikan **Transform Objects** di dialog Scale/Rotate!

---

## 10. SYMBOLS & SYMBOL TOOLS

* **Panel Symbols (`Shift+Ctrl+F11`)**:
  * Mengubah objek atau ilustrasi menjadi **Symbol (`F8`)** dengan pilihan tipe *Dynamic Symbol* (mengizinkan perubahan warna fill/stroke pada sub-bagian *instance* menggunakan Direct Selection Tool tanpa memutus tautan dari bentuk master-nya!) atau *Static Symbol*.
  * Menggeser simbol dari panel ke kanvas membuat **Symbol Instance**. Mengedit master symbol (dengan double-click) akan memperbarui seluruh instance di semua artboard. Tombol **Break Link to Symbol** mengubah instance kembali menjadi objek vektor independen.
* **8 Symbolism Tools**:
  * **Symbol Sprayer (`Shift+S`)**: Menyemprotkan kumpulan instance simbol ke kanvas seperti cat semprot.
  * **Symbol Shifter** (menggeser posisi), **Symbol Scruncher** (merapatkan/merenggangkan jarak), **Symbol Sizer** (memperbesar/memperkecil ukuran), **Symbol Spinner** (memutar orientasi), **Symbol Stainer** (mewarnai secara bertahap), **Symbol Screener** (mengatur transparansi), dan **Symbol Styler** (menerapkan Graphic Style secara bertahap).

---

## 11. TIPOGRAFI PROFESIONAL & CREATE OUTLINES

* **7 Type Tools Lengkap**:
  1. **Type Tool (`T`)**: Klik satu kali untuk membuat **Point Type** (teks satu baris yang ikut membesar/mengecil jika bounding box-nya ditarik); klik-drag untuk membuat **Area Type** (kotak paragraf yang teksnya melakukan *word-wrap* otomatis saat kotaknya diubah ukurannya). Double-click pada bulatan handle di kanan kotak teks untuk mengubah Point Type $\leftrightarrow$ Area Type secara instan!
  2. **Area Type Tool**: Mengklik garis tepi objek vektor tertutup apa pun (lingkaran, bintang, poligon) untuk mengisi bagian dalam bentuk tersebut dengan paragraf teks!
  3. **Type on a Path Tool**: Mengklik kurva atau lingkaran apa pun untuk membuat teks mengalir mengikuti lekukan kurva tersebut, lengkap dengan **Start Bracket**, **End Bracket**, dan **Center Bracket** yang bisa digeser di sepanjang path untuk mengatur posisi teks atau membaliknya ke sisi seberang garis (*Flip*), serta *Type on a Path Options* (Effect: *Rainbow, Skew, 3D Ribbon, Stair Step, Gravity*; Align to Path: *Ascender, Descender, Center, Baseline*).
  4. **Vertical Type Tool**, **Vertical Area Type Tool**, dan **Vertical Type on a Path Tool** untuk penulisan vertikal.
  5. **Touch Type Tool (`Shift+T`)**: Memilih satu huruf/karakter individual di dalam kata lalu menggeser, memperbesar, atau memutar huruf tersebut secara visual dengan handle di kanvas, **namun seluruh kalimat tetap berupa teks hidup yang bisa diketik ulang**!
* **Panel Character (`Ctrl+T`), Paragraph (`Alt+Ctrl+T`), dan OpenType (`Alt+Shift+Ctrl+T`)**:
  * Font Family (termasuk Google Fonts + Upload Font Lokal TTF/OTF/WOFF), Font Style/Weight, Variable Font Axes sliders, Font Size, Leading (jarak baris), Kerning (Auto/Optical/Manual), Tracking (jarak antar huruf), Vertical & Horizontal Scale ($\%$), Baseline Shift, dan Character Rotation.
  * Transformasi kasus: *All Caps, Small Caps, Superscript, Subscript, Underline, Strikethrough*.
  * Paragraph: Alignment (Left, Center, Right, Justify with last line left/center/right/all), Indents (Left, Right, First Line), Space Before & Space After Paragraph, dan Hyphenation.
  * **Threaded Text (Linked Text Frames)**: Jika teks di dalam Area Type kepanjangan, muncul kotak merah kecil bertanda `+` (**Overset Text Port**) di kanan bawah. Mengklik port tersebut lalu mengklik di tempat lain (atau pada shape lain) akan mengalirkan sisa teks secara bersambung (*threaded text*) seperti di majalah!
  * **Text Wrap**: Memilih objek gambar/ilustrasi lalu mengaktifkan *Object > Text Wrap > Make* akan membuat teks paragraf di sekitarnya otomatis menghindar mengikuti kontur objek tersebut dengan jarak *Offset* yang bisa diatur.
* **Create Outlines (`Shift+Ctrl+O`)**:
  * Mengubah teks hidup menjadi kurva vektor bezier murni (`<Group>` berisi `<Compound Path>` untuk tiap huruf) sehingga titik-titik anchor hurufnya bisa dimodifikasi secara bebas dengan Direct Selection Tool!

---

## 12. MASKING, TRANSPARENCY, BLEND MODES & IMAGE TRACE

* **Clipping Mask (`Ctrl+7` Make / `Alt+Ctrl+7` Release)**:
  * Memilih dua atau lebih objek di mana **objek paling atas (Topmost Object)** berfungsi sebagai jendela pemotong (*Clipping Path*) bagi seluruh objek vektor atau foto di bawahnya.
  * Di dalam Clipping Group, pengguna masih bisa memilih hanya bingkai pemotongnya untuk diberi Stroke/Fill atau memilih hanya isinya lewat tombol **Edit Clipping Path** vs **Edit Contents** di Control Bar.
* **Panel Transparency (`Shift+Ctrl+F10`) & Opacity Mask**:
  * Mengatur **Blending Mode** (Normal, Darken, Multiply, Color Burn, Lighten, Screen, Color Dodge, Overlay, Soft Light, Hard Light, Difference, Exclusion, Hue, Saturation, Color, Luminosity) dan **Opacity (`0%` – `100%`)**.
  * **Opacity Mask (Luminance Mask)**: Klik tombol **Make Mask** di panel Transparency untuk membuat jendela mask kedua di sebelah thumbnail objek. Menggambar gradasi hitam-putih di dalam ruang Opacity Mask akan membuat objek asli memudar secara halus (putih = $100\%$ terlihat, hitam = $0\%$ transparan), dilengkapi checkbox **Clip** dan **Invert Mask**.
  * **Isolate Blending** (mencegah blend mode menembus ke luar grup) dan **Knockout Group** (membuat objek di dalam grup saling melubangi satu sama lain tanpa memperlihatkan tumpukan objek di bawahnya di dalam grup yang sama).
* **Image Trace (Panel Image Trace & Vectorization)**:
  * Saat gambar bitmap (PNG, JPG, WebP) ditempatkan di kanvas, tombol **Image Trace** muncul di Control Bar dan Panel Image Trace:
  * **Preset Cepat**: *High Fidelity Photo, Low Fidelity Photo, 3 Colors, 6 Colors, 16 Colors, Shades of Gray, Black and White Logo, Sketched Art, Silhouettes, Line Art, Technical Drawing*.
  * **Kontrol Parameter Detail**:
    * Mode: *Color, Grayscale, Black and White*.
    * Slider **Threshold** (untuk B&W) atau **Palette / Colors** (jumlah warna maksimal untuk Color/Grayscale).
    * Advanced: **Paths** (ketepatan kurva), **Corners** (ketajaman sudut), **Noise** (ukuran piksel minimum yang diabaikan), Method (*Abutting* potongan pas vs *Overlapping* bertumpuk), opsiCreate **Fills** / **Strokes**, dan checkbox sangat penting: **Ignore White** (otomatis membuang warna background putih sehingga hasil trace langsung transparan!).
  * Klik tombol **Expand** di Control Bar untuk mengubah hasil Image Trace menjadi grup path vektor murni yang siap diedit titik anchor dan warnanya.

---

## 13. ALIGN, DISTRIBUTE, PERSPECTIVE GRID, GRAPH, DAN MEASURING

* **Panel Align (`Shift+F7`)**:
  * **Align To**:
    1. *Align to Selection* (meratakan terhadap batas kumpulan objek terpilih).
    2. *Align to Key Object* (saat beberapa objek dipilih, **klik satu kali lagi pada salah satu objek** tanpa menekan Shift—objek tersebut akan mendapat garis tepi tebal sebagai **Key Object** yang tidak akan bergeser, sementara objek lain merapat atau berjarak tepat menggunakan nilai **Distribute Spacing (px/mm)** terhadap objek patokan tersebut!).
    3. *Align to Artboard* (meratakan ke tengah/tepi artboard aktif).
  * Mencakup Align Objects (Left, Horizontal Center, Right, Top, Vertical Center, Bottom), Distribute Objects, dan Distribute Spacing.
* **Perspective Grid (`Shift+P`) & Perspective Selection (`Shift+V`)**:
  * Menampilkan jaring perspektif **1-Point, 2-Point, atau 3-Point Perspective** di kanvas beserta *Plane Switching Widget* di pojok kiri atas (Left Grid, Horizontal Grid, Right Grid, No Active Grid) untuk menggambar atau menempelkan bangunan/teks secara presisi mengikuti titik hilang (*vanishing point*).
* **Graph Tools (`J` - 9 Tipe Grafik Vektor Data-Driven)**:
  * Mencakup **Column Graph (`J`)**, **Stacked Column**, **Bar**, **Stacked Bar**, **Line**, **Area**, **Scatter**, **Pie**, dan **Radar Graph Tool**.
  * Saat menarik area grafik di kanvas, otomatis terbuka **Graph Data Window** (tabel spreadsheet mini dengan tombol *Import CSV*, *Transpose Row/Column*, *Switch X/Y*, *Cell Style*, dan *Apply Checkmark*).
  * Grafik yang dihasilkan adalah grup vektor hidup (*Live Graph Object*): datanya bisa diedit ulang kapan saja via *Object > Graph > Data...* atau diganti tipenya via *Object > Graph > Type...* (lengkap dengan opsi *Value Axis*, *Legend*, *Drop Shadow*, dan *Column Design* menggunakan Symbol), sementara warnanya bisa dikustomisasi per batang/irisan dengan Direct Selection / Group Selection Tool!
* **Slice Tool (`Shift+K`) & Slice Selection Tool**:
  * Menggambar kotak pemotong (*User Slices* dengan nomor urut dan garis batas oranye/merah tipis) di atas kanvas atau memilih *Object > Slice > Make* dari batas objek terpilih untuk mengekspor potongan-potongan desain secara terpisah di *Save for Web* / *Export for Screens*.
* **Measure Tool, Eyedropper (`I`), dan Attributes**:
  * **Eyedropper (`I`)**: Menyalin seluruh atribut Appearance (Fill, Stroke, Efek, Karakter Teks) dari objek yang diklik ke objek terpilih. Tahan `Shift+klik` untuk mengambil hanya sampel warna RGB/CMYK dari titik piksel yang diklik dan menerapkannya ke Fill/Stroke yang sedang aktif.
  * **Measure Tool**: Mengukur jarak (D), selisih X/Y, dan sudut (A) di antara dua titik mana saja di kanvas dan menampilkannya di panel **Info (`F8`)**.

---

## 14. EXPORT ARTWORK (PRINT & DIGITAL) DAN FILE NATIVE (`.adloze`)

### 14.1 Export for Screens, Asset Export & Print PDF
* **Export for Screens (`Alt+Ctrl+E`)**:
  * Tab **Artboards**: Memilih artboard mana saja yang akan diekspor (All, atau Range misal `1-3, 5`), dengan daftar **Formats & Scales** yang bisa diekspor sekaligus dalam satu kali klik (misal mengekspor setiap artboard menjadi `1x PNG`, `2x PNG`, `3x PNG`, `SVG`, dan `PDF` sekaligus ke dalam subfolder terpisah!).
  * Tab **Assets & Slices (Panel Asset Export)**: Pengguna bisa menarik objek/ikon/logo individual ke dalam panel **Asset Export** atau memilih daftar **Slices** yang dibuat dengan Slice Tool (`Shift+K`), memberi nama masing-masing aset/slice, lalu mengekspor puluhan ikon atau potongan slice sekaligus dalam berbagai skala dan format tanpa perlu membuat artboard terpisah.
* **SVG Export Options (Presisi Kode Vektor)**:
  * Opsi Styling (*Inline Style, Internal CSS, Presentation Attributes*), Font (*SVG, Convert to Outlines*), Images (*Embed, Preserve*), Object IDs (*Layer Names, Minimal, Unique*), **Decimal Places** (presisi angka desimal $1$ sampai $7$), serta tombol **Show SVG Code** (melihat & menyalin kode `<svg>` langsung) dan **Minify**.
* **Print-Ready PDF Export**:
  * Menghasilkan dokumen PDF vektor murni (bukan gambar pecah), lengkap dengan opsi **Marks and Bleeds**: mencentang **Trim Marks** (garis potong sudut), **Registration Marks**, **Color Bars**, **Page Information**, dan **Use Document Bleed Settings** sehingga file PDF siap langsung dikirim ke percetakan profesional.
* **Save for Web (Legacy) (`Alt+Shift+Ctrl+S`)**:
  * Dialog pratinjau perbandingan 2-Up / 4-Up untuk mengoptimasi ukuran file PNG-24, PNG-8, JPEG, GIF, atau WebP beserta pengaturan transparansi, *Matte color*, ukuran piksel, dan opsi **Export All Slices / Selected Slices**.

### 14.2 File Project Native (`.adloze`)
* Menyimpan (`Ctrl+S`) dan membuka (`Ctrl+O` atau drag-and-drop) file berformat **`.adloze`** (arsip terkompresi berisi `manifest.json`, `document.json` dengan seluruh struktur artboard, unit, bleed, color mode, layers, sublayers, appearance stacks, live effects, swatches, global colors, brushes, symbols, graphic styles, guides, slices, graph data, serta folder `assets/` untuk gambar/font yang di-embed dan `preview.png`).
* **Lossless Round-Trip**: Menyimpan ke `.adloze` lalu membukanya kembali mengembalikan $100\%$ kondisi dokumen secara identik termasuk Compound Shapes, Live Corners, Appearance berlapis, Opacity Masks, dan posisi Artboard.
* Mendukung **Import / Place (`Shift+Ctrl+P`)** untuk memasukkan file gambar, SVG eksternal (langsung di-parse menjadi pohon layer dan path vektor yang bisa diedit!), atau menggabungkan file `.adloze` lain ke dalam dokumen aktif.

---

## 15. SHORTCUT LENGKAP STANDAR ADOBE ILLUSTRATOR

Seluruh shortcut bekerja identik dengan Adobe Illustrator di Windows (`Ctrl`, `Alt`) dan macOS (`Cmd`, `Option`), otomatis melakukan `preventDefault()` agar tidak bentrok dengan shortcut bawaan browser, tidak terpanggil saat sedang mengetik di dalam input teks/kotak teks, dan dapat dikustomisasi lewat **Edit > Keyboard Shortcuts (`Alt+Shift+Ctrl+K`)**:

### 15.1 Tools Shortcuts
* `V` : Selection Tool
* `A` : Direct Selection Tool
* `Y` : Magic Wand Tool
* `Q` : Lasso Tool
* `P` : Pen Tool (`+` Add Anchor, `-` Delete Anchor, `Shift+C` Anchor Point Tool)
* `Shift+~` : Curvature Tool
* `T` : Type Tool (`Shift+T` Touch Type Tool)
* `\` : Line Segment Tool
* `M` : Rectangle Tool
* `L` : Ellipse Tool
* `B` : Paintbrush Tool
* `Shift+B` : Blob Brush Tool
* `N` : Pencil Tool
* `Shift+E` : Eraser Tool
* `C` : Scissors Tool
* `R` : Rotate Tool
* `O` : Reflect Tool
* `S` : Scale Tool
* `Shift+W` : Width Tool
* `Shift+R` : Warp Tool
* `E` : Free Transform Tool
* `Shift+M` : Shape Builder Tool
* `K` : Live Paint Bucket (`Shift+L` Live Paint Selection)
* `Shift+P` : Perspective Grid Tool (`Shift+V` Perspective Selection)
* `U` : Mesh Tool
* `G` : Gradient Tool
* `I` : Eyedropper Tool
* `W` : Blend Tool
* `Shift+S` : Symbol Sprayer Tool
* `J` : Column Graph Tool (dan sub-tool grafik lainnya)
* `Shift+O` : Artboard Tool
* `Shift+K` : Slice Tool
* `H` : Hand Tool (atau tahan `Spasi` kapan saja)
* `Z` : Zoom Tool (`Ctrl++` / `Ctrl+-` / `Ctrl+Alt+Scroll`)

### 15.2 Color, Drawing Modes & Operasi Objek
* `X` : Toggle fokus aktif antara Fill dan Stroke
* `Shift+X` : Swap (tukar) warna antara Fill dan Stroke
* `D` : Reset ke Default Fill (Putih) dan Stroke (Hitam $1\text{ pt}$)
* `<` (Koma) : Terapkan Solid Color terakhir ke Fill/Stroke aktif
* `>` (Titik) : Terapkan Gradient terakhir ke Fill/Stroke aktif
* `/` (Slash) : Set Fill atau Stroke aktif menjadi **None (Transparan)**
* `Shift+D` : Siklus Drawing Modes (Draw Normal $\rightarrow$ Draw Behind $\rightarrow$ Draw Inside)
* `F` : Siklus Screen Modes
* `Ctrl+G` / `Shift+Ctrl+G` : Group / Ungroup
* `Ctrl+2` / `Alt+Ctrl+2` : Lock Selection / Unlock All
* `Ctrl+3` / `Alt+Ctrl+3` : Hide Selection / Show All
* `Ctrl+D` : Transform Again (Duplikasi / Ulangi Transformasi)
* `Ctrl+J` : Join Paths (`Alt+Ctrl+J` Average)
* `Ctrl+7` / `Alt+Ctrl+7` : Make / Release Clipping Mask
* `Ctrl+8` / `Alt+Shift+Ctrl+8` : Make / Release Compound Path
* `Shift+Ctrl+O` : Create Outlines (pada Teks)
* `Ctrl+C`, `Ctrl+X`, `Ctrl+V` : Copy, Cut, Paste
* `Ctrl+F` : **Paste in Front** (menempel tepat di posisi koordinat yang sama persis di atas objek terpilih!)
* `Ctrl+B` : **Paste in Back** (menempel tepat di posisi yang sama persis di belakang objek terpilih!)
* `Shift+Ctrl+V` : **Paste in Place** (menempel di koordinat yang sama pada artboard aktif)
* `Alt+Shift+Ctrl+V` : **Paste on All Artboards**
* `Ctrl+]` / `Ctrl+[` / `Shift+Ctrl+]` / `Shift+Ctrl+[` : Bring Forward / Send Backward / Bring to Front / Send to Back

### 15.3 View, Guides & Panels
* `Ctrl+Y` : Toggle **Preview vs Outline (Wireframe) View**
* `Ctrl+0` : Fit Active Artboard in Window
* `Alt+Ctrl+0` : Fit All Artboards in Window
* `Ctrl+1` : Actual Size ($100\%$)
* `Ctrl+R` : Show / Hide Rulers
* `Ctrl+U` : Toggle Smart Guides
* `Ctrl+'` : Show / Hide Grid (`Shift+Ctrl+'` Snap to Grid)
* `Ctrl+;` : Show / Hide Guides (`Alt+Ctrl+;` Lock Guides, `Ctrl+5` Make Guides dari objek)
* `Shift+Ctrl+D` : Show / Hide Transparency Grid
* `Shift+Ctrl+B` : Show / Hide Bounding Box
* `Ctrl+H` : Show / Hide Edges (menyembunyikan garis seleksi anchor tanpa melepas seleksi agar bisa melihat warna objek dengan bersih)
* `Tab` : Sembunyikan / Tampilkan seluruh Panel dan Toolbar sekaligus (tampilan kanvas penuh bersih)
* `Shift+Tab` : Sembunyikan / Tampilkan seluruh Panel kecuali Toolbar dan Control Bar.

---

## 16. KEANDALAN, PERFORMA, DAN EDGE CASES WAJIB

* **Outline View (`Ctrl+Y`) Presisi Tinggi**: Saat menekan `Ctrl+Y`, seluruh warna fill, stroke tebal, dan efek disembunyikan sementara dan hanya menampilkan garis kerangka matematika vektor tipis ($1\text{ px}$) beserta titik silang pusat objek, sehingga pengguna bisa memilih objek yang tersembunyi di belakang objek lain dengan sangat mudah.
* **Penanganan Operasi Geometri Ekstrem**:
  * Melakukan Pathfinder / Shape Builder pada path terbuka, objek yang tidak saling bersentuhan, atau objek dengan satu titik tunggal tidak boleh membuat aplikasi *crash*—berikan peringatan kontekstual yang informatif di bagian bawah layar dan jaga objek asli tetap aman di dalam riwayat Undo.
  * Mengubah teks ke Outline (`Shift+Ctrl+O`), Expand Appearance, dan Rasterize wajib tercatat sebagai satu langkah utuh di dalam Undo (`Ctrl+Z`) sehingga pengguna bisa membatalkannya kapan saja.
* **Performa 60fps & Autosave**:
  * Kanvas menggunakan *spatial indexing (R-Tree / Bounding Volume Hierarchy)* dan *viewport culling* sehingga dokumen dengan ribuan titik anchor vektor tetap berjalan mulus 60fps saat di-pan dan di-zoom.
  * Autosave ke `IndexedDB` berjalan di background dengan pengamanan pemulihan sesi (*Crash Recovery*) jika tab tertutup tidak sengaja.

---

## 17. MANDAT EKSEKUSI: ZERO PLACEHOLDER & FULL PRODUCTION QUALITY

1. **Dilarang Keras Membuat Placeholder / Mockup Kosong**:
   * **TIDAK BOLEH** ada tombol, menu item, tool, atau panel yang hanya menampilkan `alert("Coming soon")`, `console.log`, atau sekadar UI pajangan tanpa logika yang terhubung ke kanvas.
   * Setiap tool di Toolbar, setiap operasi di Pathfinder/Shape Builder, setiap item di Appearance Stack, setiap opsi di Control Bar, dan setiap jalur Export (`SVG`, `PDF` dengan Bleed/Crop Marks, `PNG/JPG/WebP`, serta file project `.adloze`) **wajib terimplementasi penuh secara fungsional dan matematis**.
2. **Modularitas & Keterbacaan Kode**:
   * Pisahkan file berdasarkan domain fungsional (jangan menumpuk puluhan ribu baris di dalam satu file monolitik). Gunakan komponen UI yang *reusable*, *type-safe* (TypeScript strict tanpa error kompilasi), dan arsitektur state/command yang bersih.
3. **Verifikasi Build & End-to-End**:
   * Pastikan seluruh dependensi terinstal dengan bersih, aplikasi berjalan tanpa *runtime error* maupun *build error*, serta tampilan visualnya benar-benar merepresentasikan kemewahan dan kepadatan ergonomi **Adobe Illustrator CC** secara autentik.