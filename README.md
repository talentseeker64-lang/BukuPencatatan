<div align="center">
Secara sederhana, aplikasi ini adalah Sistem Pencatatan Pengadaan Barang/Jasa & Buku Besar Utang (Accounts Payable Ledger) yang dilindungi oleh Blockchain Hyperledger Fabric agar data transaksi keuangan negara/perusahaan mustahil dimanipulasi secara diam-diam.
Berikut adalah cara kerja aplikasi ini dari hulu ke hilir:
1. Alur Kerja Siklus Transaksi (End-to-End)
code
Code
[1. Buat PO] ──► [2. Terima Barang] ──► [3. Terbit Tagihan Utang] ──► [4. Rantai Persetujuan] ──► [5. Pencairan SP2D] ──► [6. Pelunasan Lunas]
  (PO ISSUED)     (Surat Jalan/BAST)       (Accounts Payable)             (4 Level Pejabat)          (Bank / KPPN)             (SETTLED)
Pembuatan Purchase Order (PO):
Pejabat Pengadaan menerbitkan PO kepada Vendor rekanan.
Nilai uang dihitung otomatis dengan presisi tinggi (mencegah selisih pembulatan).
Penerimaan Barang (Goods Receipt / BAST):
Saat barang fisik tiba dari vendor, petugas gudang/penerima mencatat nomor Surat Jalan / Berita Acara Serah Terima (BAST).
Dokumen diverifikasi fisik bahwa barang yang datang sesuai spesifikasi dan tidak rusak.
Pengakuan Utang (Accounts Payable Created):
Vendor menerbitkan Faktur (Invoice).
Sistem mencatat tagihan ini ke dalam Buku Besar Utang dan langsung membuat segel digital (kriptografis SHA-256) yang dikirim ke Blockchain.
Persetujuan Bertingkat (Chain of Approval):
Sebelum uang bisa dicairkan, tagihan harus disetujui berurutan oleh:
Pejabat Pengadaan (Kesesuaian spesifikasi & fisik)
PPK / Pejabat Pembuat Komitmen (Kesesuaian komitmen anggaran)
Finance / Bendahara (Kelengkapan dokumen pajak & faktur)
Pejabat Berwenang (Otorisasi perintah bayar)
Pencairan Dana (Payment Initiated):
Bagian keuangan menerbitkan nomor SP2D (Surat Perintah Pencairan Dana) atau referensi transfer perbankan.
Pelunasan Permanen (Settlement):
Dana berpindah ke vendor, status berubah menjadi SETTLED (Lunas) secara permanen dan tercatat abadi di buku besar blockchain.
2. Fitur Siklus Akumulasi 4 Bulan (Januari – April)
Sistem ini memiliki simulasi pembukuan termin 4 bulanan:
Bulan 1 (Januari): Utang baru dari Vendor A (Rp100 Juta) & Vendor B (Rp50 Juta) 
 Total Rp150 Juta.
Bulan 2 (Februari): Tambahan tagihan PO-003 & PO-004 
 Akumulasi Rp350 Juta.
Bulan 3 (Maret): Tambahan tagihan PO-005 
 Akumulasi Rp550 Juta.
Bulan 4 (April): Jendela Pelunasan (Settlement Window). Bagian Keuangan dapat mengeksekusi pelunasan batch sekaligus untuk seluruh kewajiban yang telah disetujui.
3. Mengapa Menggunakan Blockchain? (Keunggulan Anti-Korupsi & Anti-Fraud)
Pada aplikasi tradisional, jika ada oknum (administrator database atau hacker) yang mengubah angka di database relasional (misalnya mengubah nilai tagihan dari Rp100 Juta menjadi Rp150 Juta untuk mark-up dana):
Di aplikasi biasa, perubahan ini seringkali tidak terdeteksi jika log audit internal dihapus.
Di aplikasi ini (Tamper-Evident):
Setiap tagihan memiliki Hash Dokumen yang tersimpan permanen di blok Hyperledger Fabric.
Begitu angka di database diubah 1 rupiah pun, nilai hash lokalnya akan berubah drastis.
Sistem dan Auditor langsung membunyikan alarm:
</div>


Ketika Anda membuat tagihan utang (Accounts Payable) atau mencatat penerimaan barang (BAST/Surat Jalan), tidak ada kolom input harga.
Sistem mengambil nilai harga secara otomatis dari data transaksi Purchase Order (PO) yang sudah disepakati sebelumnya di dalam database.
Rumus alir data:
Nilai total tagihan, mata uang, dan rincian nominal dihitung secara internal oleh sistem (server-side calculation) dari kontrak PO asal, bukan diketik bebas oleh petugas tagihan atau bagian keuangan.
2. Mengapa Didesain Seperti Ini? (Prinsip Integritas Keuangan)
Jika petugas bagian penagihan atau keuangan diperbolehkan mengetik manual harga di tahap penagihan/pelunasan:
Rentan Salah Ketik (Human Error): Selisih angka antara pesanan awal dan tagihan.
Rentan Kecurangan (Mark-up / Invoice Fraud): Oknum bisa sengaja mengetik angka tagihan yang lebih besar daripada harga pesanan yang disepakati di awal.
Dengan mengunci nilai harga agar selalu ditarik langsung dari objek transaksi PO di database, sistem menjamin bahwa tagihan yang timbul 100% konsisten dengan pesanan barang yang sah.
3. Lalu Bagaimana dengan Pembuatan PO di Awal?
Hanya pada saat penerbitan Purchase Order awal (menu Purchase Orders 
 Buat PO Baru), Pejabat Pengadaan memilih item barang/jasa beserta kuantitas dan harga satuan sesuai kontrak pengadaan.
Begitu PO tersebut diterbitkan (ISSUED):
Total nominal dikonversi ke satuan terkecil (minor units/sen integer).
Nilai tersebut disegel ke blockchain dengan event PO_ISSUED.
Sejak detik itu, angka harga terkunci permanen. Tahap berikutnya (Penerimaan Barang 
 Tagihan Utang 
 Persetujuan 
 SP2D 
 Pelunasan) hanya membaca dan meneruskan nilai transaksi tersebut tanpa ada input manual nominal lagi.
4. Pembuktian di Fitur "Tamper Lab"
Karakteristik ini juga yang menjadi dasar fitur Tamper Lab:
Karena harga tidak diinput manual melainkan dibaca dari record transaksi database, jika seseorang mencoba membobol database dan mengubah variabel nominal tersebut secara sepihak, sistem langsung mendeteksi bahwa hash transaksi di database tidak lagi cocok dengan hash asli yang disegel di blockchain.


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
