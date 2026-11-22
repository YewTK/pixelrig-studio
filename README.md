# PixelRig Studio

เครื่องมือ rig / อนิเมชัน / วาดพิกเซล สำหรับตัวละคร 2D · 2.5D · Pixel แล้วส่งออกไป Godot, Unity, Roblox
คู่มือการใช้งานอยู่ที่ [pixelrig/README.md](pixelrig/README.md) · คู่มือสำหรับ Claude อยู่ที่ [pixelrig/CLAUDE.md](pixelrig/CLAUDE.md)

## ใช้ในเครื่อง
- ง่ายสุด: ดับเบิลคลิก `pixelrig/index.html`
- แบบเว็บเซิร์ฟเวอร์ (ทำให้ติดตั้งเป็นแอปและใช้ออฟไลน์ได้): ในโฟลเดอร์นี้รัน `python -m http.server 8765 --directory pixelrig` แล้วเปิด http://localhost:8765

## ติดตั้งเป็นแอป (PWA)
เปิดผ่านเว็บ (http/https) ใน Chrome หรือ Edge แล้วกดไอคอน "ติดตั้ง" ในแถบที่อยู่ จะได้แอปแยกหน้าต่าง ใช้ออฟไลน์ได้
งานทั้งหมด (ตัวละคร ท่า งานวาด การตั้งค่า) เก็บในเบราว์เซอร์ของเครื่องนั้น ย้ายเครื่องด้วยปุ่ม "ส่งออก/นำเข้าโปรเจกต์" ในแท็บตั้งค่า

## ขึ้นเว็บฟรี (ไม่ต้องมี server หรือ database)
ไม่มีขั้นตอน build: โฟลเดอร์ที่ต้องเผยแพร่คือ `pixelrig/`

| ที่ไหน | ทำอย่างไร |
|---|---|
| **GitHub Pages** | push โปรเจกต์ขึ้น GitHub (branch `main`) · Settings → Pages → Source: **GitHub Actions** · ไฟล์ `.github/workflows/deploy-pages.yml` จะเผยแพร่ให้เองทุกครั้งที่ push |
| **Cloudflare Pages** | Workers & Pages → Create → Pages → เชื่อม repo · Build command: (เว้นว่าง) · Build output directory: `pixelrig` · หรือลากโฟลเดอร์ `pixelrig` ไปวางในหน้า "Upload assets" |
| **Netlify** | เชื่อม repo (ใช้ค่าใน `netlify.toml`) หรือลากโฟลเดอร์ `pixelrig` ไปที่ app.netlify.com/drop |

## เมื่อไรต้องมี server / database
ต้องมีเฉพาะเมื่ออยากได้ บัญชีผู้ใช้ · เก็บงานบนคลาวด์ข้ามเครื่องอัตโนมัติ · แชร์งานกับทีม
ทางที่ง่ายสุดคือ Supabase (database + ล็อกอิน + เก็บไฟล์ มีระดับฟรี) หรือ Cloudflare D1 + R2 ต่อจากเว็บ static เดิมได้โดยไม่ต้องเขียน server เอง

## หมายเหตุ
- ถ้าเพิ่ม/ลบไฟล์ใน `pixelrig/src` ให้แก้รายการ `SHELL` และเลขเวอร์ชัน `CACHE` ใน `pixelrig/sw.js` ด้วย
- `.claude/launch.json` คือคำสั่งเปิดเซิร์ฟเวอร์ทดสอบสำหรับ Claude Code
