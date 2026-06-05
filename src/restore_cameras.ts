import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import Papa from 'papaparse';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const csvData = `ID,Type,Name,Address,Police Reference,Latitude,Longitude,Direction,Field of View,View Distance,Added By,Creator Email,Created At,Last Verified At
05UMlJQJj20Qv5HlHX1L,cctv,"All-in-Onez","","",50.81766956690503,-0.37862598896026617,32,90,19,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:38:04.249Z,
1LxChGOx3gDQHfh6hVTE,police_council,"RedVu, Montague Place","","",50.81033478987629,-0.3720438480377198,122,258,35,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:33:57.710Z,
2yenLpe76TuZhePHOrqa,police_council,"RedVu Railway 2","","",50.81828300901591,-0.375342964333012,0,263,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:26:48.918Z,
3iqPaDD5CUfRQWmu0nP1,cctv,"Toni & Guy","","",50.81145677355105,-0.3697317838668824,291,60,19,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:49:53.828Z,
3tlkKZvJ6BQ7IdvADq85,cctv,"RedVu, Splashpoint","","",50.810534786154975,-0.36398112694592705,264,54,36,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:30:55.837Z,
6KKmK08Cj8OnnuYrROPg,cctv,"Sion School","","",50.81298208577585,-0.37686109542846685,160,37,43,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T20:25:40.414Z,
6c2e37ATuYxXuEI9lufD,cctv,"Guildbourne Centre","","",50.81197199569562,-0.36991953849792486,2,25,72,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:46:07.754Z,
76pp3rLFht3RJK4sdFxd,cctv,"Prime Angling","","",50.80999920644183,-0.36870718002319336,127,56,42,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T08:59:42.034Z,
7GYyHfw4UEuxr1etfk3y,cctv,"Sion School","","",50.81297530672061,-0.3774672746658326,358,360,46,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T20:26:09.407Z,
8KasMBNS6Pr2Z0b5bqfs,cctv,"Carters Electrical","","",50.817659399342304,-0.37693619728088384,207,208,26,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:14:31.932Z,
8S61n2Tbn4SImjykWnDA,cctv,"Guildbourne Centre","","",50.812009281288205,-0.3696459531784058,78,10,109,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:45:34.476Z,
AZ6UHfR3ZGu0fYfUmKlQ,cctv,"Silverthornes","","",50.81121610862835,-0.3697639703750611,274,178,19,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:50:32.424Z,
D41628EszN40ML4hz283,cctv,"Boots, Montague St","","",50.81022970845406,-0.37273585796356207,251,29,27,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:36:28.607Z,
F6yl4LBLYs37yrtMPUAK,police_council,"RedVu High Street","","",50.81307360292539,-0.3679990768432618,130,358,40,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:28:39.091Z,
F9DTebONRoYVRz0KHFVJ,cctv,"Tribes","","",50.81528690752345,-0.36536514759063726,123,57,36,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:26:49.106Z,
FObyFtRlTJPWDLGT8Vti,cctv,"Cow Shed, South St","","",50.80994497050896,-0.36972105503082275,189,51,38,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:53:43.637Z,
GMF9D2FRxxk316ZzxEcR,other,"BnB External","","",50.81715101838444,-0.3762710094451905,96,122,21,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T08:58:33.335Z,
GambdTxokZnp9K14hf69,cctv,"Best Tan","","",50.81841518213674,-0.3885984420776367,179,193,41,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:29:57.430Z,
H7FyDsERoJIr7wjsuA3e,cctv,"Best One","","",50.81610712546904,-0.3724032640457154,131,42,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:19:18.628Z,
IWcL87mI1D0Axxl2rGRr,police_council,"RedVu Railway 1","","",50.81825250672183,-0.3764373056110882,359,269,26,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:26:21.269Z,
JQ1bxniwlP154ERnl5sj,cctv,"Thieves Kitchen","","",50.811653372145194,-0.36927044391632086,71,90,21,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:53:14.692Z,
KaDK3Lzi0HxOInA2HNLP,cctv,"Palm Court ","","",50.81437177132647,-0.3635895252227783,0,359,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:27:45.960Z,
MCYMtbbG7yxWA55LslVl,police_council,"RedVu Steyne Gdns","","",50.811907599752544,-0.36740898927391413,208,359,41,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:29:27.344Z,
Oo25CXLTZgmtYZGap2DA,cctv,"Retro by Ronnie","","",50.81342950124673,-0.40356516838073736,252,90,28,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T15:48:57.115Z,
PEAF4cSmk84igVf64DW8,cctv,"Guildbourne Centre","","",50.81274142871207,-0.3692811727523804,348,176,44,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:44:58.511Z,
UMcjxu5sOXPgUKSClkP5,police_council,"RedVu, Richmond Rd","","123",50.81400910127987,-0.37095487117767334,257,182,51,VAIg2FPdFOUquDQyjvnZ7X1xk8J3,nathan.tracey@sussex.police.uk,2026-04-13T10:42:13.930Z,
Uoe5YFFwMDBz3M6H4bxY,police_council,"RedVu, Clock Tower","","",50.811609307015,-0.37007510662078863,269,360,42,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:32:25.378Z,2026-04-14T11:26:57.139Z
UvvBef48hXkmSgo1OIUh,cctv,"Worthing Implant Centre","","",50.81546315391693,-0.370665192604065,195,90,25,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:18:29.316Z,
V3Y2nNlHCIWuLWJvVwOx,cctv,"Express Supermarket","","",50.81801865188193,-0.3688788414001465,39,251,14,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:01:59.892Z,
VLmISZM3hxh63SzF7VMu,police_council,"RedVu, Teville Gate","","",50.81718152139799,-0.3729772567749024,1,360,52,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:30:10.603Z,
W5AEjcvifEhyvmWBlSYG,cctv,"Sion School","","",50.813524407007755,-0.37556290626525884,55,37,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T20:26:42.486Z,
WvVUNRNDvq82FhvZW0Sw,cctv,"","","",50.80989751727327,-0.369501113098576,148,146,24,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:31:45.653Z,
ab70bbeNytB3QB0ZcTuI,cctv,"Co-op, Goring Rd","","",50.813368490298515,-0.4021114110946655,24,108,29,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T15:48:11.675Z,
adD3TkDN8MeefwpnhkcG,police_council,"RedVu, Pier","","",50.809422949692404,-0.37041306416363945,39,65,45,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:30:14.050Z,
aqU3CdbMzF0772aaLxDM,police_council,"RedVu, Montague St","","",50.81013140626442,-0.37427008152008057,175,168,18,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:38:39.588Z,
bh5T8zCrLFbIfyoU9QFW,cctv,"Strand Pet Shop","","",50.82022155513483,-0.4108017683029175,84,176,25,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T15:12:50.028Z,
cxzj8r2lA11TW5ez2fbr,cctv,"Co-op Tarring Rd","","",50.81846940823465,-0.3878554701805115,242,33,26,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:39:36.939Z,
fQoD16G5EEASJScGkKNz,cctv,"SJM Electrical","","",50.812866841702835,-0.37011802196502686,209,279,17,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:55:43.898Z,
fSJ6U35ndbx0j00WnQNm,cctv,"Chapel News ","","",50.811846580302166,-0.37037014961242676,137,48,28,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:48:08.396Z,
fUX4mmqj0xKr6hQ5ZlsB,police_council,"RedVu, Chatsworth Rd","","",50.812697364608354,-0.370514988899231,304,264,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:31:21.395Z,
fqe7psus0N1mFRkY9Yde,cctv,"Nandos, Montague Quarter","","",50.81071104722379,-0.37127673625946045,226,33,28,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:34:32.229Z,
gUIiGHUGfR0JInfWvINn,cctv,"Crab Shack","","",50.810616135746294,-0.36443710327148443,169,145,19,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:00:29.149Z,
h7Txyc26U5LJvfkCrkuP,police_council,"RedVu, North St","","",50.81560211695053,-0.37186145782470703,64,358,35,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:29:28.548Z,
i24W0AZcTwUx73bWiqjk,police_council,"","","",50.81207029401186,-0.37198483943939215,339,24,55,VAIg2FPdFOUquDQyjvnZ7X1xk8J3,nathan.tracey@sussex.police.uk,2026-04-14T14:07:27.344Z,
jvA6l4X1dmfAr73IP9aC,cctv,"Railway Pub/Hotel","","",50.818198277115364,-0.37575602531433105,305,251,28,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:15:34.720Z,
k4WVkOxscCdOAgAjzWeI,cctv,"A Plan Insurance","","",50.811344915360934,-0.3693348169326783,0,18,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:51:30.814Z,
kkUVxAFDQgcuRdX1PDA6,police_council,"RedVu, Ivyarch","","",50.81942852193531,-0.37133038043975836,176,181,80,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:37:09.101Z,
nP9MHx8FWG7MNXSgmuF4,cctv,"Worthing Town Hall","","",50.81469715513974,-0.37209749221801763,5,360,50,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:07:19.384Z,
o5P3YduqnUNW3BH3M8oJ,cctv,"Worthing Implant Centre","","",50.81552416212896,-0.3708100318908692,282,45,73,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:18:08.302Z,
oHKfSZxGsQpkCR0nMtuD,police_council,"RedVu, South St","","",50.81037546649239,-0.36992490291595465,265,207,27,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:33:17.458Z,
oq01wrrkmWHoeAijHT3V,cctv,"Slicks","","",50.81070087814615,-0.37102997303009033,297,111,11,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:04:58.972Z,
qFElsnRIsXzm1xMoRk0l,cctv,"West Worthing Social Club","","",50.81752722082567,-0.4018485546112061,69,90,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T15:02:05.466Z,
rgGqwG7L6tZw9bbEl1dL,cctv,"Boots, Portland Rd","","",50.810239877634295,-0.3727573156356812,5,25,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T09:35:38.495Z,
s6YnQwmIVTWhB4C3yNtr,cctv,"Worthing Library","","",50.81404977469633,-0.3724434971809387,146,90,18,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:06:23.810Z,
tbbj8BF1zrvvN09rA5pc,cctv,"Clifton Food & Wine","","",50.81731709010597,-0.3785884380340577,88,188,23,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:38:57.522Z,
th0sqCFA5xiYXTCt0rAr,cctv,"Greens","","",50.81790003106597,-0.3770971298217774,109,186,9,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:03:28.589Z,
tnAsD58tZdrJVbuoJJyw,cctv,"Sports Centre","","",50.816784980667954,-0.40916562080383306,222,90,36,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T15:46:48.339Z,
uOtbe2SQzB9wZXWJB6N9,cctv,"Tesco South Farm Rd","","",50.81814405070261,-0.37856161594390875,151,38,20,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:16:18.463Z,
v4y4nfODpoS5rlcpfj4S,cctv,"Karma Lounge","","",50.818198277115364,-0.3877240419387818,292,90,24,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T08:57:37.647Z,
wq6mVikNYw8qq4xwxfTS,cctv,"Chatsworth Rd Record Store","","",50.81316850940957,-0.3682458400726319,122,244,12,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:41:45.253Z,
xQZpXbrIva4pfByrm7kN,cctv,"Childrens Home","","",50.81683581941126,-0.37889957427978516,178,171,32,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:41:25.933Z,
xl926hKYTWXvqfEwOURd,cctv,"Guildbourne Internal","","",50.81248382259374,-0.3692007064819336,0,360,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:46:48.402Z,
zDnZJS4v8E1ERXY8beFc,other,"Phoenix House External","","",50.81686971187605,-0.3727841377258301,0,90,23,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T08:56:16.830Z,
zRe38WxVtzlRXWZdI0WL,cctv,"Guildcare","","",50.81181268419208,-0.3687930107116699,119,51,17,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-25T15:52:27.083Z,
zRl9io5usq1nQQSLET3x,cctv,"Asda Garage","","",50.820648567433075,-0.4109680652618408,150,114,31,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-05-03T09:09:11.149Z,
zgQ9GExGsgmTmllPr8uN,cctv,"RedVu Railway Approach","","",50.81840501799301,-0.3740018598255657,0,360,30,0Ddx0BYyOBdUb4xSgi37BZE68Sd2,stephen.white1@sussex.police.uk,2026-04-14T13:27:33.702Z,`;

async function main() {
  try {
    console.log('Parsing CSV data...');
    const result = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = result.data as any[];
    console.log(`Successfully parsed ${rows.length} rows.`);

    // Deduplicate by ID
    const uniqueRecords: { [id: string]: any } = {};
    for (const row of rows) {
      if (!row.ID) continue;
      uniqueRecords[row.ID] = row;
    }

    const uniqueCamerasList = Object.values(uniqueRecords);
    console.log(`Deduplicated to ${uniqueCamerasList.length} unique cameras.`);

    // Fetch existing cameras from Firestore so we can delete them
    const camerasSnapshot = await getDocs(collection(db, 'cameras'));
    console.log(`Found ${camerasSnapshot.size} existing cameras in Firestore.`);

    console.log('Deleting all existing cameras from Firestore...');
    for (const d of camerasSnapshot.docs) {
      await deleteDoc(doc(db, 'cameras', d.id));
    }
    console.log('Complete cleanup done.');

    console.log('Writing restored cameras to Firestore...');
    let successCount = 0;
    for (const r of uniqueCamerasList) {
      const docId = r.ID;
      const parsedData = {
        type: r.Type || 'other',
        name: r.Name || '',
        address: r.Address || '',
        policeReferenceNumber: r['Police Reference'] || '',
        latitude: parseFloat(r.Latitude),
        longitude: parseFloat(r.Longitude),
        direction: r.Direction !== undefined && r.Direction !== null && r.Direction !== '' ? parseInt(r.Direction, 10) : undefined,
        fieldOfView: r['Field of View'] !== undefined && r['Field of View'] !== null && r['Field of View'] !== '' ? parseInt(r['Field of View'], 10) : undefined,
        viewDistance: r['View Distance'] !== undefined && r['View Distance'] !== null && r['View Distance'] !== '' ? parseInt(r['View Distance'], 10) : undefined,
        addedBy: r['Added By'] || 'stephen_backup',
        creatorEmail: r['Creator Email'] || 'seeder@sussex.police.uk',
        createdAt: r['Created At'] ? new Date(r['Created At']) : new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'cameras', docId), parsedData);
      successCount++;
    }

    console.log(`Successfully restored ${successCount} cameras to Firestore with high-fidelity coordinate, fov, and angle parameters!`);
  } catch (error) {
    console.error('Critical error during restoration:', error);
  }
}

main();
