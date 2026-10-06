/* =========================================================================
   Xpertone Creative LLC-FZ — Data layer + cart
   -------------------------------------------------------------------------
   Exposes three globals:
     XO       — small helpers (money, slug, dom, escape…)
     Catalog  — loads + normalises products from the API or the JSON snapshot
     Cart     — cart state, persisted to localStorage, with pricing rules
   No framework, no build step.
   ========================================================================= */

(function () {
  'use strict';

  var CFG = window.XO_CONFIG;

  // Temporary image migration: originals remain preserved in the recovery backup.
  var RECOVERY_TARGETS = {"CORD2":"eye-face-protection/CORD2.webp","THB":"eye-face-protection/THB.webp","KMS":"eye-face-protection/KMS.webp","CGO":"eye-face-protection/CGO.webp","KPB":"eye-face-protection/KPB.webp","V351":"eye-face-protection/V351.webp","CHR":"eye-face-protection/CHR.webp","B661":"eye-face-protection/B661.webp","B671":"eye-face-protection/B671.webp","M091":"eye-face-protection/M091.webp","V771":"eye-face-protection/V771.webp","V100":"eye-face-protection/V100.webp","V107":"eye-face-protection/V107.webp","V83":"eye-face-protection/V83.webp","V110":"eye-face-protection/V110.webp","V103":"eye-face-protection/V103.webp","V101":"eye-face-protection/V101.webp","V51":"eye-face-protection/V51.webp","V104":"eye-face-protection/V104.webp","V121":"eye-face-protection/V121.webp","V181":"eye-face-protection/V181.webp","V191":"eye-face-protection/V191.webp","V201":"eye-face-protection/V201.webp","V702":"eye-face-protection/V702.webp","V72":"eye-face-protection/V72.webp","KAL":"eye-face-protection/KAL.webp","V73":"eye-face-protection/V73.webp","V49":"eye-face-protection/V49.webp","V01":"eye-face-protection/V01.webp","V02":"eye-face-protection/V02.webp","V131":"eye-face-protection/V131.webp","V19":"eye-face-protection/V19.webp","V30":"eye-face-protection/V30.webp","V406":"eye-face-protection/V406.webp","V46":"eye-face-protection/V46.webp","V61":"eye-face-protection/V61.webp","V69":"eye-face-protection/V69.webp","V701":"eye-face-protection/V701.webp","V71":"eye-face-protection/V71.webp","V81":"eye-face-protection/V81.webp","V89":"eye-face-protection/V89.webp","V901":"eye-face-protection/V901.webp","V91":"eye-face-protection/V91.webp","AFC":"eye-face-protection/AFC.webp","USC":"hand-protection/USC.webp","TNC":"hand-protection/TNC.webp","CKG":"hand-protection/CKG.webp","PCR":"hand-protection/PCR.webp","RTP":"hand-protection/RTP.webp","IJT10":"hand-protection/IJT10.webp","MOK":"hand-protection/MOK.webp","RGS":"hand-protection/RGS.webp","PEV":"hand-protection/PEV.webp","JWM":"hand-protection/JWM.webp","SAF":"hand-protection/SAF.webp","SEG":"hand-protection/SEG.webp","LHE":"hand-protection/LHE.webp","DSC":"hand-protection/DSC.webp","JNU":"hand-protection/JNU.webp","RUB72":"hand-protection/RUB72.webp","ACM":"hand-protection/ACM.webp","SAO":"hand-protection/SAO.webp","ANZ":"hand-protection/ANZ.webp","LBG":"hand-protection/LBG.webp","LOL":"hand-protection/LOL.webp","YES":"hand-protection/YES.webp","BAK":"hand-protection/BAK.webp","UKP":"hand-protection/UKP.webp","UFO":"hand-protection/UFO.webp","MWC":"hand-protection/MWC.webp","NEP":"hand-protection/NEP.webp","DRC":"hand-protection/DRC.webp","WRY":"hand-protection/WRY.webp","DPX":"hand-protection/DPX.webp","HJO":"hand-protection/HJO.webp","KTP":"hand-protection/KTP.webp","ORD":"hand-protection/ORD.webp","CAB":"hand-protection/CAB.webp","NBR":"hand-protection/NBR.webp","JKL":"hand-protection/JKL.webp","PLR":"hand-protection/PLR.webp","LLR":"hand-protection/LLR.webp","USA":"hand-protection/USA.webp","AFH":"hand-protection/AFH.webp","MLX":"hand-protection/MLX.webp","GKR":"hand-protection/GKR.webp","EGY":"hand-protection/EGY.webp","TZA":"hand-protection/TZA.webp","QUV":"hand-protection/QUV.webp","OVP":"hardware-tools/OVP.webp","EAO":"hardware-tools/EAO.webp","BDQ":"hardware-tools/BDQ.webp","VVL":"hardware-tools/VVL.webp","PMM":"hardware-tools/PMM.webp","DMD":"hardware-tools/DMD.webp","FB1240":"hardware-tools/FB1240.webp","FB12.1830":"hardware-tools/FB12.1830.webp","FB18":"hardware-tools/FB18.webp","SOR":"hardware-tools/SOR.webp","SEP":"hardware-tools/SEP.webp","FAB":"hardware-tools/FAB.webp","ADD":"hardware-tools/ADD.webp","JCR":"hardware-tools/JCR.webp","HHR":"hardware-tools/HHR.webp","TCT":"hardware-tools/TCT.webp","TCB":"hardware-tools/TCB.webp","RAB":"hardware-tools/RAB.webp","HED":"hardware-tools/HED.webp","RGO":"hardware-tools/RGO.webp","RGG":"hardware-tools/RGG.webp","RFC":"hardware-tools/RFC.webp","ESN":"hardware-tools/ESN.webp","KDL":"hardware-tools/KDL.webp","NGR":"hardware-tools/NGR.webp","IAV":"hardware-tools/IAV.webp","PSC":"hardware-tools/PSC.webp","QER":"hardware-tools/QER.webp","JOK":"hardware-tools/JOK.webp","HND":"hearing-respiratory/HND.webp","USD":"hearing-respiratory/USD.webp","LUC":"hearing-respiratory/LUC.webp","HFM":"hearing-respiratory/HFM.webp","COP":"hearing-respiratory/COP.webp","HRK":"hearing-respiratory/HRK.webp","QBP":"hearing-respiratory/QBP.webp","ABH":"hearing-respiratory/ABH.webp","RKV":"hearing-respiratory/RKV.webp","VPC":"hearing-respiratory/VPC.webp","NDG":"hearing-respiratory/NDG.webp","BPK":"hearing-respiratory/BPK.webp","FUN":"hearing-respiratory/FUN.webp","CAT":"hearing-respiratory/CAT.webp","MAP":"hearing-respiratory/MAP.webp","HIT":"hearing-respiratory/HIT.webp","VMK":"hearing-respiratory/VMK.webp","VPU":"hearing-respiratory/VPU.webp","V-CN95":"hearing-respiratory/V-CN95.webp","ACB":"helmets/ACB.webp","KEH":"helmets/KEH.webp","JHM":"helmets/JHM.webp","ESO":"helmets/ESO.webp","CDA":"helmets/CDA.webp","KPY":"clean-reference/helmets/KPY.webp","MRO":"helmets/MRO.webp","PNB":"helmets/PNB.webp","GOA":"helmets/GOA.webp","LGB":"helmets/LGB.webp","ORT":"helmets/ORT.webp","ADC":"helmets/ADC.webp","VHRT":"helmets/VHRT.webp","VHVR":"helmets/VHVR.webp","ABU":"helmets/ABU.webp","VH":"helmets/VH.webp","VHT":"helmets/VHT.webp","VHV":"helmets/VHV.webp","YOL":"helmets/YOL.webp","EJM":"rainwear-marine/EJM.webp","LRK":"rainwear-marine/LRK.webp","OUC":"rainwear-marine/OUC.webp","KWA":"rainwear-marine/KWA.webp","VOA":"safety-shoes/VOA.webp","OXP":"safety-shoes/OXP.webp","LMV":"safety-shoes/LMV.webp","DJG":"safety-shoes/DJG.webp","QKM":"safety-shoes/QKM.webp","CMG":"safety-shoes/CMG.webp","RKP":"safety-shoes/RKP.webp","RSC":"safety-shoes/RSC.webp","GQF":"safety-shoes/GQF.webp","SOH":"safety-shoes/SOH.webp","VE25":"safety-shoes/VE25.webp","RBS12":"safety-shoes/RBS12.webp","RBT":"safety-shoes/RBT.webp","JGP":"safety-shoes/JGP.webp","PKN":"safety-shoes/PKN.webp","SKNS":"safety-shoes/SKNS.webp","PRI":"safety-shoes/PRI.webp","VE12":"safety-shoes/VE12.webp","MFC":"safety-shoes/MFC.webp","VI8":"safety-shoes/VI8.webp","VE7":"safety-shoes/VE7.webp","VE5":"safety-shoes/VE5.webp","VE3":"safety-shoes/VE3.webp","VE1":"safety-shoes/VE1.webp","SGB":"safety-shoes/SGB.webp","SGK":"safety-shoes/SGK.webp","SGM":"safety-shoes/SGM.webp","VBL":"safety-shoes/VBL.webp","MDU":"safety-shoes/MDU.webp","LEO":"safety-shoes/LEO.webp","SG6":"safety-shoes/SG6.webp","VJS6":"safety-shoes/VJS6.webp","DVR":"safety-shoes/DVR.webp","AMJ":"safety-shoes/AMJ.webp","YRA":"clean-reference/safety-shoes/YRA.webp","UBA":"safety-shoes/UBA.webp","PMC":"safety-shoes/PMC.webp","RUQ":"clean-reference/safety-shoes/RUQ.webp","VTI":"clean-reference/safety-shoes/VTI.webp","SG7":"safety-shoes/SG7.webp","NBI":"clean-reference/safety-shoes/NBI.webp","MKN":"safety-shoes/MKN.webp","SEU":"clean-reference/safety-shoes/SEU.webp","USB":"safety-shoes/USB.webp","PEN":"safety-shoes/PEN.webp","AIO":"safety-shoes/AIO.webp","PUR":"safety-shoes/PUR.webp","GOP":"safety-shoes/GOP.webp","HOF":"safety-shoes/HOF.webp","SHP":"safety-shoes/SHP.webp","PAS":"safety-shoes/PAS.webp","LBW":"safety-shoes/LBW.webp","JJO":"safety-shoes/JJO.webp","FAR":"safety-shoes/FAR.webp","VIM":"safety-shoes/VIM.webp","PAM":"safety-shoes/PAM.webp","PDH":"clean-reference/safety-shoes/PDH.webp","YAK":"safety-shoes/YAK.webp","RBK":"safety-shoes/RBK.webp","JPU":"clean-reference/safety-shoes/JPU.webp","DHA":"safety-shoes/DHA.webp","OTD":"safety-vests/OTD.webp","2X2":"safety-vests/2X2.webp","4X4":"safety-vests/4X4.webp","6X6":"safety-vests/6X6.webp","VOS":"safety-vests/VOS.webp","ICS":"safety-vests/ICS.webp","GSO":"safety-vests/GSO.webp","LVS":"safety-vests/LVS.webp","FAT":"safety-vests/FAT.webp","RSJ":"safety-vests/RSJ.webp","HJD":"safety-vests/HJD.webp","DLM":"safety-vests/DLM.webp","VTA":"safety-vests/VTA.webp","BDH":"safety-vests/BDH.webp","BKM":"safety-vests/BKM.webp","VIO":"safety-vests/VIO.webp","AGS":"safety-vests/AGS.webp","ASU":"safety-vests/ASU.webp","OUA":"safety-vests/OUA.webp","ORB":"safety-vests/ORB.webp","JBP":"safety-vests/JBP.webp","CKD":"safety-vests/CKD.webp","BAV":"safety-vests/BAV.webp","NKO":"safety-vests/NKO.webp","FSL":"safety-vests/FSL.webp","APD":"safety-vests/APD.webp","JIB":"safety-vests/JIB.webp","SPD":"safety-vests/SPD.webp","SUV":"safety-vests/SUV.webp","ZKR":"safety-vests/ZKR.webp","RTA":"safety-vests/RTA.webp","BUP":"safety-vests/BUP.webp","BGP":"safety-vests/BGP.webp","IFS":"safety-vests/IFS.webp","TTL":"safety-vests/TTL.webp","ANS":"safety-vests/ANS.webp","PHL":"safety-vests/PHL.webp","MLD":"safety-vests/MLD.webp","HBC":"safety-vests/HBC.webp","WAQ":"safety-vests/WAQ.webp","HVK":"traffic-safety/HVK.webp","TAC":"traffic-safety/TAC.webp","UDP":"traffic-safety/UDP.webp","MSO":"traffic-safety/MSO.webp","S1359B":"traffic-safety/S1359B.webp","S1325":"traffic-safety/S1325.webp","S1317":"traffic-safety/S1317.webp","S1317RED":"traffic-safety/S1317RED.webp","ISO":"traffic-safety/ISO.webp","PKA":"traffic-safety/PKA.webp","ROJ":"traffic-safety/ROJ.webp","WPN":"traffic-safety/WPN.webp","BAT":"uniforms/BAT.webp","GAT":"uniforms/GAT.webp","NAT":"uniforms/NAT.webp","PAT":"clean-reference/uniforms/PAT.webp","YAT":"clean-reference/uniforms/YAT.webp","PMY":"clean-reference/uniforms/PMY.webp","OMW":"clean-reference/uniforms/OMW.webp","FMT":"clean-reference/uniforms/FMT.webp","VBC":"clean-reference/uniforms/VBC.webp","APC":"clean-reference/uniforms/APC.webp","GLE":"clean-reference/uniforms/GLE.webp","EMX":"uniforms/EMX.webp","OTP":"clean-reference/uniforms/OTP.webp","MUA":"clean-reference/uniforms/MUA.webp","SGC":"clean-reference/uniforms/SGC.webp","AIF2":"clean-reference/uniforms/AIF2.webp","TVU":"clean-reference/uniforms/TVU.webp","DRQ":"clean-reference/uniforms/DRQ.webp","BDK":"clean-reference/uniforms/BDK.webp","EKU":"clean-reference/uniforms/EKU.webp","ASO":"clean-reference/uniforms/ASO.webp","FSO":"clean-reference/uniforms/FSO.webp","CQA":"clean-reference/uniforms/CQA.webp","ETD":"clean-reference/uniforms/ETD.webp","TPO":"clean-reference/uniforms/TPO.webp","VED":"clean-reference/uniforms/VED.webp","ADI":"uniforms/ADI.webp","DIA":"clean-reference/uniforms/DIA.webp","SEV":"clean-reference/uniforms/SEV.webp","DTE":"clean-reference/uniforms/DTE.webp","RGF":"uniforms/RGF.webp","IDA":"clean-reference/uniforms/IDA.webp","YCI":"clean-reference/uniforms/YCI.webp","UJG":"clean-reference/uniforms/UJG.webp","GJU":"clean-reference/uniforms/GJU.webp","YOU":"clean-reference/uniforms/YOU.webp","KIS":"clean-reference/uniforms/KIS.webp","FOH":"uniforms/FOH.webp","ARC":"uniforms/ARC.webp","HUB":"clean-reference/uniforms/HUB.webp","LSG":"clean-reference/uniforms/LSG.webp","ADN":"uniforms/ADN.webp","ALE":"clean-reference/uniforms/ALE.webp","TOP":"clean-reference/uniforms/TOP.webp","VON":"uniforms/VON.webp","VOR":"clean-reference/uniforms/VOR.webp","RCD":"clean-reference/uniforms/RCD.webp","VRB":"clean-reference/uniforms/VRB.webp","FBI":"uniforms/FBI.webp","HEV":"uniforms/HEV.webp","NDJ":"uniforms/NDJ.webp","JDN":"uniforms/JDN.webp","LAO":"uniforms/LAO.webp","NOL":"uniforms/NOL.webp","ONC":"uniforms/ONC.webp","JVC":"uniforms/JVC.webp","HAQ":"clean-reference/uniforms/HAQ.webp","KPA":"uniforms/KPA.webp","GKL":"clean-reference/uniforms/GKL.webp","LCV":"uniforms/LCV.webp","INM":"uniforms/INM.webp","QMP":"clean-reference/uniforms/QMP.webp","DQV":"clean-reference/uniforms/DQV.webp","MQF":"clean-reference/uniforms/MQF.webp","HTS":"clean-reference/uniforms/HTS.webp","MIN":"clean-reference/uniforms/MIN.webp","FPT":"clean-reference/uniforms/FPT.webp","DNV":"clean-reference/uniforms/DNV.webp","VIA":"clean-reference/uniforms/VIA.webp","TSK":"uniforms/TSK.webp","VOX":"clean-reference/uniforms/VOX.webp","TUP":"clean-reference/uniforms/TUP.webp","YOW":"uniforms/YOW.webp","SIM":"clean-reference/uniforms/SIM.webp","ATL":"clean-reference/uniforms/ATL.webp","IDU":"clean-reference/uniforms/IDU.webp","PIA":"clean-reference/uniforms/PIA.webp","COM":"clean-reference/uniforms/COM.webp","DEC":"clean-reference/uniforms/DEC.webp","1RV":"clean-reference/uniforms/1RV.webp","1BV":"clean-reference/uniforms/1BV.webp","1GV":"clean-reference/uniforms/1GV.webp","1GRV":"uniforms/1GRV.webp","1NV":"clean-reference/uniforms/1NV.webp","1OV":"uniforms/1OV.webp","1PV":"uniforms/1PV.webp","PER":"clean-reference/uniforms/PER.webp","1YV":"clean-reference/uniforms/1YV.webp","AGC":"uniforms/AGC.webp","GHK":"clean-reference/uniforms/GHK.webp","OHG":"uniforms/OHG.webp","CBV":"uniforms/CBV.webp","CGV":"uniforms/CGV.webp","OVT":"uniforms/OVT.webp","CPV":"uniforms/CPV.webp","UDO":"clean-reference/uniforms/UDO.webp","SKO":"uniforms/SKO.webp","LDC":"uniforms/LDC.webp","WWB":"uniforms/WWB.webp","MJT":"uniforms/MJT.webp","WWG":"clean-reference/uniforms/WWG.webp","CNV":"uniforms/CNV.webp","WWN":"clean-reference/uniforms/WWN.webp","WWP":"uniforms/WWP.webp","CYV":"clean-reference/uniforms/CYV.webp","TIE":"uniforms/TIE.webp","MSG":"uniforms/MSG.webp","EAU":"uniforms/EAU.webp","UXV":"uniforms/UXV.webp","MUN":"uniforms/MUN.webp","MBS":"uniforms/MBS.webp","NXG":"uniforms/NXG.webp","LBF":"clean-reference/uniforms/LBF.webp","DCC":"clean-reference/uniforms/DCC.webp","DCL":"uniforms/DCL.webp","DCH":"clean-reference/uniforms/DCH.webp","PDC":"clean-reference/uniforms/PDC.webp","AUM":"clean-reference/uniforms/AUM.webp","TDC":"clean-reference/uniforms/TDC.webp","UFV":"clean-reference/uniforms/UFV.webp","GEM":"clean-reference/uniforms/GEM.webp","MEG":"clean-reference/uniforms/MEG.webp","CSO":"uniforms/CSO.webp","DUE":"uniforms/DUE.webp","MPG":"uniforms/MPG.webp","TDB":"uniforms/TDB.webp","DNE":"uniforms/DNE.webp","TCA":"uniforms/TCA.webp","EUD":"uniforms/EUD.webp","QNQ":"uniforms/QNQ.webp","HSI":"clean-reference/uniforms/HSI.webp","SGF":"clean-reference/uniforms/SGF.webp","PJM":"uniforms/PJM.webp","CVV":"clean-reference/uniforms/CVV.webp","IVB":"uniforms/IVB.webp","BUM":"clean-reference/uniforms/BUM.webp","LBFRN":"uniforms/LBFRN.webp","LBFRO":"uniforms/LBFRO.webp","LBFRR":"uniforms/LBFRR.webp","ECN":"uniforms/ECN.webp","MIS":"clean-reference/uniforms/MIS.webp","VNR":"uniforms/VNR.webp","POR":"uniforms/POR.webp","NCE":"uniforms/NCE.webp","MTA":"clean-reference/uniforms/MTA.webp","CRE":"clean-reference/uniforms/CRE.webp","RFR":"clean-reference/uniforms/RFR.webp","SOU":"uniforms/SOU.webp","ROW":"uniforms/ROW.webp","FBM":"uniforms/FBM.webp","EIT":"clean-reference/uniforms/EIT.webp","WOR":"uniforms/WOR.webp","CTC":"uniforms/CTC.webp","CQB":"clean-reference/uniforms/CQB.webp","RGM":"clean-reference/uniforms/RGM.webp","BNL":"clean-reference/uniforms/BNL.webp","LNB":"clean-reference/uniforms/LNB.webp","AZI":"uniforms/AZI.webp","UBN":"uniforms/UBN.webp","DEN":"uniforms/DEN.webp","BEE":"uniforms/BEE.webp","PGA":"uniforms/PGA.webp","NLQ":"uniforms/NLQ.webp","DTR":"uniforms/DTR.webp","NKM":"uniforms/NKM.webp","AKH":"uniforms/AKH.webp","KIP":"uniforms/KIP.webp","JGN":"uniforms/JGN.webp","JGO":"uniforms/JGO.webp","JGY":"uniforms/JGY.webp","FRA":"clean-reference/uniforms/FRA.webp","MAD":"clean-reference/uniforms/MAD.webp","JNB":"clean-reference/uniforms/JNB.webp","SYD":"uniforms/SYD.webp","LAX":"uniforms/LAX.webp","IAX":"uniforms/IAX.webp","CAI":"clean-reference/uniforms/CAI.webp","LHR":"clean-reference/uniforms/LHR.webp","ICN":"clean-reference/uniforms/ICN.webp","TPF":"uniforms/TPF.webp","B100":"clean-reference/uniforms/B100.webp","LHO":"uniforms/LHO.webp","NPA":"clean-reference/uniforms/NPA.webp","B2P":"clean-reference/uniforms/B2P.webp","C2P":"clean-reference/uniforms/C2P.webp","DNO":"uniforms/DNO.webp","ADG":"uniforms/ADG.webp","BPC":"uniforms/BPC.webp","WPV":"uniforms/WPV.webp","CLM":"uniforms/CLM.webp","2BWL":"clean-reference/uniforms/2BWL.webp","2GWL":"uniforms/2GWL.webp","2PWL":"uniforms/2PWL.webp","PXT":"uniforms/PXT.webp","FRC":"uniforms/FRC.webp","WKD":"uniforms/WKD.webp","PKW":"uniforms/PKW.webp","NCA":"clean-reference/uniforms/NCA.webp"};
  var RECOVERY_EXCEPTIONS = {"https://www.xpertonecreative.com/assets/img/products/eye-face-protection/V100.png":"KMS","https://www.xpertonecreative.com/assets/img/products/eye-face-protection/V100.webp":"KMS","https://www.xpertonecreative.com/assets/img/products/hardware-tools/RGO.png":"HHR","https://www.xpertonecreative.com/assets/img/products/hardware-tools/RGO.webp":"HHR","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868162827-two-piece-beige.png":"CLM","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868162827-two-piece-beige.webp":"CLM","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868154186-coverall-navy.png":"FRC","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868154186-coverall-navy.webp":"FRC","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868175147-labcoat-beige.png":"PMY","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868175147-labcoat-beige.webp":"PMY","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868173313-labcoat-navy.png":"FMT","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868173313-labcoat-navy.webp":"FMT","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868160594-two-piece-petrol.png":"PKW","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868160594-two-piece-petrol.webp":"PKW","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868166855-two-piece-navy.png":"WKD","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868166855-two-piece-navy.webp":"WKD","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868164744-two-piece-orange.png":"OVT","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868164744-two-piece-orange.webp":"OVT","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868157893-coverall-orange.png":"JGY","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868157893-coverall-orange.webp":"JGY","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/CPV/1789039842468-CPV.png":"LDC","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/CPV/1789039842468-CPV.webp":"LDC","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868169580-two-piece-grey.png":"QNQ","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868169580-two-piece-grey.webp":"QNQ","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868176900-jacket-navy.png":"JGN","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868176900-jacket-navy.webp":"JGN","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868171630-labcoat-white.png":"DTR","https://myodfvshmusywmhdozwt.supabase.co/storage/v1/object/public/product-photos/EMX/1788868171630-labcoat-white.webp":"DTR"};
  function recoveryImage(url) {
    var clean = String(url || '').split('?')[0];
    if (clean.indexOf('https://xpertone-images.pages.dev/') === 0) return clean + '?v=mockups-20261006';
    if (clean.indexOf('supabase.co/') === -1 && clean.indexOf('/assets/img/products/') === -1) return url;
    var parts = clean.split('/'), sku = parts[parts.length-1].replace(/\.(png|webp|jpe?g)$/i, ''), idx = parts.indexOf('product-photos');
    if (idx >= 0 && RECOVERY_TARGETS[parts[idx+1]]) sku = parts[idx+1];
    sku = RECOVERY_EXCEPTIONS[clean] || sku;
    return RECOVERY_TARGETS[sku] ? 'https://xpertone-images.pages.dev/products/' + RECOVERY_TARGETS[sku] + '?v=mockups-20261006' : (clean.indexOf('supabase.co/') !== -1 ? '/assets/img/image-unavailable.svg' : url);
  }
  function repairImages() {
    document.querySelectorAll('img[src]').forEach(function (img) {
      var before = img.getAttribute('src'), after = recoveryImage(before);
      if (before !== after) { img.removeAttribute('srcset'); img.src = after; }
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    repairImages();
    new MutationObserver(repairImages).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['src']});
  });


  function optimisedProductImage(url) {
    return String(recoveryImage(url) || '').replace(/(\/assets\/img\/products\/[^?#]+)\.png(?=([?#]|$))/i, '$1.webp');
  }

  function optimisedProductImages(images) {
    return (images || []).map(optimisedProductImage);
  }

  /* =======================================================================
     XO — helpers
     ======================================================================= */
  var XO = window.XO = {

    money: function (n, withCurrency) {
      var v = Math.round(Number(n) || 0)
        .toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return withCurrency === false ? v : CFG.CURRENCY + ' ' + v;
    },

    int: function (v) {
      var n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return isNaN(n) || n < 0 ? 0 : n;
    },

    /* True while a product still carries a placeholder price, so the page can
       say so instead of quietly presenting a guess as a real number. Clear
       priceStatus in data/products.json and the wording goes away. */
    indicative: function (p) {
      return !!(p && p.priceStatus === 'indicative' && CFG.INDICATIVE);
    },

    slug: function (s) {
      return String(s).toLowerCase()
        .replace(/&amp;/g, 'and').replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
    },

    /* The API stores HTML entities (&amp;) inside plain text fields. */
    decode: function (s) {
      if (!s) return '';
      var t = document.createElement('textarea');
      t.innerHTML = String(s);
      return t.value.trim();
    },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    qs: function (name) {
      var value = new URLSearchParams(window.location.search).get(name);
      if (value) return value;
      /* Static SEO product pages use /products/<slug>/ instead of ?p=<uid>.
         Return a tagged slug so the shared product page can resolve the live
         Supabase record without embedding a database identifier in each file. */
      if (name === 'p') {
        var match = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
        if (match) return 'slug:' + decodeURIComponent(match[1]);
      }
      return null;
    },

    el: function (sel, root) { return (root || document).querySelector(sel); },
    els: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    toast: function (msg, icon) {
      var t = document.getElementById('xoToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'xoToast';
        t.className = 'xo-toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        document.body.appendChild(t);
      }
      t.innerHTML = '<i class="fa-solid ' + (icon || 'fa-circle-check') + '"></i><span></span>';
      t.querySelector('span').textContent = msg;
      requestAnimationFrame(function () { t.classList.add('is-visible'); });
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
    },

    waLink: function (message) {
      return 'https://wa.me/' + CFG.COMPANY.whatsapp + '?text=' + encodeURIComponent(message);
    },

    productImage: function (url) {
      var value = String(url || '');
      return value.replace(
        /^(https:\/\/www\.xpertonecreative\.com)?(\/assets\/img\/products\/eye-face-protection\/.+)\.png$/i,
        function (_, origin, path) { return (origin || '') + path + '.webp'; }
      );
    }
  };

  function optimiseProductImages(root) {
    var scope = root || document;
    if (scope.nodeType === 1 && scope.tagName === 'IMG') {
      var one = scope.getAttribute('src');
      var optimised = XO.productImage(one);
      if (optimised !== one) scope.setAttribute('src', optimised);
    }
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll('img[src]').forEach(function (image) {
      var source = image.getAttribute('src');
      var optimised = XO.productImage(source);
      if (optimised !== source) image.setAttribute('src', optimised);
    });
  }

  optimiseProductImages(document);
  new MutationObserver(function (changes) {
    changes.forEach(function (change) {
      Array.prototype.forEach.call(change.addedNodes, optimiseProductImages);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* =======================================================================
     Catalog
     ======================================================================= */
  var Catalog = window.Catalog = {

    _cache: null,
    _promise: null,

    /* Map a raw API category string onto a storefront category. */
    _categoryFor: function (raw) {
      var v = String(raw || '').trim().toLowerCase();
      for (var i = 0; i < CFG.CATEGORIES.length; i++) {
        var c = CFG.CATEGORIES[i];
        for (var k = 0; k < c.apiKeys.length; k++) {
          if (c.apiKeys[k].toLowerCase() === v) return c;
        }
      }
      return null;
    },

    /* The live data contains size typos (3Xl, 2Xl, 3X) and inconsistent
       ordering (S/L/M/XL). Normalise both. */
    _sizes: function (raw) {
      var arr = raw;
      if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (e) { arr = raw ? String(raw).split(/[,/|]/) : []; }
      }
      if (!Array.isArray(arr)) arr = [];

      var fixed = arr.map(function (s) {
        var v = String(s).trim().toUpperCase();
        if (v === '3X') v = '3XL';
        if (v === '2X') v = '2XL';
        if (v === '4X') v = '4XL';
        if (v === '5X') v = '5XL';
        return v;
      }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });

      fixed.sort(function (a, b) {
        var ia = CFG.SIZE_ORDER.indexOf(a), ib = CFG.SIZE_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      return fixed;
    },

    _image: function (file) {
      if (!file) return '';
      var f = String(file);
      if (/^https?:\/\//i.test(f)) return f;
      f = f.replace(/^\/?uploads\//i, '');
      /* Filenames contain spaces and parentheses — encode, but keep slashes. */
      return CFG.UPLOADS_BASE + f.split('/').map(encodeURIComponent).join('/');
    },

    _normalise: function (row, sourceKey) {
      var cat = this._categoryFor(row.category) ||
                (sourceKey === 'helmets' ? this._categoryFor('helmet') : null);
      if (!cat) return null;

      var title = XO.decode(row.title);
      if (!title) return null;

      /* Test rows left in the live database. */
      if (/^test\d*$/i.test(title)) return null;

      var desc = XO.decode(row.label || '');
      var sub = XO.decode(row.sub_title || '');
      /* On vests the label column holds the description; on uniforms it
         holds a short attribute like "Front and Back Logo". */
      var isAttribute = desc && desc.length < 60;

      return {
        id: String(row.id),
      sku: row.sku || String(row.id),
      subcategory: row.subcategory || '',
        uid: cat.slug + '-' + row.id,
        source: sourceKey,
        title: title,
        slug: XO.slug(title) + '-' + row.id,
        category: cat.slug,
        categoryName: cat.name,
        price: Math.round(parseFloat(row.price || 0) * 100) / 100,
        sizes: this._sizes(row.size),
        images: [this._image(row.image_url || row.image)].filter(Boolean),
        attribute: isAttribute ? desc : '',
        description: isAttribute ? '' : desc,
        subtitle: sub
      };
    },

    _fromLive: function () {
      var self = this;
      var jobs = [
        fetch(CFG.API_BASE + CFG.ENDPOINTS.products).then(function (r) { return r.json(); })
          .then(function (j) { return { key: 'products', rows: Array.isArray(j) ? j : (j.data || []) }; }),
        fetch(CFG.API_BASE + CFG.ENDPOINTS.helmets).then(function (r) { return r.json(); })
          .then(function (j) { return { key: 'helmets', rows: Array.isArray(j) ? j : (j.data || []) }; })
          .catch(function () { return { key: 'helmets', rows: [] }; })
      ];
      return Promise.all(jobs).then(function (sets) {
        var out = [];
        sets.forEach(function (s) {
          s.rows.forEach(function (row) {
            var p = self._normalise(row, s.key);
            if (p) out.push(p);
          });
        });
        if (!out.length) throw new Error('Live catalogue returned no usable rows');
        return out;
      });
    },

    _fromLocal: function () {
      var self = this;
      return fetch('https://admin.xpertonecreative.com/api/catalogue')
        .then(function (r) { if (!r.ok) throw new Error('Catalogue unavailable'); return r.json(); })
        .then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('Invalid catalogue');
          return rows.map(function (p) { p.images = optimisedProductImages(p.images); return p; });
        }).catch(function () { return self._fromSnapshot(); });
    },

    _fromSnapshot: function () {
      var self = this;
      return Promise.all(Array.from({length:8}, function (_,i) {
          return fetch('/data/recovery/catalogue-' + (i+1) + '.json').then(function(r) {
            if (!r.ok) throw new Error('Catalogue snapshot unavailable'); return r.json();
          });
        })).then(function(parts) { return [].concat.apply([], parts); })
        .then(function (j) {
          var rows = Array.isArray(j) ? j : (j.products || []);
          /* The snapshot is already normalised, but run it through the same
             pipeline so both paths behave identically. */
          return rows.map(function (row) {
            var product = row.uid ? row : self._normalise(row, row.source || 'products');
            if (product) product.images = optimisedProductImages(product.images);
            return product;
          }).filter(Boolean);
        });
    },

    /* Live catalogue from Supabase. Prices, photos and details come from
       whatever is in the admin panel right now. Falls back to the bundled
       snapshot if Supabase is ever unreachable, so the shop never goes blank. */
    _fromSupabase: function () {
      var s = CFG.SUPABASE || {};
      /* PostgREST returns at most 1000 rows per request, so page through the
         catalogue until a short page comes back. Without this the shop
         silently drops every product past the first 1000. */
      var PAGE = 1000;
      function fetchPage(from, acc) {
        return fetch(s.url + '/rest/v1/products_public?select=*&order=sort_order', {
          headers: {
            apikey: s.key,
            'Range-Unit': 'items',
            Range: from + '-' + (from + PAGE - 1)
          },
          /* Never let the browser serve a stale catalogue. A price or photo
             changed in the admin panel must show on the next page load. */
          cache: 'no-store'
        })
          .then(function (r) {
            if (!r.ok) throw new Error('Supabase responded ' + r.status);
            return r.json();
          })
          .then(function (batch) {
            var rows = acc.concat(batch);
            return batch.length < PAGE ? rows : fetchPage(from + PAGE, rows);
          });
      }
      return fetchPage(0, [])
        .then(function (rows) {
          return rows.map(function (row) {
            return {
              id: row.sku,
              sku: row.sku,
              subcategory: row.subcategory || '',
              uid: row.category + '-' + String(row.sku).toLowerCase(),
              source: 'remart',
              title: row.title,
              slug: row.slug,
              category: row.category,
              categoryName: row.category_name,
              price: Number(row.price),
              priceStatus: row.price_is_fixed ? 'fixed' : 'indicative',
              sizes: row.sizes || [],
              images: (/^https?:\/\/[^/]*sbmmarketplace\.com\//i.test((row.images || [])[0] || ''))
                ? ['/assets/img/products/clean-reference/' + encodeURIComponent(row.category) + '/' + encodeURIComponent(row.sku) + '.webp?v=20260916exact']
                : optimisedProductImages((row.images || []).filter(function (image) {
                    return !/^https?:\/\/[^/]*sbmmarketplace\.com\//i.test(image || '');
                  })),
              imageSource: 'remart',
              attribute: row.attribute || '',
              description: row.description || '',
              subtitle: row.subtitle || '',
              code: '',
              features: row.features || [],
              material: row.material || '',
              colour: row.colour || '',
              origin: row.origin || '',
              standard: row.standard || '',
              packing: row.packing || '',
              unit: row.unit || 'Piece',
              gsm: row.gsm || '',
              dimensions: row.dimensions || '',
              page: row.catalogue_page || 0
            };
          });
        });
    },

    load: function () {
      var self = this;
      if (this._cache) return Promise.resolve(this._cache);
      if (this._promise) return this._promise;

      var mode = CFG.DATA_SOURCE;
      var p;
      if (mode === 'supabase') p = this._fromSupabase().catch(function (err) {
        console.warn('[Xpertone Creative LLC-FZ] Supabase unavailable, using bundled snapshot.', err);
        return self._fromLocal();
      });
      else if (mode === 'local') p = this._fromLocal();
      else if (mode === 'live') p = this._fromLive();
      else p = this._fromLive().catch(function (err) {
        console.warn('[Xpertone Creative LLC-FZ] Live catalogue unavailable, using bundled snapshot.', err);
        return self._fromLocal();
      });

      this._promise = p.then(function (list) {
        /* Stable order: category order from config, then price, then title. */
        var order = CFG.CATEGORIES.map(function (c) { return c.slug; });
        list.sort(function (a, b) {
          var d = order.indexOf(a.category) - order.indexOf(b.category);
          if (d) return d;
          if (a.price !== b.price) return a.price - b.price;
          return a.title.localeCompare(b.title);
        });
        self._cache = list;
        return list;
      });

      return this._promise;
    },

    byCategory: function (slug) {
      return this.load().then(function (list) {
        return slug && slug !== 'all'
          ? list.filter(function (p) { return p.category === slug; })
          : list;
      });
    },

    byUid: function (uid) {
      return this.load().then(function (list) {
        var slug = String(uid || '').indexOf('slug:') === 0 ? String(uid).slice(5) : '';
        for (var i = 0; i < list.length; i++) {
          if (list[i].uid === uid || (slug && list[i].slug === slug)) return list[i];
        }
        return null;
      });
    },

    /* Distinct products for the home page — one card per unique title,
       cheapest first, so the 12 near-identical uniform rows collapse. */
    highlights: function (limit) {
      return this.load().then(function (list) {
        var seen = {}, out = [];
        list.forEach(function (p) {
          var k = p.category + '|' + p.title;
          if (!seen[k]) { seen[k] = 1; out.push(p); }
        });
        return out.slice(0, limit || 8);
      });
    }
  };

  /* =======================================================================
     Pricing
     ======================================================================= */
  var Pricing = window.Pricing = {

    tierFor: function (qty) {
      var best = null;
      (CFG.PRICE_TIERS || []).forEach(function (t) {
        if (qty >= t.min && (!best || t.min > best.min)) best = t;
      });
      return best;
    },

    unitPrice: function (basePrice, qty) {
      var t = this.tierFor(qty);
      var p = t ? basePrice * (1 - t.discount) : basePrice;
      return Math.round(p * 100) / 100;
    },

    lineTotal: function (basePrice, qty) {
      return Math.round(this.unitPrice(basePrice, qty) * qty * 100) / 100;
    }
  };

  /* =======================================================================
     Cart
     ======================================================================= */
  var Cart = window.Cart = {

    _read: function () {
      try {
        var raw = localStorage.getItem(CFG.CART_KEY);
        var v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    },

    _write: function (lines) {
      try { localStorage.setItem(CFG.CART_KEY, JSON.stringify(lines)); } catch (e) {}
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { lines: lines } }));
      return lines;
    },

    lines: function () { return this._read(); },

    count: function () {
      var count = this._read().reduce(function (n, l) { return n + Cart.lineQty(l); }, 0);
      try {
        if (JSON.parse(localStorage.getItem('xo_giveaway_claim_v1') || 'null')) count += 1;
      } catch (e) {}
      return count;
    },

    lineQty: function (line) {
      return Object.keys(line.qty || {}).reduce(function (n, s) { return n + (line.qty[s] || 0); }, 0);
    },

    /* qtyBySize: { S: 20, M: 40, ... } — zero values are dropped. */
    add: function (product, qtyBySize, options) {
      var clean = {}, total = 0;
      Object.keys(qtyBySize || {}).forEach(function (s) {
        var n = XO.int(qtyBySize[s]);
        if (n > 0) { clean[s] = n; total += n; }
      });
      if (!total) return { ok: false, reason: 'empty' };

      var lines = this._read();
      var opts = options || {};
      var key = product.uid + '|' + (opts.logo ? 'logo' : 'plain');
      var existing = null;
      for (var i = 0; i < lines.length; i++) if (lines[i].key === key) { existing = lines[i]; break; }

      if (existing) {
        Object.keys(clean).forEach(function (s) {
          existing.qty[s] = (existing.qty[s] || 0) + clean[s];
        });
      } else {
        lines.push({
          key: key,
          uid: product.uid,
          slug: product.slug || '',
          id: product.id,
          source: product.source,
          title: product.title,
          category: product.category,
          categoryName: product.categoryName,
          price: product.price,
          priceStatus: product.priceStatus || '',
          image: product.images[0] || '',
          qty: clean,
          logo: !!opts.logo,
          note: opts.note || ''
        });
      }
      this._write(lines);
      return { ok: true, added: total };
    },

    setQty: function (key, size, qty) {
      var lines = this._read();
      lines.forEach(function (l) {
        if (l.key !== key) return;
        var n = XO.int(qty);
        if (n > 0) l.qty[size] = n; else delete l.qty[size];
      });
      lines = lines.filter(function (l) { return Cart.lineQty(l) > 0; });
      return this._write(lines);
    },

    remove: function (key) {
      return this._write(this._read().filter(function (l) { return l.key !== key; }));
    },

    clear: function () { return this._write([]); },

    totals: function () {
      var lines = this._read();
      var subtotal = 0, units = 0, savings = 0;

      lines.forEach(function (l) {
        var q = Cart.lineQty(l);
        units += q;
        var full = l.price * q;
        var net = Pricing.lineTotal(l.price, q);
        subtotal += net;
        savings += (full - net);
        if (l.logo && CFG.LOGO_PRINTING.pricePerUnit > 0) {
          subtotal += CFG.LOGO_PRINTING.pricePerUnit * q;
        }
      });

      subtotal = Math.round(subtotal * 100) / 100;
      var giveawayActive = false;
      try { giveawayActive = !!JSON.parse(localStorage.getItem('xo_giveaway_claim_v1') || 'null'); } catch (e) {}
      /* Giveaway orders always carry the advertised AED 30 delivery fee. */
      var delivery = giveawayActive && units > 0
        ? CFG.DELIVERY_FEE
        : ((units === 0 || subtotal >= CFG.FREE_DELIVERY_THRESHOLD) ? 0 : CFG.DELIVERY_FEE);
      var vat = Math.round((subtotal + delivery) * CFG.VAT_RATE * 100) / 100;
      var grand = Math.round((subtotal + delivery + vat) * 100) / 100;

      return {
        lines: lines.length,
        units: units,
        subtotal: subtotal,
        savings: Math.round(savings * 100) / 100,
        delivery: delivery,
        vat: vat,
        total: grand
      };
    },

    /* Builds the human-readable order used for the WhatsApp handoff and for
       the confirmation screen. */
    asMessage: function (customer) {
      var t = this.totals();
      var out = ['*NEW ORDER — Xpertone Creative LLC-FZ*', ''];

      this._read().forEach(function (l, i) {
        var q = Cart.lineQty(l);
        var sizes = Object.keys(l.qty)
          .sort(function (a, b) { return CFG.SIZE_ORDER.indexOf(a) - CFG.SIZE_ORDER.indexOf(b); })
          .map(function (s) { return s + ' x' + l.qty[s]; }).join(', ');
        out.push((i + 1) + '. ' + l.title);
        if (sizes) out.push('   Sizes: ' + sizes);
        out.push('   Qty: ' + q + '  |  Unit: ' + XO.money(Pricing.unitPrice(l.price, q)) +
                 '  |  Line: ' + XO.money(Pricing.lineTotal(l.price, q)));
        if (l.logo) out.push('   Logo printing: yes');
        if (l.note) out.push('   Note: ' + l.note);
        out.push('');
      });

      out.push('Subtotal (ex VAT): ' + XO.money(t.subtotal));
      if (t.savings > 0) out.push('Volume discount: -' + XO.money(t.savings));
      out.push('Delivery: ' + (t.delivery ? XO.money(t.delivery) : 'Free'));
      out.push('VAT 5%: ' + XO.money(t.vat));
      out.push('*Total: ' + XO.money(t.total) + '*');

      if (customer) {
        out.push('', '---', 'Company: ' + (customer.company || '-'),
                 'Contact: ' + (customer.name || '-'),
                 'Phone: ' + (customer.phone || '-'),
                 'Email: ' + (customer.email || '-'),
                 'Emirate: ' + (customer.emirate || '-'),
                 'Address: ' + (customer.address || '-'),
                 'Payment: ' + (customer.payment || '-'));
        if (customer.trn) out.push('TRN: ' + customer.trn);
        if (customer.notes) out.push('Notes: ' + customer.notes);
      }
      return out.join('\n');
    },

    /* Machine-readable payload — this is exactly what POST /api/orders.php
       should expect. Documented in docs/API.md. */
    asPayload: function (customer) {
      var t = this.totals();
      return {
        customer: customer || {},
        currency: CFG.CURRENCY,
        items: this._read().map(function (l) {
          var q = Cart.lineQty(l);
          return {
            product_id: l.id,
            source: l.source,
            title: l.title,
            category: l.category,
            unit_price: Pricing.unitPrice(l.price, q),
            list_price: l.price,
            quantities: l.qty,
            quantity_total: q,
            logo_printing: !!l.logo,
            note: l.note || '',
            line_total: Pricing.lineTotal(l.price, q)
          };
        }),
        totals: {
          subtotal_ex_vat: t.subtotal,
          volume_discount: t.savings,
          delivery: t.delivery,
          vat_rate: CFG.VAT_RATE,
          vat_amount: t.vat,
          grand_total: t.total
        },
        meta: {
          source: 'web',
          submitted_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      };
    }
  };

})();
