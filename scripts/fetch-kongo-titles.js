#!/usr/bin/env node
/** Récupère les titres des vidéos YouTube du Pasteur Kongo */
const fs = require("fs");
const path = require("path");

const rawLinks = `
https://www.youtube.com/watch?v=tLxxqPG3_cY
https://www.youtube.com/watch?v=IjEV40yRCaM
https://www.youtube.com/watch?v=rpz1Y6oU9bQ
https://www.youtube.com/watch?v=rC75uUpaInc
https://www.youtube.com/watch?v=Do2adPQQ0uA
https://www.youtube.com/watch?v=_OPtihJngLA
https://www.youtube.com/watch?v=auleAOj1fwk
https://www.youtube.com/watch?v=tz7Jr7CrdEw
https://www.youtube.com/watch?v=YUuke0AvgiQ
https://www.youtube.com/watch?v=Jp_eoM4LjMc
https://www.youtube.com/watch?v=FTphuH7CZwI
https://www.youtube.com/watch?v=1De4kJltMEE
https://www.youtube.com/watch?v=DaQll1u-4Jw
https://www.youtube.com/watch?v=8zIpJCpyF9Q
https://www.youtube.com/watch?v=WmaO6xIdRA4
https://www.youtube.com/watch?v=FS1BHDLMY8w
https://www.youtube.com/watch?v=z8n0D0SvUH8
https://www.youtube.com/watch?v=xhYWfRT29rU
https://www.youtube.com/watch?v=HutNeddaP9k
https://www.youtube.com/watch?v=JNS95_kKwQ4
https://www.youtube.com/watch?v=8ukQ4SJJUik
https://www.youtube.com/watch?v=RvKyKrhYuF4
https://www.youtube.com/watch?v=lSECDhyJQQM
https://www.youtube.com/watch?v=kzjbpusyrYY
https://www.youtube.com/watch?v=rBAV0muOsV0
https://www.youtube.com/watch?v=oy25ena_WLQ
https://www.youtube.com/watch?v=vsGjJ_03r44
https://www.youtube.com/watch?v=iaSMIUGjbTM
https://www.youtube.com/watch?v=-o3lsdeB-Z8
https://www.youtube.com/watch?v=cXmQ91vJu-g
https://www.youtube.com/watch?v=wcMiQUin1Ts
https://www.youtube.com/watch?v=0WIWNF-BpQE
https://www.youtube.com/watch?v=X16KTtGKU3Y
https://www.youtube.com/watch?v=e8E-wXLq71s
https://www.youtube.com/watch?v=mEVf8uSnNN4
https://www.youtube.com/watch?v=1mN8NkICaKk
https://www.youtube.com/watch?v=bAkewqMeWDE
https://www.youtube.com/watch?v=nmTaDFE8UGk
https://www.youtube.com/watch?v=oZq9bTPSDsg
https://www.youtube.com/watch?v=KZmsNhNDNmU
https://www.youtube.com/watch?v=oQiHXrBXkRY
https://www.youtube.com/watch?v=PDhBiW37vjg
https://www.youtube.com/watch?v=QJdl4svCaWg
https://www.youtube.com/watch?v=Fug6GzyvuIU
https://www.youtube.com/watch?v=rlEiZe1iczA
https://www.youtube.com/watch?v=2Hbjy1RcKZg
https://www.youtube.com/watch?v=JSUKy46zsrw
https://www.youtube.com/watch?v=uCbKlCUomDw
https://www.youtube.com/watch?v=F2W9upvszMc
https://www.youtube.com/watch?v=4cRjFPoZeNI
https://www.youtube.com/watch?v=WCvLHcTTIjk
https://www.youtube.com/watch?v=YhihIVVRRG4
https://www.youtube.com/watch?v=N2rn_xUboSU
https://www.youtube.com/watch?v=VJ7AeqPnAq0
https://www.youtube.com/watch?v=bX1ELMClpCk
https://www.youtube.com/watch?v=T_nUa7NHPU4
https://www.youtube.com/watch?v=Kc3JHvqj_j4
https://www.youtube.com/watch?v=bZg4j_m8mkg
https://www.youtube.com/watch?v=ietXD-_8-rc
https://www.youtube.com/watch?v=-t8G3DPsZa8
https://www.youtube.com/watch?v=--kWbH8Emx4
https://www.youtube.com/watch?v=E-IE_EDSevc
https://www.youtube.com/watch?v=OuciQbPmJnE
https://www.youtube.com/watch?v=ux-FKHS5SxU
https://www.youtube.com/watch?v=_LEuRJyJ9Kg
https://www.youtube.com/watch?v=wWOJB9aEy9g
https://www.youtube.com/watch?v=Z0abd5dSEIo
https://www.youtube.com/watch?v=wQr0NTomkQ8
https://www.youtube.com/watch?v=-LKSdCOqi8M
https://www.youtube.com/watch?v=04VFs0K6T9s
https://www.youtube.com/watch?v=3fznXVUpOWo
https://www.youtube.com/watch?v=Y5Ss_NyLRDs
https://www.youtube.com/watch?v=rkYHmeHRjBA
https://www.youtube.com/watch?v=oIHEWrASgwo
https://www.youtube.com/watch?v=BhwefC4bXwk
https://www.youtube.com/watch?v=TldKTKo3QmI
https://www.youtube.com/watch?v=mWDRjToSgHA
https://www.youtube.com/watch?v=vm498TaTH9g
https://www.youtube.com/watch?v=LeT6yoJq1sU
https://www.youtube.com/watch?v=APl5Ds4ydrI
https://www.youtube.com/watch?v=-7BrBa6NWo4
https://www.youtube.com/watch?v=rkRay3o88s0
https://www.youtube.com/watch?v=DkxiIJDyrTM
https://www.youtube.com/watch?v=79BFcQPfTdM
https://www.youtube.com/watch?v=qFgCGno22w4
https://www.youtube.com/watch?v=1j7-hJkOLLg
https://www.youtube.com/watch?v=jty8vqBLFNw
https://www.youtube.com/watch?v=4h4h4Vox7og
https://www.youtube.com/watch?v=Owkg5NS-qGk
https://www.youtube.com/watch?v=LdGCNwORGJk
https://www.youtube.com/watch?v=C0ytvflSdp4
https://www.youtube.com/watch?v=u9vvFLJG5Wc
https://www.youtube.com/watch?v=de41tPtLH9w
https://www.youtube.com/watch?v=bDtqVhbwas0
https://www.youtube.com/watch?v=cuhg4sL2Hy0
https://www.youtube.com/watch?v=incOJLSf-A8
https://www.youtube.com/watch?v=pJTwMQVCYJE
https://www.youtube.com/watch?v=32p7JTJMRVA
https://www.youtube.com/watch?v=3qVO1Kr69x0
https://www.youtube.com/watch?v=2hVNCmDOD1I
https://www.youtube.com/watch?v=uzbSdrbYMI8
https://www.youtube.com/watch?v=TmiEv42KIWo
https://www.youtube.com/watch?v=2d1whtsX3mg
https://www.youtube.com/watch?v=ukC8EtNPR9w
https://www.youtube.com/watch?v=rP1x1u3W00c
https://www.youtube.com/watch?v=hV2PhqZuVNM
https://www.youtube.com/watch?v=hDpxZfce5zw
https://www.youtube.com/watch?v=0TTGSnFtDg4
https://www.youtube.com/watch?v=thI79XhSpcc
https://www.youtube.com/watch?v=u9FnSYDIM8c
https://www.youtube.com/watch?v=HB8f9CBvUnA
https://www.youtube.com/watch?v=XykXpj6TxBs
https://www.youtube.com/watch?v=xz2EuC3bdKY
https://www.youtube.com/watch?v=Y9_LZTcw8yg
https://www.youtube.com/watch?v=SbPtAP3FaYM
https://www.youtube.com/watch?v=CDBKQ4wR1bs
https://www.youtube.com/watch?v=bihtunH-E58
https://www.youtube.com/watch?v=CcxhtBKDxMg
https://www.youtube.com/watch?v=lO2R2zZ8gnM
https://www.youtube.com/watch?v=RyZNMctamiM
https://www.youtube.com/watch?v=U-2zHJ5HjMI
https://www.youtube.com/watch?v=de_NtTkESdg
https://www.youtube.com/watch?v=3DFFqafjPrE
https://www.youtube.com/watch?v=Q0oCozKfo7M
https://www.youtube.com/watch?v=tPO5CcZXDJU
https://www.youtube.com/watch?v=h6AsnkEb-4U
https://www.youtube.com/watch?v=oUZvV7kzEr4
https://www.youtube.com/watch?v=riyzhUW-xpg
https://www.youtube.com/watch?v=eBX28c9DoII
https://www.youtube.com/watch?v=KauATtLrjm4
https://www.youtube.com/watch?v=bLfEeKsYBxo
https://www.youtube.com/watch?v=ZfutjDmwQKc
https://www.youtube.com/watch?v=2R3WoMcLzSY
https://www.youtube.com/watch?v=NsONx477ZEE
https://www.youtube.com/watch?v=v6LxMTaLn4w
https://www.youtube.com/watch?v=yvMEMr8E7KA
https://www.youtube.com/watch?v=EXVogMkONNI
https://www.youtube.com/watch?v=vZZSIFXWXxA
https://www.youtube.com/watch?v=AvgAKKlLWxQ
https://www.youtube.com/watch?v=eAWl1pa5p1E
https://www.youtube.com/watch?v=bwgtJP-Y6UI
https://www.youtube.com/watch?v=kmXMT9V1x-U
https://www.youtube.com/watch?v=bg6-n7UD4gI
https://www.youtube.com/watch?v=hwubf88Fw34
https://www.youtube.com/watch?v=U2Jn95hMt0s
https://www.youtube.com/watch?v=AIotcdAy8h8
https://www.youtube.com/watch?v=tK74ufgpwc8
https://www.youtube.com/watch?v=Kv_eHBonrXo
https://www.youtube.com/watch?v=LpiDd_u1O1U
https://www.youtube.com/watch?v=3ivj8ErE1cI
https://www.youtube.com/watch?v=-6mUHPYE8eg
https://www.youtube.com/watch?v=TNcHPRUtyTY
https://www.youtube.com/watch?v=tK5Ns1NGlsA
https://www.youtube.com/watch?v=7AqMy2F2BBg
https://www.youtube.com/watch?v=yDhk69uUstI
https://www.youtube.com/watch?v=HxHm_jRGKx8
https://www.youtube.com/watch?v=dcrqYj1rvtA
https://www.youtube.com/watch?v=DKPYHWDsl0A
https://www.youtube.com/watch?v=SEmKVXhCFeM
https://www.youtube.com/watch?v=DZnxbXTh5MI
https://www.youtube.com/watch?v=yKedjtfiLso
https://www.youtube.com/watch?v=gUcJs-DCSmc
https://www.youtube.com/watch?v=ttmMU8vx7_M
https://www.youtube.com/watch?v=J2xtkPZ8Srk
https://www.youtube.com/watch?v=0s7s9jJx0Pg
https://www.youtube.com/watch?v=2KWHSwHXuNY
https://www.youtube.com/watch?v=i2hgolVwodc
https://www.youtube.com/watch?v=v08f5XuQhOI
https://www.youtube.com/watch?v=1xqH8eGit3A
https://www.youtube.com/watch?v=cOnhTV7xOoY
https://www.youtube.com/watch?v=lOs5YPTblZM
https://www.youtube.com/watch?v=WlqpSOB_gVM
https://www.youtube.com/watch?v=yvll0sigD2o
https://www.youtube.com/watch?v=dsLtPaZMfnM
https://www.youtube.com/watch?v=l8_ceJx3tf0
https://www.youtube.com/watch?v=wzqnhcatjZA
https://www.youtube.com/watch?v=oLIkqx4v_ZI
https://www.youtube.com/watch?v=5j4INDHRvgw
https://www.youtube.com/watch?v=NmM74JnexgU
https://www.youtube.com/watch?v=yWPyFJ3cXaM
https://www.youtube.com/watch?v=GwRROxvYxN0
https://www.youtube.com/watch?v=zZv0G4KlgCM
https://www.youtube.com/watch?v=PTo7Cnx7HoI
https://www.youtube.com/watch?v=AvrF0H_tnfw
https://www.youtube.com/watch?v=OO23JV_DAxs
https://www.youtube.com/watch?v=gac5sP-B_sw
https://www.youtube.com/watch?v=c9sOLLrbegQ
https://www.youtube.com/watch?v=QJWG3W7tNgY
https://www.youtube.com/watch?v=F-Z5QFZCauU
https://www.youtube.com/watch?v=LeIKlKx0kDE
https://www.youtube.com/watch?v=gAbIjLZD5vY
https://www.youtube.com/watch?v=7pZb9p9ODdI
https://www.youtube.com/watch?v=Lgn0fxCKoZI
https://www.youtube.com/watch?v=2BF6SGCttdU
https://www.youtube.com/watch?v=5bcd1VKqGwA
https://www.youtube.com/watch?v=WsVGuc85wLY
https://www.youtube.com/watch?v=FcLi97W0ejo
https://www.youtube.com/watch?v=VBDngq2LoJA
https://www.youtube.com/watch?v=CfNJMbzwKKg
https://www.youtube.com/watch?v=xpYWAvjx7Oc
https://www.youtube.com/watch?v=w4iq_1BHdyU
https://www.youtube.com/watch?v=tnZKGny37hw
https://www.youtube.com/watch?v=coDOsyngmx8
https://www.youtube.com/watch?v=QHsGvizJGuA
https://www.youtube.com/watch?v=ahsYwUDwl10
https://www.youtube.com/watch?v=T0a3laKHVvs
https://www.youtube.com/watch?v=Wp1rqUqOllg
https://www.youtube.com/watch?v=fZQVVOFH8fc
https://www.youtube.com/watch?v=XTxtDnEhdbA
https://www.youtube.com/watch?v=gGFavqQGEX8
https://www.youtube.com/watch?v=PlHSk_wH_lg
https://www.youtube.com/watch?v=15JsekeIFzA
https://www.youtube.com/watch?v=Gaxc5AIJQW8
https://www.youtube.com/watch?v=BZSMtCmXZg8
https://www.youtube.com/watch?v=JdIdGURHmAU
https://www.youtube.com/watch?v=me9hROK6k4Q
https://www.youtube.com/watch?v=hOZM7ibl9Ns
https://www.youtube.com/watch?v=Tkec3nZaXhk
https://www.youtube.com/watch?v=NCD3gejQPfc
https://www.youtube.com/watch?v=njQBuPVR42Y
https://www.youtube.com/watch?v=HSEeICaIP2o
https://www.youtube.com/watch?v=jNlQPrWgxS0
https://www.youtube.com/watch?v=6O2AcqUk_mg
https://www.youtube.com/watch?v=6GdUHH1SDhM
https://www.youtube.com/watch?v=AVjNo5VmqUw
https://www.youtube.com/watch?v=lY8K5pUD2aw
https://www.youtube.com/watch?v=gb7CngOvzVc
https://www.youtube.com/watch?v=3GPAH1XWEuo
https://www.youtube.com/watch?v=Dfovvzfhy84
https://www.youtube.com/watch?v=QVFztO6RW3g
https://www.youtube.com/watch?v=xF58NtUIrKc
https://www.youtube.com/watch?v=RhZ4kjv3pjM
https://www.youtube.com/watch?v=iSOoeI-nHls
https://www.youtube.com/watch?v=wg9SxvHftyg
https://www.youtube.com/watch?v=r2siU2vthLk
https://www.youtube.com/watch?v=AOlrKLPetIU
https://www.youtube.com/watch?v=uRu94pinBeQ
https://www.youtube.com/watch?v=vuPGL1AIHag
https://www.youtube.com/watch?v=OIUXxN5nnuY
https://www.youtube.com/watch?v=ZpY2SfqDK_s
https://www.youtube.com/watch?v=FrEpqVkLSwA
https://www.youtube.com/watch?v=DSHdZsxIB9w
https://www.youtube.com/watch?v=PPjfCL7dsHU
https://www.youtube.com/watch?v=Ih0IM3kE_u8
https://www.youtube.com/watch?v=6yynVvvwCW8
https://www.youtube.com/watch?v=LkY21uNrR3w
https://www.youtube.com/watch?v=gICNdX0n0eE
https://www.youtube.com/watch?v=3pqqSCqB_yA
https://www.youtube.com/watch?v=HrzVZvqLtvo
`;

const lines = [...new Set(rawLinks.trim().split("\n").filter(l => l.trim()))];
const ids = lines.map(link => {
  const match = link.match(/v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}).filter(Boolean);

console.log(`Total IDs Kongo uniques: ${ids.length}`);

async function fetchTitle(id) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return { id, title: data.title, author: data.author_name };
    }
  } catch (e) {}
  return { id, title: `Vidéo Pasteur Kongo`, author: "Pasteur Kongo" };
}

async function main() {
  console.log("Récupération titres Kongo...");
  const results = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const titles = await Promise.all(batch.map(fetchTitle));
    results.push(...titles);
    console.log(`  ${Math.min(i + 10, ids.length)}/${ids.length}`);
    if (i + 10 < ids.length) await new Promise(r => setTimeout(r, 500));
  }
  fs.writeFileSync(path.join(__dirname, "kongo-youtube-titles.json"), JSON.stringify(results, null, 2));
  console.log(`Sauvegardé: ${results.length} titres`);
}
main().catch(console.error);
