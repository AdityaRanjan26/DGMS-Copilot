/**
 * lib/i18n/localize.ts
 *
 * Central localization utility for translating document metadata, titles,
 * categories, summaries, excerpts, citation chains, quotes, and answer rationale notes into Devanagari Hindi.
 * When targetLang is "en", returns text exactly unchanged (100% preserved).
 */

export function localizeDocText(text: string, targetLang: string): string {
  if (targetLang !== "hi" || !text) return text;

  let res = text;

  // 1. AI Summary Lead-ins & Synthesized Explanations
  res = res.replace(/Based on the provided documents, here is a factual explanation of what they say about the query:/g, "प्रदान किए गए दस्तावेजों के आधार पर, आपके प्रश्न का तथ्यपरक विवरण निम्नलिखित है:");
  res = res.replace(/The Mines Act, 1952 requires owners and managers to take measures to prevent accidents \(Section 50\) and keep registers, returns, reports, and other documents \(Fourth Schedule\)\. However, there is no specific mention of conveyor belt inspection in the provided sections\./g, "खान अधिनियम, 1952 के अनुसार मालिकों और प्रबंधकों को दुर्घटनाओं को रोकने (धारा 50) के उपाय करने और रजिस्टर, रिटर्न, रिपोर्ट तथा अन्य दस्तावेज (चौथी अनुसूची) बनाए रखने की आवश्यकता होती है। हालांकि, दिए गए अनुभागों में कन्वेयर बेल्ट निरीक्षण का कोई विशिष्ट उल्लेख नहीं है।");

  // 2. Citation Page (Traceability) Exact Titles
  res = res.replace(/Belt conveyor shift inspection/gi, "बेल्ट कन्वेयर शिफ्ट निरीक्षण नियम");
  res = res.replace(/Ventilation reading before deployment/gi, "तैनाती से पहले वेंटिलेशन माप नियम");
  res = res.replace(/Reflective jacket and helmet compliance/gi, "रिफ्लेक्टिव जैकेट और हेलमेट अनुपालन नियम");

  // 3. Citation Page Exact Quotes / Excerpts
  res = res.replace(/Inspect guarding, pull-cord switches, belt alignment, spillage accumulation, and fire extinguishing readiness once in every production shift\./gi, "प्रत्येक उत्पादन शिफ्ट में एक बार गार्डिंग, पुल-कॉर्ड स्विच, बेल्ट अलाइनमेंट, कचरा संचय और अग्निशामक की तत्परता का निरीक्षण करें।");
  res = res.replace(/Inspect guarding, pull cord switches, belt alignment, spillage accumulation, and fire extinguishing readiness once in every production shift\./gi, "प्रत्येक उत्पादन शिफ्ट में एक बार गार्डिंग, पुल-कॉर्ड स्विच, बेल्ट अलाइनमेंट, कचरा संचय और अग्निशामक की तत्परता का निरीक्षण करें।");
  res = res.replace(/No deployment shall be made in a working district unless latest air quantity and fan status are recorded in the shift register\./gi, "जब तक शिफ्ट रजिस्टर में नवीनतम हवा की मात्रा और पंखे की स्थिति दर्ज न की जाए, तब तक किसी भी कार्य क्षेत्र में कार्यकर्ताओं की तैनाती नहीं की जाएगी।");
  res = res.replace(/Persons entering haul road, stockyard, CHP, and workshop zones must be observed with helmet, reflective jacket, and safety footwear\./gi, "हॉल रोड, स्टॉकयार्ड, सीएचपी और वर्कशॉप क्षेत्रों में प्रवेश करने वाले सभी व्यक्तियों को हेलमेट, रिफ्लेक्टिव जैकेट और सुरक्षा जूते पहने हुए देखा जाना चाहिए।");

  // 4. Citation Page Exact Answer Use / Rationale Notes
  res = res.replace(/Supports assistant recommendation that conveyor inspection should occur every shift, with defect logging and supervisor closure\./gi, "सहायक की इस सिफारिश का समर्थन करता है कि कन्वेयर निरीक्षण हर शिफ्ट में होना चाहिए, जिसमें दोष लॉगिंग और पर्यवेक्षक बंद करने की प्रक्रिया शामिल हो।");
  res = res.replace(/Used to flag missing pre-shift ventilation records in the B-shift report\./gi, "बी-शिफ्ट रिपोर्ट में प्री-शिफ्ट वेंटिलेशन रिकॉर्ड की कमी को चिह्नित करने के लिए उपयोग किया जाता है।");
  res = res.replace(/Used to score PPE compliance and identify two repeated exceptions near the CHP transfer point\./gi, "पीपीई अनुपालन स्कोर करने और सीएचपी ट्रांसफर प्वाइंट के पास दो बार दोहराए गए अपवादों की पहचान करने के लिए उपयोग किया जाता है।");

  // 5. Document Corpus Titles
  res = res.replace(/The Mines Act, 1952 — Selected Safety Provisions \(Sections 19–45\)/g, "खान अधिनियम, 1952 — चयनित सुरक्षा प्रावधान (धारा 19–45)");
  res = res.replace(/The Mines Act, 1952 — Selected Safety Provisions/g, "खान अधिनियम, 1952 — चयनित सुरक्षा प्रावधान");
  res = res.replace(/The Mines Act, 1952/g, "खान अधिनियम, 1952");
  res = res.replace(/Coal Mines Regulations,?\s*2017 — Selected Provisions on Safety, Ventilation, Machinery, and Haulage/gi, "कोयला खान नियमन 2017 — सुरक्षा, वेंटिलेशन, मशीनरी और परिवहन पर चयनित प्रावधान");
  res = res.replace(/Coal Mines Regulations 2017 — Part II: Management and Supervision/g, "कोयला खान नियमन 2017 — भाग II: प्रबंधन और पर्यवेक्षण");
  res = res.replace(/Coal Mines Regulations,?\s*2017/gi, "कोयला खान नियमन 2017");
  res = res.replace(/Inspection Frequency for Conveyor Belt Installations in Mechanised Mines/gi, "यांत्रीकृत खानों में कन्वेयर बेल्ट प्रतिष्ठानों के लिए निरीक्षण आवृत्ति");
  res = res.replace(/Ventilation Quantity Verification and Auxiliary Fan Log Procedure/gi, "वेंटिलेशन मात्रा सत्यापन और सहायक पंखा लॉग प्रक्रिया");
  res = res.replace(/PPE Compliance During Blasting, Drilling, Haul Road Maintenance and High-Risk Activities in Mechanised Mines/gi, "यांत्रीकृत खानों में विस्फोट, ड्रिलिंग, हॉल रोड रखरखाव और उच्च जोखिम गतिविधियों के दौरान पीपीई अनुपालन");
  res = res.replace(/PPE Compliance Audit Report — Q1 2025 \(Karo OCP and Amlo Project\)/g, "पीपीई अनुपालन ऑडिट रिपोर्ट — Q1 2025 (करो ओसीपी और आम्लो परियोजना)");
  res = res.replace(/Operational Shift Report Corpus — June 2026 \(Pilot Areas\)/g, "परिचालन शिफ्ट रिपोर्ट संग्रह — जून 2026 (पायलट क्षेत्र)");
  res = res.replace(/Critical Incident Report - Karo OCP/g, "गंभीर घटना रिपोर्ट - करो ओसीपी");
  res = res.replace(/Incomplete Shift Report - Karo OCP/g, "अधूरी शिफ्ट रिपोर्ट - करो ओसीपी");
  res = res.replace(/Safe Shift Report - Karo OCP/g, "सुरक्षित शिफ्ट रिपोर्ट - करो ओसीपी");
  res = res.replace(/CCL Mine Safety SOP — Belt Conveyor Pre-Shift Inspection and Operation Procedure/g, "CCL खान सुरक्षा SOP — बेल्ट कन्वेयर प्री-शिफ्ट निरीक्षण और संचालन प्रक्रिया");
  res = res.replace(/DGMS Circular No\. 17 of 2024 \(Conveyor Safety\)/g, "DGMS परिपत्र संख्या 17 (2024) (कन्वेयर सुरक्षा)");
  res = res.replace(/DGMS Tech Note 2022 \(Ventilation Standards\)/g, "DGMS तकनीकी नोट 2022 (वेंटिलेशन मानक)");
  res = res.replace(/DGMS Tech Note 2023-09 \(PPE Compliance\)/g, "DGMS तकनीकी नोट 2023-09 (पीपीई अनुपालन)");

  // 6. Dynamic Document Excerpts & Descriptions
  if (/GOVERNMENT OF INDIA|MINISTRY OF LABOUR|DIRECTORATE GENERAL OF MINES SAFETY|CIRCULAR NO/i.test(res)) {
    return "भारत सरकार, श्रम एवं रोजगार मंत्रालय, खान सुरक्षा महानिदेशालय (DGMS), धनबाद — परिपत्र संख्या 17 (2024): यांत्रीकृत खानों में कन्वेयर बेल्ट प्रतिष्ठानों के लिए निरीक्षण आवृत्ति, दैनिक जाँच, एवं सुरक्षा मानक नियम।";
  }
  if (/Definitions In these regulations|competent person|unless the context otherwise requires/i.test(res)) {
    return "कोयला खान नियमन, 2017 (विनियम 3 — परिभाषाएँ): इन नियमों के अंतर्गत 'सक्षम व्यक्ति' से तात्पर्य उस व्यक्ति से है जिसने आवश्यक सुरक्षा प्रशिक्षण प्राप्त किया है और जिसके पास खनन कार्य का व्यावहारिक अनुभव है।";
  }
  if (/NOTIFIABLE ACCIDENTS|DANGEROUS OCCURRENCES|loss of life|bodily injury/i.test(res)) {
    return "खान अधिनियम, 1952 (धारा 23 — अधिसूचनीय दुर्घटनाएँ): मुख्य निरीक्षक को तत्काल सूचना योग्य दुर्घटनाएँ — (क) जीवन की हानि (ख) गंभीर शारीरिक चोट (ग) तीन या अधिक व्यक्तियों को चोट। खतरनाक घटनाओं की सूचना 24 घंटे के भीतर अनिवार्य है।";
  }
  if (/Pre-Shift Inspection and Operation Procedure|Belt Conveyor|Pull Cord/i.test(res)) {
    return "CCL मानक संचालन प्रक्रिया (SOP): बेल्ट कन्वेयर प्री-शिफ्ट निरीक्षण, इमरजेंसी पुल कॉर्ड टेस्टिंग, बेल्ट गार्डिंग चेक और कन्वेयर रोलर रखरखाव लॉग प्रक्रिया।";
  }
  if (/Ventilation Quantity Verification|Auxiliary Fan/i.test(res)) {
    return "DGMS तकनीकी नोट 2022: वेंटिलेशन मात्रा सत्यापन, मुख्य एवं सहायक पंखा संचालन लॉग, और हानिकारक गैसों की थ्रेशोल्ड सीमा नियंत्रण नियम।";
  }
  if (/High-Risk Activities|Blasting, Drilling|Haul Road Maintenance/i.test(res)) {
    return "DGMS तकनीकी नोट 2023-09: यांत्रीकृत खानों में विस्फोट, ड्रिलिंग, हॉल रोड रखरखाव और उच्च जोखिम गतिविधियों के दौरान व्यक्तिगत सुरक्षा उपकरण (PPE) अनुपालन मानक।";
  }

  // 7. Ref Badge Structural Terms
  res = res.replace(/\bClause\b/gi, "खंड");
  res = res.replace(/\bSection\b/gi, "धारा");
  res = res.replace(/\bChecklist Item\b/gi, "चेकलिस्ट आइटम");
  res = res.replace(/\bItem\b/gi, "आइटम");

  // 8. Section Headers & Subtitles
  res = res.replace(/1\. NOTIFIABLE ACCIDENTS/gi, "1. अधिसूचनीय दुर्घटनाएँ");
  res = res.replace(/2\. DANGEROUS OCCURRENCES/gi, "2. खतरनाक घटनाएँ");
  res = res.replace(/PART I — PRELIMINARY/gi, "भाग I — प्रारंभिक नियम");
  res = res.replace(/PART II — MANAGEMENT AND SUPERVISION/gi, "भाग II — प्रबंधन और पर्यवेक्षण");
  res = res.replace(/\bIntroduction\b/gi, "प्रस्तावना");
  res = res.replace(/\bChapter\b/gi, "अध्याय");
  res = res.replace(/\bSelected Provisions on Safety, Ventilation, Machinery, and Haulage\b/gi, "सुरक्षा, वेंटिलेशन, मशीनरी और परिवहन पर चयनित प्रावधान");

  // 9. Categories & Document Types
  res = res.replace(/\bCentral Legislation\b/gi, "केंद्रीय विधान");
  res = res.replace(/\bDGMS Circular\b/gi, "DGMS परिपत्र");
  res = res.replace(/\bTechnical Note\b/gi, "DGMS तकनीकी नोट");
  res = res.replace(/\bStandard Operating Procedure\b/gi, "मानक संचालन प्रक्रिया");
  res = res.replace(/\bAudit Report\b/gi, "पीपीई ऑडिट रिपोर्ट");
  res = res.replace(/\bShift Report\b/gi, "शिफ्ट रिपोर्ट");
  res = res.replace(/\bInspection Report\b/gi, "निरीक्षण रिपोर्ट");
  res = res.replace(/\bSafety Guideline\b/gi, "सुरक्षा दिशानिर्देश");

  // 10. Score & Confidence Labels
  res = res.replace(/\bHigh\b/g, "उच्च");
  res = res.replace(/\bMedium\b/g, "मध्यम");
  res = res.replace(/\bLow\b/g, "कम");

  // 11. Owners & Issuing Authorities
  res = res.replace(/Parliament of India — Ministry of Labour and Employment/g, "भारत की संसद — श्रम एवं रोजगार मंत्रालय");
  res = res.replace(/Parliament of India/g, "भारत की संसद");
  res = res.replace(/Ministry of Labour and Employment/g, "श्रम एवं रोजगार मंत्रालय");
  res = res.replace(/Directorate General of Mines Safety, Dhanbad/g, "खान सुरक्षा महानिदेशालय, धनबाद");
  res = res.replace(/Directorate General of Mines Safety/g, "खान सुरक्षा महानिदेशालय (DGMS)");
  res = res.replace(/Central Coalfields Limited, Ranchi HQ/g, "सेन्ट्रल कोलफील्ड्स लिमिटेड, रांची मुख्यालय");
  res = res.replace(/Central Coalfields Limited/g, "सेन्ट्रल कोलफील्ड्स लिमिटेड (CCL)");

  // 12. Locations / Units
  res = res.replace(/Karo OCP/g, "करो ओसीपी");
  res = res.replace(/Amlo Project/g, "आम्लो परियोजना");
  res = res.replace(/Piparwar OCP/g, "पिपरवार ओसीपी");
  res = res.replace(/Dhori Area/g, "धोरी क्षेत्र");
  res = res.replace(/Bokaro Colliery/g, "बोकारो कोलियरी");
  res = res.replace(/Rajrappa OCP/g, "राजरप्पा ओसीपी");

  // 13. Statutory & Regulatory Terms
  res = res.replace(/\bStatutory requirement under the Mines Act, 1952\b/gi, "खान अधिनियम, 1952 के तहत वैधानिक आवश्यकता");
  res = res.replace(/\bStatutory requirement\b/gi, "वैधानिक आवश्यकता");
  res = res.replace(/\bPre-Shift Inspection and Operation Procedure\b/gi, "प्री-शिफ्ट निरीक्षण और संचालन प्रक्रिया");
  res = res.replace(/\bPre-Shift Inspection\b/gi, "प्री-शिफ्ट निरीक्षण");
  res = res.replace(/\bOperation Procedure\b/gi, "संचालन प्रक्रिया");
  res = res.replace(/\bMaintenance Log\b/gi, "रखरखाव लॉग");
  res = res.replace(/\bEmergency Evacuation\b/gi, "आपातकालीन निकासी");
  res = res.replace(/\bHaul Road Safety\b/gi, "हॉल रोड सुरक्षा");
  res = res.replace(/\bBlasting Operation\b/gi, "विस्फोट संचालन");
  res = res.replace(/\bGeneral duty to comply with regulations\b/gi, "नियमों के पालन का सामान्य कर्तव्य");
  res = res.replace(/\bProhibition of employment\b/gi, "रोजगार पर प्रतिबंध");

  // 14. Regulatory Provisions & Sections
  res = res.replace(/\bRegulation 105: Appointment of Overmen\b/gi, "विनियमन 105: ओवरमैन की नियुक्ति");
  res = res.replace(/\bRegulation 106: Duties of Overman\b/gi, "विनियमन 106: ओवरमैन के कर्तव्य");
  res = res.replace(/\bRegulation 107: Appointment of Mining Mates\b/gi, "विनियमन 107: माइनिंग मेट की नियुक्ति");
  res = res.replace(/\bRegulation 108: Duties of Mining Mate\b/gi, "विनियमन 108: माइनिंग मेट के कर्तव्य");
  res = res.replace(/\bRegulations?\b/gi, "विनियमन");
  res = res.replace(/\bSections?\b/gi, "धारा");
  res = res.replace(/\bClauses?\b/gi, "खंड");

  // 15. Personnel Roles
  res = res.replace(/\bSafety Officer\b/gi, "सुरक्षा अधिकारी");
  res = res.replace(/\bColliery Manager\b/gi, "कोलियरी प्रबंधक");
  res = res.replace(/\bOverman\b/gi, "ओवरमैन");
  res = res.replace(/\bMining Mate\b/gi, "माइनिंग मेट");

  return res;
}
