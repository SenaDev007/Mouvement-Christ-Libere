#!/usr/bin/env node
/**
 * Récupère les titres des vidéos YouTube via l'API oEmbed (gratuite, sans clé API)
 * et génère le fichier videos-exemple.ts mis à jour.
 */

const fs = require("fs");
const path = require("path");

// Tous les liens fournis par l'utilisateur
const rawLinks = `
https://www.youtube.com/watch?v=8V_IO6CI-ZA&t=22s
https://www.youtube.com/watch?v=-KORQyPfhlU&t=32s
https://www.youtube.com/watch?v=RE4owf6pesw
https://www.youtube.com/watch?v=f7EaPg8STMs&t=116s
https://www.youtube.com/watch?v=eUUteiB9QCI
https://www.youtube.com/watch?v=SjNXku2_5vE&t=40s
https://www.youtube.com/watch?v=KTCkAMTM2uw
https://www.youtube.com/watch?v=EbTKg3unRPk
https://www.youtube.com/watch?v=GdTeCJddVjY&t=98s
https://www.youtube.com/watch?v=23Cf6IVwBus
https://www.youtube.com/watch?v=FLl3GWAPrFE
https://www.youtube.com/watch?v=6r0vZjoQAS8&t=33s
https://www.youtube.com/watch?v=8M0HMhslaps&t=26s
https://www.youtube.com/watch?v=TnzLCOcCd0U
https://www.youtube.com/watch?v=-36eAHYRBHg
https://www.youtube.com/watch?v=ojtkhoDh6rg
https://www.youtube.com/watch?v=5yIUsa2c184
https://www.youtube.com/watch?v=O9TsQbngibY
https://www.youtube.com/watch?v=X_kJguWOF8I
https://www.youtube.com/watch?v=o_-bSXmi14Q
https://www.youtube.com/watch?v=03M3sNYliEg
https://www.youtube.com/watch?v=5OHLp6xIL-U
https://www.youtube.com/watch?v=yGZaedONLeQ
https://www.youtube.com/watch?v=ZZkFPGxuc6k
https://www.youtube.com/watch?v=1GYUUiJuW3k
https://www.youtube.com/watch?v=gttvMzBMQjE
https://www.youtube.com/watch?v=oPBqXkKtVLU&t=51s
https://www.youtube.com/watch?v=-gnKDnPGZvc
https://www.youtube.com/watch?v=3xx1Lg0r_5Q
https://www.youtube.com/watch?v=XAYvZ1sq9xs
https://www.youtube.com/watch?v=fRVKqN0GU5I
https://www.youtube.com/watch?v=v7ePUuInbeY
https://www.youtube.com/watch?v=kyhKYNiR5Uc
https://www.youtube.com/watch?v=sjFQ62V9NiE
https://www.youtube.com/watch?v=hvrEo2gRU0k&t=900s
https://www.youtube.com/watch?v=FEViyzQMmyg
https://www.youtube.com/watch?v=lv0Y8bpk2p4
https://www.youtube.com/watch?v=UomZNPtJhqo
https://www.youtube.com/watch?v=1LUmM6K8nfs
https://www.youtube.com/watch?v=eQJEhTPxwEE
https://www.youtube.com/watch?v=J5CZcUEQKK8
https://www.youtube.com/watch?v=h8_JqK3MJDg
https://www.youtube.com/watch?v=_aToY8T4-a0
https://www.youtube.com/watch?v=YRWRlfk1Kf0
https://www.youtube.com/watch?v=CbIjzAtodeM
https://www.youtube.com/watch?v=KwL4A_kVhx0
https://www.youtube.com/watch?v=E4YrwXTQncE
https://www.youtube.com/watch?v=GrmXw9oaVug
https://www.youtube.com/watch?v=9y-np3FXu6g
https://www.youtube.com/watch?v=hmoJqaGLhkY
https://www.youtube.com/watch?v=ePtPkwH2n6s
https://www.youtube.com/watch?v=Fxf6RFCoqCI&t=23s
https://www.youtube.com/watch?v=Qtz-NaxbjdA
https://www.youtube.com/watch?v=kFg5xfjj4do
https://www.youtube.com/watch?v=T6zuPp0yz5Q
https://www.youtube.com/watch?v=v9P-_NmeHMY
https://www.youtube.com/watch?v=KUOMunaq9r0
https://www.youtube.com/watch?v=ZJfyFN9FBLU
https://www.youtube.com/watch?v=48s6cCi6TJY
https://www.youtube.com/watch?v=BXL80_IJgfg
https://www.youtube.com/watch?v=e0tDUbWjXv8
https://www.youtube.com/watch?v=gaLu1TJynao
https://www.youtube.com/watch?v=t_iQxTpNm8w
https://www.youtube.com/watch?v=eWWOAf39dq0
https://www.youtube.com/watch?v=Mmn0zrmzZFc
https://www.youtube.com/watch?v=IfDX6p_RLfU
https://www.youtube.com/watch?v=LEWeLitYVyM
https://www.youtube.com/watch?v=7mEA3I1Gy_w&t=1293s
https://www.youtube.com/watch?v=ystjM-SQp2U
https://www.youtube.com/watch?v=kpHYMbtDoHE
https://www.youtube.com/watch?v=OwVTZXVKTIk
https://www.youtube.com/watch?v=x44bKOaCn0M&t=786s
https://www.youtube.com/watch?v=fWcICC-l2eQ
https://www.youtube.com/watch?v=cIi4-IOfeSs&t=1s
https://www.youtube.com/watch?v=U221qSar-Bc
https://www.youtube.com/watch?v=TpYMYgbJIdk
https://www.youtube.com/watch?v=iyQ5dj9mnLI
https://www.youtube.com/watch?v=HJMaO1naAF0
https://www.youtube.com/watch?v=O417Xe63seo
https://www.youtube.com/watch?v=LOeaaOngZ4Q
https://www.youtube.com/watch?v=20aKFZd-7so
https://www.youtube.com/watch?v=fFaOnFNoIBs
https://www.youtube.com/watch?v=oghcBqhkf8o&t=10s
https://www.youtube.com/watch?v=IQkZ6GdaswA
https://www.youtube.com/watch?v=pF3g6YB0s5M
https://www.youtube.com/watch?v=5SmMptXzq6U
https://www.youtube.com/watch?v=N7_KTPMDwpo
https://www.youtube.com/watch?v=PKJi9nOGYVA
https://www.youtube.com/watch?v=bsCEYrCvMfo
https://www.youtube.com/watch?v=jVsi84UdSkI
https://www.youtube.com/watch?v=v33rU-fFnz8&t=680s
https://www.youtube.com/watch?v=ubcaZs1bsQA
https://www.youtube.com/watch?v=YrbXe2UsKfM
https://www.youtube.com/watch?v=FeJrnHADsvY
https://www.youtube.com/watch?v=sDkaYsrQvfg
https://www.youtube.com/watch?v=P54Yhyn991s
https://www.youtube.com/watch?v=zPICG85iIhM
https://www.youtube.com/watch?v=HWLZ3KqwXqI&t=17s
https://www.youtube.com/watch?v=K9bbTgIhJPk
https://www.youtube.com/watch?v=VeZk5pISHXk
https://www.youtube.com/watch?v=GcUf9OuVZ24
https://www.youtube.com/watch?v=TcpAJUZ5MNQ
https://www.youtube.com/watch?v=KdsWBtyx-ws
https://www.youtube.com/watch?v=a4kV8uViaT0
https://www.youtube.com/watch?v=pIsd3wOO6RM&t=348s
https://www.youtube.com/watch?v=X-jnaV48L5c&t=3s
https://www.youtube.com/watch?v=bDfeXctQWrE
https://www.youtube.com/watch?v=ZyQrsr7orBA&t=1033s
https://www.youtube.com/watch?v=SWAzsdxQpGk
https://www.youtube.com/watch?v=oZCZlzeIy-U
https://www.youtube.com/watch?v=2jbVWC_nPWY
https://www.youtube.com/watch?v=XgNCy9Ks0a4
https://www.youtube.com/watch?v=uYF_SdbXmz8
https://www.youtube.com/watch?v=SqNhIb0QTt0&t=1s
https://www.youtube.com/watch?v=N4hMQv69lIc
https://www.youtube.com/watch?v=lT0SXiu-7RU
https://www.youtube.com/watch?v=bAc9U0yfyYA
https://www.youtube.com/watch?v=Yn10RrxK3vE
https://www.youtube.com/watch?v=StkBLDdTdjU&t=178s
https://www.youtube.com/watch?v=xBylOg06JiE
https://www.youtube.com/watch?v=XpEgXonpz9U
https://www.youtube.com/watch?v=aPCiUS11s3E
https://www.youtube.com/watch?v=qJl1BIkFsy4
https://www.youtube.com/watch?v=DNNj3zBFuT4
https://www.youtube.com/watch?v=jMsrQqnyWsI
https://www.youtube.com/watch?v=rZ1hN5x3BKc
https://www.youtube.com/watch?v=Etcd0CogaUY&t=1156s
https://www.youtube.com/watch?v=A2uJ656OenU
https://www.youtube.com/watch?v=UeoGbMQKjY4&t=172s
https://www.youtube.com/watch?v=gDrmFuHHD4Y
https://www.youtube.com/watch?v=MFOrTnzWWS4
https://www.youtube.com/watch?v=6iXOwOQz_GY&t=6s
https://www.youtube.com/watch?v=-xMoX0mybeM&t=693s
https://www.youtube.com/watch?v=zFh82Nrnikw
https://www.youtube.com/watch?v=lKYGdr6bxeQ
https://www.youtube.com/watch?v=67aSKk_SoMY
https://www.youtube.com/watch?v=8O8CWr8hR8E
https://www.youtube.com/watch?v=nrGIAPNBWZs
https://www.youtube.com/watch?v=3P9dtZdques
https://www.youtube.com/watch?v=IVgNnsGQJw8
https://www.youtube.com/watch?v=4xaREEBCEe4
https://www.youtube.com/watch?v=m6xFed2vBRw
https://www.youtube.com/watch?v=JVQTHrfpcWw
https://www.youtube.com/watch?v=7xwXZUL1r5o
https://www.youtube.com/watch?v=0XaJpdZMGfY
https://www.youtube.com/watch?v=YUjuLP4hOyk
https://www.youtube.com/watch?v=psw_MDGytt4
https://www.youtube.com/watch?v=IFlhmkEW_Aw
https://www.youtube.com/watch?v=1WmG9T6lI_I
https://www.youtube.com/watch?v=uZYE_0XXsC8
https://www.youtube.com/watch?v=1yL9O-ORx_0
https://www.youtube.com/watch?v=DnX10XpeiQE
https://www.youtube.com/watch?v=ySFQecyXfWg
https://www.youtube.com/watch?v=08OnVEd6dKA
https://www.youtube.com/watch?v=3RSiurHF07w&t=415s
https://www.youtube.com/watch?v=wUmkONIdfqs
https://www.youtube.com/watch?v=Pr3ZJ9I8lQc
https://www.youtube.com/watch?v=RMaEashkVJ8
https://www.youtube.com/watch?v=Nu-go9gE5O8
https://www.youtube.com/watch?v=DWMYxMIp1XQ
https://www.youtube.com/watch?v=nVNHDTIHOh4
https://www.youtube.com/watch?v=_w9r3LB5xCQ&t=6s
https://www.youtube.com/watch?v=UWgM2ELFI3M
https://www.youtube.com/watch?v=V3OoQ1TcNNg
https://www.youtube.com/watch?v=vUK4Zh3EvmU
https://www.youtube.com/watch?v=6W8yjMoVvdk
https://www.youtube.com/watch?v=3wurfcYI7RE
https://www.youtube.com/watch?v=A8LUSKFn6Fc
https://www.youtube.com/watch?v=eq_I4GVBeyA
https://www.youtube.com/watch?v=_aTzTw0pEEs
https://www.youtube.com/watch?v=eS6-XOpx_cU
https://www.youtube.com/watch?v=96wtXtDmYMc&t=15s
https://www.youtube.com/watch?v=DlUgtljgoho
https://www.youtube.com/watch?v=c4S0IefgZ9s&t=532s
https://www.youtube.com/watch?v=097B-BPDJes
https://www.youtube.com/watch?v=04VPa_bU3pU
https://www.youtube.com/watch?v=P_Tedq8Ydes
https://www.youtube.com/watch?v=m0aUQ740Dzk
https://www.youtube.com/watch?v=T3W5Buog_cc
https://www.youtube.com/watch?v=_RK67xvIxkA
https://www.youtube.com/watch?v=q3sfQiygyDA
https://www.youtube.com/watch?v=kNkPllkMCKI
https://www.youtube.com/watch?v=XWLF7GC7F1g
https://www.youtube.com/watch?v=tojDCeg0ebU
https://www.youtube.com/watch?v=z6-BmISahJI
https://www.youtube.com/watch?v=YhCtj-360BY
https://www.youtube.com/watch?v=1NnRYFJ5qDw&t=7s
https://www.youtube.com/watch?v=Ln0IHknLXSE&t=8s
https://www.youtube.com/watch?v=K1J3ROrGf-A
https://www.youtube.com/watch?v=mY6sedXwRUU
https://www.youtube.com/watch?v=c3TTxB-ETqA
https://www.youtube.com/watch?v=EeBQSRB0D5Q
https://www.youtube.com/watch?v=N3b-2ijxaos
https://www.youtube.com/watch?v=9PBNafjpt4M
https://www.youtube.com/watch?v=nQD2TbpZQH0
https://www.youtube.com/watch?v=nDsk6sm5XMY
https://www.youtube.com/watch?v=EzvGVs1syo4
https://www.youtube.com/watch?v=Dy2hmR-h-yU
https://www.youtube.com/watch?v=eBIUvYP-_Zg&t=3604s
https://www.youtube.com/watch?v=g3FyRcAOtl8
https://www.youtube.com/watch?v=_w4Rz29atIU&t=758s
https://www.youtube.com/watch?v=mkyRqw1_nSw
https://www.youtube.com/watch?v=IluK6BYNzhM
https://www.youtube.com/watch?v=rgTze2f1y2I
https://www.youtube.com/watch?v=ZxWn-Oc_Jv4&t=1909s
https://www.youtube.com/watch?v=kTV7MEK2y_k&t=47s
https://www.youtube.com/watch?v=COvaMM5srac
https://www.youtube.com/watch?v=IihJXpGXzF0&t=27s
https://www.youtube.com/watch?v=yLxsTJdZZJo
https://www.youtube.com/watch?v=dfgVQzxvtuE
https://www.youtube.com/watch?v=a0GkzJcPL6k
https://www.youtube.com/watch?v=o4nFS32k-ZU
https://www.youtube.com/watch?v=FXD77U68mxI
https://www.youtube.com/watch?v=-hVRWOBxaoU
https://www.youtube.com/watch?v=mU2fWr0FKjg
https://www.youtube.com/watch?v=y1zs4SyO-CI
https://www.youtube.com/watch?v=G553MwtL8j8
https://www.youtube.com/watch?v=-d_evum25fw
https://www.youtube.com/watch?v=hIqQnEmXSFM
https://www.youtube.com/watch?v=wJkV69LWSQs
https://www.youtube.com/watch?v=slFs2Jy3HYA
https://www.youtube.com/watch?v=i3wNyzfGExk&t=21s
https://www.youtube.com/watch?v=kJqBGd-LoV0
https://www.youtube.com/watch?v=QWM7AO8Pae0
https://www.youtube.com/watch?v=YwXtsgRm6bc
https://www.youtube.com/watch?v=m0V9AJ8EYjI
https://www.youtube.com/watch?v=jWXc8-Thtf0
https://www.youtube.com/watch?v=Fkal0U4rFZw
https://www.youtube.com/watch?v=yLJ9fVS9GAs
https://www.youtube.com/watch?v=M2OuPOWoAZA
https://www.youtube.com/watch?v=r1k5VWHeZkI
https://www.youtube.com/watch?v=-71F_m4bVQo
https://www.youtube.com/watch?v=DYw19rNCY68
https://www.youtube.com/watch?v=sKGfv-tTxHA&t=50s
https://www.youtube.com/watch?v=0BXYJdrVQCI
https://www.youtube.com/watch?v=WAUD2Vg5_P8
https://www.youtube.com/watch?v=Lby3wgeXkpE&t=2167s
https://www.youtube.com/watch?v=x-Wgk14YmcU
https://www.youtube.com/watch?v=8imd90slqyk
https://www.youtube.com/watch?v=MZGbDSEaB9s
https://www.youtube.com/watch?v=IQXqIKXKeWk&t=804s
https://www.youtube.com/watch?v=H_aUOaLbgVg&t=1384s
https://www.youtube.com/watch?v=j6pOirIwuvo
https://www.youtube.com/watch?v=I-zxNZ_hHHo
https://www.youtube.com/watch?v=QhlJDUiTwv4
https://www.youtube.com/watch?v=6B4vT-iBllY
https://www.youtube.com/watch?v=SxgRSKtfQXo
https://www.youtube.com/watch?v=51VBX8wDWAA
https://www.youtube.com/watch?v=FRySZMtHkV4
https://www.youtube.com/watch?v=uXMIVoAFoSI
https://www.youtube.com/watch?v=QyCj0IvociY
https://www.youtube.com/watch?v=5lbr18rLwE0
https://www.youtube.com/watch?v=98Zm5Rs3UVM
https://www.youtube.com/watch?v=PwvCVHUBMHc
https://www.youtube.com/watch?v=MsoqH9WzUG0
https://www.youtube.com/watch?v=cu1eClEdRp0
https://www.youtube.com/watch?v=RKuzsCraR-Y
https://www.youtube.com/watch?v=kAfcm34JdS0
https://www.youtube.com/watch?v=ytacIRDo8TI
https://www.youtube.com/watch?v=tyfR1K8QNew
https://www.youtube.com/watch?v=oOVxGrEa1C4
https://www.youtube.com/watch?v=T4uFNWZ5A_U
https://www.youtube.com/watch?v=kyg2cR6EuDU
https://www.youtube.com/watch?v=7fvOFZ7hpLM
https://www.youtube.com/watch?v=3zrwH2tiwHs
https://www.youtube.com/watch?v=vkcoy7vzAts
https://www.youtube.com/watch?v=Yqi93E5EJa8
https://www.youtube.com/watch?v=RRf6mawCsN0
https://www.youtube.com/watch?v=QuJwf2lPZzI
https://www.youtube.com/watch?v=HXmuOVMKYKM
https://www.youtube.com/watch?v=JzWTFc-xqCs
https://www.youtube.com/watch?v=goMMUF0cZt4
https://www.youtube.com/watch?v=WefSUYmESH0
https://www.youtube.com/watch?v=XvgoK9Vil-w
https://www.youtube.com/watch?v=4LP470mfCW0
https://www.youtube.com/watch?v=Z60jF-qITwY
https://www.youtube.com/watch?v=qGqVHdw8LtI
https://www.youtube.com/watch?v=gfCVhlX_cU0
https://www.youtube.com/watch?v=bYkvBhhph0s
https://www.youtube.com/watch?v=avMkDSLXkug
https://www.youtube.com/watch?v=gcIsjJa4g7E
https://www.youtube.com/watch?v=oyUKIECRpS0
https://www.youtube.com/watch?v=GwJIq6wiUHk
https://www.youtube.com/watch?v=RKNksJLA6aQ
https://www.youtube.com/watch?v=K2GOHy9vHQk
https://www.youtube.com/watch?v=G3qis8W3DPo
https://www.youtube.com/watch?v=jCCwsGWh0zk
https://www.youtube.com/watch?v=HUbTg9imxnc
https://www.youtube.com/watch?v=kSMRWcp3Pyo
https://www.youtube.com/watch?v=xztP7rGD-6E
https://www.youtube.com/watch?v=bfpEJd0KC3A
https://www.youtube.com/watch?v=E-GJUDH0qF0
https://www.youtube.com/watch?v=bCwg74bNkY0
https://www.youtube.com/watch?v=Gn4xXeHrWqo
https://www.youtube.com/watch?v=QQeqDgvATs4
`;

// Extraire les IDs YouTube
const lines = rawLinks.trim().split("\n").filter(l => l.trim());
const ids = lines.map(link => {
  const match = link.match(/v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}).filter(Boolean);

console.log(`Total IDs extraits: ${ids.length}`);

// Sauvegarder les IDs pour usage ultérieur
fs.writeFileSync(
  path.join(__dirname, "pam-youtube-ids.json"),
  JSON.stringify(ids, null, 2)
);
console.log("IDs sauvegardés dans pam-youtube-ids.json");

// Récupérer les titres via oEmbed (par batches de 10)
async function fetchTitle(id) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return { id, title: data.title, author: data.author_name };
    }
  } catch (e) {
    // ignore
  }
  return { id, title: `Vidéo Pam`, author: "Pam" };
}

async function main() {
  console.log("Récupération des titres via YouTube oEmbed...");
  const results = [];
  
  // Traiter par batches de 10 pour éviter le rate limiting
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const titles = await Promise.all(batch.map(fetchTitle));
    results.push(...titles);
    console.log(`  ${Math.min(i + 10, ids.length)}/${ids.length} traités`);
    if (i + 10 < ids.length) await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(
    path.join(__dirname, "pam-youtube-titles.json"),
    JSON.stringify(results, null, 2)
  );
  console.log(`Titres sauvegardés dans pam-youtube-titles.json`);
  console.log("Terminé !");
}

main().catch(console.error);
