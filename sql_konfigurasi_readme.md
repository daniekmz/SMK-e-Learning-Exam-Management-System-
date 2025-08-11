# 🗄️ SQL Konfigurasi Supabase untuk Aplikasi SMK Veteran 1 Sukoharjo

Dokumentasi ini berisi skrip SQL untuk membuat **database schema** pada Supabase yang digunakan oleh aplikasi **Sistem Manajemen Pembelajaran & Ujian**.

---

## 📂 Struktur Database

### 1. `teacher_passwords`
Menyimpan password guru untuk login ke dashboard guru.

```sql
create table if not exists public.teacher_passwords (
    id uuid primary key default gen_random_uuid(),
    password text not null,
    created_at timestamp with time zone default now()
);
```

**Kolom:**
- `id` → ID unik (UUID)
- `password` → Password guru
- `created_at` → Tanggal pembuatan data

---

### 2. `files`
Menyimpan metadata file dan folder yang diunggah guru/siswa.

```sql
create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    size bigint,
    type text,
    path text unique not null,
    url text,
    is_folder boolean default false,
    parent_path text default '/',
    created_by text, -- 'teacher' atau 'student'
    uploaded_by text, -- khusus student
    created_at timestamp with time zone default now()
);
```

**Kolom:**
- `id` → ID unik
- `name` → Nama file/folder
- `size` → Ukuran file (bytes)
- `type` → MIME type
- `path` → Lokasi file di storage
- `url` → URL publik file
- `is_folder` → True jika folder
- `parent_path` → Path folder induk
- `created_by` → Pembuat (guru/siswa)
- `uploaded_by` → Nama uploader (siswa)
- `created_at` → Tanggal unggah

---

### 3. `exams`
Menyimpan daftar ujian yang dibuat oleh guru.

```sql
create table if not exists public.exams (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    duration int not null, -- durasi ujian (menit)
    created_at timestamp with time zone default now()
);
```

**Kolom:**
- `id` → ID ujian
- `title` → Judul ujian
- `description` → Deskripsi ujian
- `duration` → Durasi ujian (menit)
- `created_at` → Tanggal dibuat

---

### 4. `questions`
Menyimpan soal ujian.

```sql
create table if not exists public.questions (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid references public.exams(id) on delete cascade,
    question text not null,
    type text default 'multiple-choice',
    options jsonb, -- ["A", "B", "C", "D"]
    correct_answer text,
    points int default 5,
    created_at timestamp with time zone default now()
);
```

**Kolom:**
- `id` → ID soal
- `exam_id` → ID ujian terkait
- `question` → Teks pertanyaan
- `type` → Jenis soal (default multiple-choice)
- `options` → Pilihan jawaban (JSON)
- `correct_answer` → Jawaban benar
- `points` → Poin soal
- `created_at` → Tanggal dibuat

---

### 5. `exam_results`
Menyimpan hasil ujian siswa.

```sql
create table if not exists public.exam_results (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid references public.exams(id) on delete cascade,
    student_name text not null,
    student_class text not null,
    score int default 0,
    answers jsonb,
    submitted_at timestamp with time zone default now()
);
```

**Kolom:**
- `id` → ID hasil
- `exam_id` → ID ujian
- `student_name` → Nama siswa
- `student_class` → Kelas siswa
- `score` → Nilai ujian
- `answers` → Jawaban siswa (JSON)
- `submitted_at` → Waktu submit

---

## 🔗 Relasi Tabel
- `exams` **1 → n** `questions`
- `exams` **1 → n** `exam_results`

---

## ⚙️ Langkah Import ke Supabase
1. Buka **Supabase Dashboard**
2. Pilih **SQL Editor**
3. Paste seluruh skrip SQL di atas
4. Klik **Run** untuk membuat tabel

---

## 📌 Catatan
- Gunakan **Bucket Storage Supabase** bernama `files` untuk menyimpan file materi/tugas.
- Pastikan aturan RLS (Row Level Security) sesuai kebutuhan keamanan.
- Tambahkan index jika data besar untuk meningkatkan performa query.

---
