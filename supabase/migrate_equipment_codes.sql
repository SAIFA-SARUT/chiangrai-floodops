-- ย้ายฐานข้อมูลเดิมไปใช้รหัสอุปกรณ์ 1803-0001
-- รันครั้งเดียวใน Supabase SQL Editor หลังสำรองข้อมูลแล้ว
begin;

alter table public.organizations drop constraint if exists organizations_name_key;
alter table public.organizations add column if not exists official_code text;
alter table public.organizations add column if not exists short_code text;
alter table public.equipment add column if not exists legacy_code text;

create temporary table _org_registry (
  id uuid primary key,
  official_code text not null,
  short_code text not null,
  name text not null,
  district text not null
) on commit drop;

insert into _org_registry(id,official_code,short_code,name,district) values
  ('1e642ff7-e7e1-5f11-a09b-def440189c4d','06571803','1803','อบต.หนองป่าก่อ','ดอยหลวง'),
  ('679df726-dd19-5b39-8330-699342c863b3','06571801','1801','อบต.โชคชัย','ดอยหลวง'),
  ('a75b8ea1-87d6-51e6-809c-5943a7b34658','06571802','1802','อบต.ปงน้อย','ดอยหลวง'),
  ('aa2fe1ac-f7ca-5c3d-94c0-a5cec0a50f31','05571704','1704','ทต.ป่าซาง','เวียงเชียงรุ้ง'),
  ('9323a977-2118-532c-a474-424663bb5191','05571702','1702','ทต.ดงมหาวัน','เวียงเชียงรุ้ง'),
  ('69d2e56d-473e-57bf-92a5-14b49fd0e5f7','06571703','1703','อบต.ทุ่งก่อ','เวียงเชียงรุ้ง'),
  ('39eb3bc8-fde6-568e-8899-13179e66dab4','05571701','1701','ทต.บ้านเหล่า','เวียงเชียงรุ้ง'),
  ('561b200d-e052-5707-908d-5ceff5881d11','06571605','1605','อบต.โป่งแพร่','แม่ลาว'),
  ('b2cff829-ffdd-51d9-a93e-a6cca5ab8a5d','06571607','1607','อบต.ป่าก่อดำ','แม่ลาว'),
  ('e8836eec-264e-5093-af2e-71ec94a222ed','05571602','1602','ทต.ป่าก่อดำ','แม่ลาว'),
  ('b2f59629-b3f4-5279-94d4-4ee4776bb292','06571606','1606','อบต.บัวสลี','แม่ลาว'),
  ('db65b982-0f50-5035-bc9e-a78727e01e54','06571604','1604','อบต.จอมหมอกแก้ว','แม่ลาว'),
  ('6454058c-f77b-55f8-bb8f-21666f3f121b','05571601','1601','ทต.ดงมะดะ','แม่ลาว'),
  ('8eb1e1bd-7614-5feb-96f5-aecedfe22817','05571603','1603','ทต.แม่ลาว','แม่ลาว'),
  ('833da127-9980-54e0-b425-bd3505c34eb8','06571501','1501','อบต.แม่ฟ้าหลวง','แม่ฟ้าหลวง'),
  ('1b6c4bdd-9d43-5f22-988a-e82f2a611d74','06571502','1502','อบต.แม่สลองนอก','แม่ฟ้าหลวง'),
  ('470a8ef3-e88a-59f9-b112-8f93b3ad1e65','06571504','1504','อบต.แม่สลองใน','แม่ฟ้าหลวง'),
  ('53f2065f-3e60-5564-85fa-b42b2b3a36ce','06571503','1503','อบต.เทอดไทย','แม่ฟ้าหลวง'),
  ('ebeb887c-de7a-5540-92cc-5244d5c48828','05571403','1403','ทต.ยางฮอม','ขุนตาล'),
  ('30572ca4-1e25-5a26-90f4-ebd574a03ba3','05571402','1402','ทต.ป่าตาล','ขุนตาล'),
  ('9a926c1c-a5fd-51dc-8e7e-7ad18729bee9','06571404','1404','อบต.ต้า','ขุนตาล'),
  ('ad52d18e-1a1c-5633-a2e2-137299cdb89c','05571401','1401','ทต.บ้านต้า','ขุนตาล'),
  ('5b3f5825-8c42-5d19-9bd9-18be65e7fffc','05571303','1303','ทต.ท่าข้าม','เวียงแก่น'),
  ('ab02419c-75e5-5f34-bde5-835decb2b9e3','05571302','1302','ทต.หล่ายงาว','เวียงแก่น'),
  ('a66ce14e-2bd3-5e8a-af39-c47d993acbf9','06571304','1304','อบต.ปอ','เวียงแก่น'),
  ('965d9f13-71c2-5bf0-9a8c-f8b97f209993','05571301','1301','ทต.ม่วงยาย','เวียงแก่น'),
  ('d07c7307-d5c9-5dcb-9613-5ecd39f58d58','06571204','1204','อบต.ตาดควัน','พญาเม็งราย'),
  ('1db5cd31-8d03-519d-8284-773ce035bd86','05571201','1201','ทต.เม็งราย','พญาเม็งราย'),
  ('826f65ac-62c6-5094-a0b1-b36a63c16850','05571202','1202','ทต.พญาเม็งราย','พญาเม็งราย'),
  ('7b49f76c-e1bf-5bad-8d54-6a702dc46fe6','05571203','1203','ทต.ไม้ยา','พญาเม็งราย'),
  ('35687423-bca5-55ab-88f6-0098d840c87e','06571205','1205','อบต.แม่ต๋ำ','พญาเม็งราย'),
  ('2747b25a-e5fa-52a7-8afc-460413de60e8','06571206','1206','อบต.แม่เปา','พญาเม็งราย'),
  ('818346aa-a2f7-5582-914c-acc3c1a58ddd','06571106','1106','อบต.แม่เจดีย์ใหม่','เวียงป่าเป้า'),
  ('bf6e1b24-34b1-52b1-bf04-7ceafafdddb3','06571109','1109','อบต.แม่เจดีย์','เวียงป่าเป้า'),
  ('d29d4c8b-860a-5e11-879b-6624e90a8ace','05571101','1101','ทต.แม่ขะจาน','เวียงป่าเป้า'),
  ('920a0225-0479-5668-96e1-09dc1f52f342','05571104','1104','ทต.เวียงกาหลง','เวียงป่าเป้า'),
  ('b94f89cd-9d72-5720-848f-f6d03113ce99','05571103','1103','ทต.ป่างิ้ว','เวียงป่าเป้า'),
  ('726cd646-58ac-5a09-b9c3-a5182282848c','06571105','1105','อบต.บ้านโป่ง','เวียงป่าเป้า'),
  ('0ad06e5c-81ea-569c-857e-7be7765d55ad','06571107','1107','อบต.เวียง','เวียงป่าเป้า'),
  ('2712d1c1-6b2f-5b35-a0d2-f22810e7b751','05571102','1102','ทต.เวียงป่าเป้า','เวียงป่าเป้า'),
  ('d513eb44-a8a7-5331-9b27-e49e89737f72','06571108','1108','อบต.สันสลี','เวียงป่าเป้า'),
  ('bb490f96-5125-50d2-89d3-3c62a8d05a6c','06571008','1008','อบต.เจดีย์หลวง','แม่สรวย'),
  ('06eba813-2130-50e3-a6ac-0884e19e1505','05571002','1002','ทต.เจดีย์หลวง','แม่สรวย'),
  ('aa808a1b-6d1d-58b7-b25c-41e6c1a815b1','06571006','1006','อบต.วาวี','แม่สรวย'),
  ('f824acae-fb93-5d3c-a8e4-f34d33eac4de','06571009','1009','อบต.ท่าก๊อ','แม่สรวย'),
  ('6a9b4aaa-9d5f-5357-82b9-4a53fea03e0b','06571007','1007','อบต.ศรีถ้อย','แม่สรวย'),
  ('8b15de93-e282-589b-a1f8-c2d14daf7d03','06571004','1004','อบต.แม่พริก','แม่สรวย'),
  ('103c92c5-669b-56d8-b2d5-e8e09c1a9704','06571005','1005','อบต.ป่าแดด','แม่สรวย'),
  ('be578757-47f1-5efe-8248-cefaeedb9ea9','05571003','1003','ทต.เวียงสรวย','แม่สรวย'),
  ('403fcc6b-b55d-58c9-9bdd-7625357dc764','05571001','1001','ทต.แม่สรวย','แม่สรวย'),
  ('29572bdd-bc5d-5209-bf7a-eb0d78cee194','06570906','0906','อบต.โป่งงาม','แม่สาย'),
  ('c371d21b-305e-5a58-8ddd-271f504e06e7','06570909','0909','อบต.บ้านด้าย','แม่สาย'),
  ('5771742f-120d-54a5-9e05-cb037b023b39','05570903','0903','ทต.เวียงพางคำ','แม่สาย'),
  ('c276a21f-f4cc-5b28-ada6-f1c3d034194f','06570908','0908','อบต.ศรีเมืองชุม','แม่สาย'),
  ('b42c02ba-76ff-5a00-a074-d9705dc4beb9','06570907','0907','อบต.โป่งผา','แม่สาย'),
  ('73ca93c3-f7ef-5497-8ca5-44e3f4136015','06570905','0905','อบต.เกาะช้าง','แม่สาย'),
  ('5f1d0272-fe92-537b-8523-a0da76c90982','06570910','0910','อบต.ห้วยไคร้','แม่สาย'),
  ('1085408d-5bba-5347-9a41-58c4861d1868','05570902','0902','ทต.ห้วยไคร้','แม่สาย'),
  ('be275b6b-9174-5d3f-841f-677467bc63ef','05570904','0904','ทต.แม่สายมิตรภาพ','แม่สาย'),
  ('dcc0c616-7a07-5a3a-b000-95c2812cc35b','05570901','0901','ทต.แม่สาย','แม่สาย'),
  ('f0e15a4e-3083-5744-9aa6-ded5ec77da58','05570807','0807','ทต.โยนก','เชียงแสน'),
  ('15294cbc-fcb9-5cc3-bb61-740e8a1915f2','05570804','0804','ทต.แม่เงิน','เชียงแสน'),
  ('149e2a91-f36f-5577-8915-de33b011d0fa','06570805','0805','อบต.ศรีดอนมูล','เชียงแสน'),
  ('70e773bf-e69e-5f2f-9bb7-eee595fda1a2','05570803','0803','ทต.บ้านแซว','เชียงแสน'),
  ('d5dfb083-4955-5d50-95cc-53f6e85a8788','06570806','0806','อบต.ป่าสัก','เชียงแสน'),
  ('3e1c13cd-30fd-5067-b4a7-28552e09d84d','05570801','0801','ทต.เวียง','เชียงแสน'),
  ('5b484986-72d7-5b49-a95c-610ff969cbce','05570802','0802','ทต.เวียงเชียงแสน','เชียงแสน'),
  ('e40cbc85-f1cd-5e4a-9226-e755abf6dfa4','06570711','0711','อบต.จอมสวรรค์','แม่จัน'),
  ('34c397f2-4b4c-5011-89b6-750891689d0f','06570712','0712','อบต.ศรีค้ำ','แม่จัน'),
  ('6c87815e-e883-5832-9720-4a185ea9830f','05570710','0710','ทต.แม่ไร่','แม่จัน'),
  ('ed8cf6cf-f639-52ee-bf68-1b9fcba2ea33','06570708','0708','อบต.ป่าตึง','แม่จัน'),
  ('03359b01-a8bd-5662-8a32-0164ee143753','05570706','0706','ทต.ท่าข้าวเปลือก','แม่จัน'),
  ('3cbd07ef-cead-53fe-8f51-ee49b7a4d44b','05570713','0713','ทต.จอมจันทร์','แม่จัน'),
  ('ba09b11d-ab18-5c2b-a205-fb55e2d35876','05570704','0704','ทต.สันทราย','แม่จัน'),
  ('10f7d090-085c-5ffe-be1a-5386f5733b1d','05570705','0705','ทต.ป่าซาง','แม่จัน'),
  ('136fc471-860e-5c7e-8aa6-8a90639ce948','05570707','0707','ทต.สายน้ำคำ','แม่จัน'),
  ('cb539697-4365-5273-a477-bb05b8685cba','05570702','0702','ทต.แม่คำ','แม่จัน'),
  ('dd173110-f7e8-5a43-a378-4acd29f3b3f6','05570701','0701','ทต.จันจว้า','แม่จัน'),
  ('244c770b-9097-58cf-80c1-9301bf0b65c8','06570709','0709','อบต.แม่จัน','แม่จัน'),
  ('281d6b25-4eaf-54cf-9c5b-bf5888f6a771','05570703','0703','ทต.แม่จัน','แม่จัน'),
  ('b67892d2-0bdb-5ec2-a26d-6c33eb8578b3','05570602','0602','ทต.ศรีโพธิ์เงิน','ป่าแดด'),
  ('5f5e5f5f-028a-5261-90fb-19f97f836496','05570605','0605','ทต.โรงช้าง','ป่าแดด'),
  ('2ceb8e0c-7077-56c5-94cc-7a1d53b984d7','05570601','0601','ทต.สันมะค่า','ป่าแดด'),
  ('44849e56-ce53-5022-a121-a3d18f73803f','05570603','0603','ทต.ป่าแงะ','ป่าแดด'),
  ('52bd0691-d230-59e2-8031-5d3a9dab37c3','05570604','0604','ทต.ป่าแดด','ป่าแดด'),
  ('c715d7a4-ddac-5273-b257-17e3d63fc884','06570510','0510','อบต.เวียงห้าว','พาน'),
  ('40e3b66a-c0d8-5dfb-bbdd-4c7d0acc61de','06570505','0505','อบต.ทานตะวัน','พาน'),
  ('3bb9bc6c-ce9a-5aa8-8b5c-b9d07bba0a54','06570507','0507','อบต.เมืองพาน','พาน'),
  ('b0f5e2b5-f1d2-5d3d-8999-c634d5d96b27','05570501','0501','ทต.เมืองพาน','พาน'),
  ('676dff1b-3887-5f89-a1fe-ddd98b02d73f','06570508','0508','อบต.แม่เย็น','พาน'),
  ('cae1e30f-5531-560b-aa66-55efb1c2e89e','06570511','0511','อบต.สันกลาง','พาน'),
  ('a0f63e02-1a80-5004-b43b-ee4f74f67c66','06570504','0504','อบต.ทรายขาว','พาน'),
  ('a1822a52-450f-5b63-8a3c-4d8cf810c54a','06570514','0514','อบต.ม่วงคำ','พาน'),
  ('51341860-3e6c-54a2-ad1c-ce863e80b7c2','06570506','0506','อบต.ป่าหุ่ง','พาน'),
  ('b8bacdd0-5d90-57ec-a589-f94ad2d1a27f','06570502','0502','อบต.เจริญเมือง','พาน'),
  ('0790b912-5906-540a-bfe6-b6ead673379a','06570512','0512','อบต.หัวง้ม','พาน'),
  ('dc24ec52-1b68-5732-ba1a-9e58ed0d2a39','06570503','0503','อบต.ดอยงาม','พาน'),
  ('cceccc56-dcfc-528b-a775-fbbb9e812bf5','06570515','0515','อบต.สันติสุข','พาน'),
  ('3cbcc0c3-87af-5e51-8704-87013a6bdb7a','06570513','0513','อบต.ธารทอง','พาน'),
  ('5f80523e-0144-5d75-8332-e88d9a476922','05570509','0509','ทต.แม่อ้อ','พาน'),
  ('69691fdd-7184-5038-b70a-7d5b4a4543e7','05570516','0516','ทต.สันมะเค็ด','พาน'),
  ('c4349d13-aa8e-5ed9-9993-2df4734fe368','06570409','0409','อบต.หนองแรด','เทิง'),
  ('b6013725-d889-5628-bccf-8689b7b385d2','06570412','0412','อบต.ศรีดอนไชย','เทิง'),
  ('72f21a22-c56b-59c7-8ddc-28ae95aeff5b','05570402','0402','ทต.สันทรายงาม','เทิง'),
  ('1af90d00-e268-5e8f-a0ac-389188906c64','05570405','0405','ทต.หงาว','เทิง'),
  ('1b610ff3-2a1f-5bb1-9ee6-92c877c7182f','06570411','0411','อบต.ตับเต่า','เทิง'),
  ('3947c376-3fe5-5777-899c-8c95d3eba8cd','05570410','0410','ทต.เชียงเคี่ยน','เทิง'),
  ('c203b9d9-8785-5734-a319-b47e2e7c63be','06570408','0408','อบต.แม่ลอย','เทิง'),
  ('2891f95f-8d81-5c38-89af-f8f1b8152391','06570407','0407','อบต.ปล้อง','เทิง'),
  ('1a6fd7d0-cb34-52e0-ae72-9d4567f290f0','05570403','0403','ทต.บ้านปล้อง','เทิง'),
  ('12bb8373-1a6f-52a8-997e-05a0bbd0d235','05570401','0401','ทต.งิ้ว','เทิง'),
  ('491ebcdb-51f8-561e-b8f1-cdd8947f9c81','06570406','0406','อบต.เวียง','เทิง'),
  ('24bc31a6-7cfa-5560-8de2-c1d293230a5b','05570404','0404','ทต.เวียงเทิง','เทิง'),
  ('75de7b21-20a3-5251-9cc2-04672f67570c','06570308','0308','อบต.ริมโขง','เชียงของ'),
  ('7d447a7d-5607-5a8f-9365-1b81f3df73d5','05570307','0307','ทต.ศรีดอนชัย','เชียงของ'),
  ('e7f29f59-3080-52eb-97e0-68df502756bc','05570301','0301','ทต.ห้วยซ้อ','เชียงของ'),
  ('60a2d8b9-2b1c-5ba9-b949-e6e4e55e78f5','05570302','0302','ทต.บุญเรือง','เชียงของ'),
  ('9553be67-815d-58bc-b268-0453d3ec23ef','05570304','0304','ทต.ครึ่ง','เชียงของ'),
  ('9363f105-6378-5bcf-a56c-1edece083c89','05570306','0306','ทต.สถาน','เชียงของ'),
  ('f1ad9d6a-da91-5acf-bfc2-90e70940cdd5','05570305','0305','ทต.เวียง','เชียงของ'),
  ('262f0667-3bc2-5d0b-a821-bc60b8f5b38c','05570303','0303','ทต.เวียงเชียงของ','เชียงของ'),
  ('775272dc-a0fb-5880-8187-0ce7ff4a234a','05570202','0202','ทต.เมืองชุม','เวียงชัย'),
  ('153159ff-a9f4-5577-a690-1149fce1ae66','05570205','0205','ทต.ดอนศิลา','เวียงชัย'),
  ('2bde0e44-c587-5773-9734-84262207a31b','05570204','0204','ทต.เวียงเหนือ','เวียงชัย'),
  ('5b6885bf-c87c-5391-927f-18ad89ac7e8e','06570206','0206','อบต.ผางาม','เวียงชัย'),
  ('f05d4bca-86dc-59a5-a9b3-be4cc167247a','05570203','0203','ทต.สิริเวียงชัย','เวียงชัย'),
  ('efad35b1-66e1-5855-9b40-abc4390cc304','05570201','0201','ทต.เวียงชัย','เวียงชัย'),
  ('ed9ac168-a94c-5c9b-aeb9-70199d06e651','05570109','0109','ทต.ท่าสุด','เมืองเชียงราย'),
  ('72359853-681f-5e07-b34c-4d3b39323cc6','05570111','0111','ทต.ดอยฮาง','เมืองเชียงราย'),
  ('cf75c5e1-9e21-5d87-99a7-e6eccc876541','05570108','0108','ทต.ท่าสาย','เมืองเชียงราย'),
  ('e1b3f3ea-4ada-52eb-8e90-a39d0962001d','05570106','0106','ทต.ป่าอ้อดอนชัย','เมืองเชียงราย'),
  ('a80f6086-21ff-5811-b679-1e6bf641878d','05570110','0110','ทต.ดอยลาน','เมืองเชียงราย'),
  ('3e59dd6d-b165-52b2-bd0a-a96211239016','06570114','0114','อบต.ริมกก','เมืองเชียงราย'),
  ('e3f4d301-ae6a-5013-af20-b86bb1f259a7','05570115','0115','ทต.ห้วยสัก','เมืองเชียงราย'),
  ('65822bd8-67e7-56f3-93c8-c66b7f7285e2','06570117','0117','อบต.ห้วยชมภู','เมืองเชียงราย'),
  ('3ed663d2-8c44-57d1-88b0-543f6e1d5c23','05570112','0112','ทต.แม่กรณ์','เมืองเชียงราย'),
  ('b3727620-289e-5641-9272-a080040d247c','05570103','0103','ทต.สันทราย','เมืองเชียงราย'),
  ('a1746bea-4404-5966-810a-a43244d2efb3','05570107','0107','ทต.แม่ยาว','เมืองเชียงราย'),
  ('176317c9-9e5c-5781-9754-4cc80cfc95ff','06570113','0113','อบต.แม่ข้าวต้ม','เมืองเชียงราย'),
  ('b06032e6-27c6-50a6-bb35-72bbf42dbebf','05570105','0105','ทต.นางแล','เมืองเชียงราย'),
  ('05c56416-3b28-50c3-aee7-9c8246ca06ac','05570104','0104','ทต.บ้านดู่','เมืองเชียงราย'),
  ('67c9ffa1-7e46-56d9-8c13-268764d11282','06570116','0116','อบต.รอบเวียง','เมืองเชียงราย'),
  ('fe603c18-80f8-5f4f-9845-f312c0f75147','03570102','0102','ทน.เชียงราย','เมืองเชียงราย'),
  ('f1fa098d-f238-5801-9dce-6ec4e742512b','02570101','0101','อบจ.เชียงราย','เมืองเชียงราย');

-- เติมรหัสให้หน่วยงานเดิมที่ชื่อและอำเภอตรงกัน
update public.organizations o
set official_code=r.official_code,short_code=r.short_code
from _org_registry r
where o.name=r.name and o.district=r.district;

-- เพิ่มหน่วยงานที่ยังไม่มี รวมถึงชื่อซ้ำแต่คนละอำเภอ
insert into public.organizations(id,official_code,short_code,name,short_name,district,active)
select r.id,r.official_code,r.short_code,r.name,r.name,r.district,true
from _org_registry r
where not exists (select 1 from public.organizations o where o.official_code=r.official_code);

-- ใช้ UUID จริงของหน่วยงานเดิมที่ถูกเก็บรักษาไว้
update _org_registry r set id=o.id
from public.organizations o
where o.official_code=r.official_code and r.id<>o.id;

-- แยกอุปกรณ์ที่เคยถูกรวมเพราะชื่อ อปท. ซ้ำ โดยใช้อำเภอของอุปกรณ์ประกอบ
update public.equipment e
set organization_id=r.id
from public.organizations old_o,_org_registry r
where e.organization_id=old_o.id
  and old_o.name=r.name
  and e.district=r.district
  and e.organization_id<>r.id;

update public.organizations set active=false
where official_code is null;

alter table public.organizations alter column official_code set not null;
alter table public.organizations alter column short_code set not null;
alter table public.organizations drop constraint if exists organizations_official_code_key;
alter table public.organizations drop constraint if exists organizations_short_code_key;
alter table public.organizations add constraint organizations_official_code_key unique(official_code);
alter table public.organizations add constraint organizations_short_code_key unique(short_code);
alter table public.organizations add constraint organizations_official_code_format check(official_code ~ '^\d{8}$');
alter table public.organizations add constraint organizations_short_code_format check(short_code ~ '^\d{4}$');

-- เก็บ FP-xxx ไว้ แล้วออกรหัสใหม่เรียงแยกภายในแต่ละ อปท.
update public.equipment set legacy_code=code where legacy_code is null;
with ranked as (
  select e.id,o.short_code,
         row_number() over(partition by e.organization_id order by
           coalesce(nullif(regexp_replace(e.legacy_code,'\D','','g'),''),'0')::bigint,e.created_at,e.id) as seq
  from public.equipment e join public.organizations o on o.id=e.organization_id
)
update public.equipment e
set code=r.short_code||'-'||lpad(r.seq::text,4,'0')
from ranked r where e.id=r.id;

alter table public.equipment drop constraint if exists equipment_legacy_code_key;
alter table public.equipment add constraint equipment_legacy_code_key unique(legacy_code);
alter table public.equipment drop constraint if exists equipment_code_format;
alter table public.equipment add constraint equipment_code_format check(code ~ '^\d{4}-\d{4}$');

create table if not exists public.equipment_code_sequences (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  last_value integer not null default 0 check(last_value between 0 and 9999)
);
insert into public.equipment_code_sequences(organization_id,last_value)
select organization_id,max(right(code,4)::integer) from public.equipment group by organization_id
on conflict(organization_id) do update set last_value=greatest(public.equipment_code_sequences.last_value,excluded.last_value);

create or replace function public.assign_equipment_code()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_short_code text; v_next integer;
begin
  if new.code is not null and btrim(new.code)<>'' then return new; end if;
  select short_code into v_short_code from public.organizations where id=new.organization_id and active=true;
  if v_short_code is null then raise exception 'ไม่พบรหัสย่อของหน่วยงาน หรือหน่วยงานถูกระงับการใช้งาน'; end if;
  insert into public.equipment_code_sequences(organization_id,last_value) values(new.organization_id,1)
  on conflict(organization_id) do update set last_value=public.equipment_code_sequences.last_value+1
  returning last_value into v_next;
  if v_next>9999 then raise exception 'เลขลำดับอุปกรณ์ของหน่วยงาน % เกิน 9999 รายการ',v_short_code; end if;
  new.code:=v_short_code||'-'||lpad(v_next::text,4,'0');
  return new;
end $$;

drop trigger if exists equipment_assign_code on public.equipment;
create trigger equipment_assign_code before insert on public.equipment
for each row execute function public.assign_equipment_code();

alter table public.equipment_code_sequences enable row level security;
drop policy if exists "admins read equipment sequences" on public.equipment_code_sequences;
create policy "admins read equipment sequences" on public.equipment_code_sequences
for select to authenticated using(public.is_system_admin());

commit;

-- ควรได้ 144, 144, 613, 613 ตามลำดับ
select count(*) as organizations,count(distinct short_code) as unique_short_codes from public.organizations where active=true;
select count(*) as equipment,count(distinct code) as unique_equipment_codes from public.equipment;
