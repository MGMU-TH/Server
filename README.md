# IT Operations Center

เว็บไซต์จำลองศูนย์ปฏิบัติการ IT สร้างด้วย HTML, CSS และ JavaScript แบบ Static เหมาะสำหรับนำขึ้น GitHub Pages และใช้กับโดเมนของคุณ

## ไฟล์ในโปรเจกต์

- `index.html` — โครงสร้างหน้าเว็บและเมนู
- `style.css` — รูปแบบหน้าตา Dark Mode และการรองรับหน้าจอ
- `script.js` — ระบบจำลอง Server, Restart, Switch Connection, Security, Incidents และ Logs

## วิธีเปิดใช้งานในเครื่อง

1. ดาวน์โหลดและแตกไฟล์ ZIP
2. เปิด `index.html` ในเว็บเบราว์เซอร์
3. ไม่จำเป็นต้องติดตั้ง Backend หรือฐานข้อมูล

## วิธีนำขึ้น GitHub Pages

1. สร้าง Repository บน GitHub
2. อัปโหลดไฟล์ทั้ง 4 ไฟล์นี้ไว้ในโฟลเดอร์หลัก (root) ของ Repository
3. เข้า **Settings → Pages**
4. ในส่วน Build and deployment เลือก **Deploy from a branch**
5. เลือก Branch `main` และ Folder `/ (root)` แล้วกด Save
6. รอ GitHub Pages เผยแพร่เว็บไซต์ จากนั้นนำ URL ไปผูกกับโดเมนของคุณได้ที่ Settings → Pages → Custom domain

> หากใช้โดเมนของตัวเอง ให้ตั้งค่า DNS ตามค่าที่ GitHub Pages แสดงในหน้า Custom domain และเปิด Enforce HTTPS เมื่อพร้อมใช้งาน

## ระบบที่มีในเวอร์ชันนี้

- Overview: ภาพรวม Server และกิจกรรมล่าสุด
- Server Room: 3 Racks × 5 Servers รวม 15 เครื่อง
- Restart Server: จำลองการ Restart และคืนสถานะ Online
- Switch Connection: จำลองการสลับเส้นทาง Primary Fiber, Secondary Fiber และ Backup Wireless
- Security Center: สร้างเหตุการณ์จำลองทุก 60 วินาที
- Defense Console: รหัส 6 หลักและแป้นตัวเลขเสมือน กดลบ/ล้าง/ตรวจสอบได้
- Incident Management: แสดงเหตุการณ์ที่กำลังดำเนินการและแก้ไขแล้ว
- System Logs: บันทึกการทำงาน พร้อมตัวเลือกเคลียร์ Logs
- เปิด/ปิดเสียง Beep และ Animation
- Dark Mode และ Responsive สำหรับโทรศัพท์ แท็บเล็ต และคอมพิวเตอร์

## หมายเหตุสำคัญ

นี่เป็น **Simulation เท่านั้น** ไม่มีการเชื่อมต่อ ควบคุม Restart หรือเปลี่ยนเส้นทางเครือข่ายของ Server จริง และไม่มีการโจมตีระบบจริง

ข้อมูลสถานะเก็บไว้ใน `localStorage` ของเบราว์เซอร์ที่เปิดใช้งาน จึงไม่ได้ซิงก์ข้ามอุปกรณ์หรือผู้ใช้ และการล้างข้อมูลเว็บไซต์ในเบราว์เซอร์อาจทำให้ข้อมูลจำลองหายไปได้

ระบบสุ่มเหตุการณ์ทำงานขณะที่หน้าเว็บเปิดอยู่เท่านั้น เมื่อปิดหน้าเว็บ ตัวจับเวลาจะหยุด
