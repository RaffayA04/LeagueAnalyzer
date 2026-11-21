/**
 * A real sample: LittleChaddha#NA1's last twenty Ranked Solo games.
 *
 * The landing page has to show the product before anyone has searched, and a
 * heatmap of invented coordinates would be a lie about what the tool produces.
 * These are the actual death positions the analyzer returned, frozen so the
 * page renders with no request and no backend.
 *
 * Attributed on screen as a sample account — never presented as the visitor's
 * own data. Regenerate when it drifts from what the demo button now returns:
 * a visitor who reads one set of numbers and then clicks through to another
 * has caught the page lying.
 *
 * Shape is [worldX, worldY, wasCritical] to keep the bundle small; it is
 * expanded to the Minimap's shape below.
 */
const RAW = [[11181,1257,0],[13994,4649,1],[11726,1862,1],[9598,6276,0],[13668,1480,0],[4752,5159,0],[7838,1168,0],[3362,8569,0],[7990,5310,0],[10160,4792,0],[10458,2243,0],[10679,7371,1],[4481,9175,1],[8222,13361,0],[12398,6508,0],[13873,13872,1],[3650,11927,1],[10358,6560,1],[5295,9091,0],[6229,6198,0],[9574,1758,1],[8659,7050,1],[7538,9929,1],[1684,7915,0],[7050,6764,0],[8508,5621,0],[8428,6722,0],[13731,7282,0],[10101,4042,1],[12730,2871,0],[10384,1347,0],[11385,4044,0],[7543,8063,0],[8288,8298,0],[7406,7916,0],[8571,5993,0],[14011,4042,0],[13890,5191,0],[13757,3853,0],[11222,11563,0],[12064,6886,1],[11745,4277,1],[9284,8041,0],[5431,9018,1],[13965,13043,0],[7476,7792,1],[11249,4548,1],[11323,4332,1],[10646,10446,0],[10864,11034,0],[8006,7699,0],[8013,8373,0],[7426,7801,1],[8843,8660,0],[13420,2624,0],[9618,1370,0],[13870,6634,0],[3937,10455,0],[4621,9556,0],[9202,9053,0],[13932,6645,0],[12960,12077,0],[7164,6453,1],[7428,7053,0],[6443,4769,1],[13220,3588,0],[10945,6297,0],[12753,13396,1],[8467,8682,0],[9718,6021,1],[3286,12585,0],[5296,9234,0],[13743,9497,1],[4836,5012,0],[10863,12992,0],[6574,6953,0],[9122,5903,0],[5978,8727,0],[8139,4936,0],[12676,2706,0],[9168,6419,0],[13493,6804,0],[13774,10386,1],[10656,6452,0],[13473,12660,0],[7764,6946,0],[4516,6299,0],[9060,2181,0],[1068,6327,0],[7135,6783,0],[7774,7472,0],[7628,7712,1],[6251,6699,0],[6634,6438,0],[11257,4880,1],[6838,7174,0],[8652,1267,0],[11889,10797,0],[13708,8607,1],[3723,11802,1],[12066,13279,1],[8852,6692,1],[3019,11718,1],[3178,3736,1],[10743,2223,0],[7004,6796,0],[10078,10523,0],[12872,2954,0],[13297,9639,0],[8612,6749,0],[11568,8338,1],[6953,7170,0],[6607,7065,0],[12184,1954,1],[13381,8713,0],[9976,5410,1],[7597,5063,0],[4307,5051,1],[13806,10420,1],[4187,2051,1],[5539,6203,1],[12602,3068,0],[8589,7932,0],[2750,7657,0],[1034,900,0],[7442,7280,1],[10192,895,1],[12593,2665,0],[3058,2496,0],[1598,3086,0],[7125,7544,0],[9778,7685,0],[11773,4546,0],[13031,1424,0],[7422,7762,0],[11997,2357,0],[7419,3341,1],[10799,7766,0],[2720,8114,0]]

const SAMPLE_GAMES = [["Jinx",1,13,7,12,"32:11",2],["Graves",0,8,9,10,"33:34",3],["Graves",1,8,9,15,"34:16",5],["Katarina",1,0,0,0,"1:07",0],["Vladimir",1,3,8,9,"38:26",1],["Katarina",0,7,12,5,"39:26",3],["Katarina",0,8,5,3,"29:41",3],["Katarina",1,19,8,12,"41:15",1],["Ahri",0,0,0,0,"1:47",0],["Katarina",1,20,4,4,"25:07",0],["Katarina",1,18,6,9,"37:16",3],["Katarina",0,8,7,3,"35:00",2],["Katarina",0,9,10,5,"34:38",1],["Katarina",1,5,4,3,"30:18",0],["Katarina",0,15,15,15,"35:47",8],["Katarina",0,7,7,3,"30:23",1],["Katarina",1,14,9,5,"36:50",5],["Katarina",1,7,5,4,"26:50",1],["Katarina",1,9,5,10,"28:15",2],["Katarina",0,11,9,8,"34:33",1]]

/** The sample's headline figures, precomputed so the page does no work. */
export const DEMO_STATS = {
  "total": 139,
  "games": 20,
  "topZone": "Mid Lane",
  "topZoneCount": 38,
  "critical": 42,
  "loPct": 71,
  "loN": 7,
  "hiPct": 46,
  "hiN": 13
}

export const DEMO_ACCOUNT = { gameName: 'LittleChaddha', tagLine: 'NA1' }

/** Minimap plots from wx/wy, so the packed pairs are expanded to that shape. */
export const DEMO_DEATHS = RAW.map(([wx, wy, obj], i) => ({
  wx, wy,
  obj: obj ? 'drake' : null,
  t: '', zone: '', killer: '',
  i,
}))

export const DEMO_GAMES = SAMPLE_GAMES.map(
  ([champion, win, kills, deaths, assists, duration, critical], i) => ({
    i, champion, win: !!win, kills, deaths, assists, duration, critical,
    kda: `${kills}/${deaths}/${assists}`,
  }),
)
