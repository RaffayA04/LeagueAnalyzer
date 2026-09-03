/**
 * A real sample: LittleChaddha#NA1's last twenty Ranked Solo games.
 *
 * The landing page has to show the product before anyone has searched, and a
 * heatmap of invented coordinates would be a lie about what the tool produces.
 * These are the actual death positions the analyzer returned, frozen so the
 * page renders with no request and no backend.
 *
 * Attributed on screen as a sample account — never presented as the visitor's
 * own data. Regenerate by re-running the overview endpoint for that account.
 *
 * Shape is [worldX, worldY, objectiveWasLive] to keep the bundle small; it is
 * expanded to the Minimap's shape below.
 */
const RAW = [[11767,1049,0],[5851,8110,0],[10088,7164,0],[11298,1816,1],[3082,5351,1],[12980,12158,1],[4454,12290,1],[13659,12828,1],[6040,6412,0],[11664,2891,1],[9652,3344,0],[2396,9248,0],[7703,1613,1],[6755,7468,0],[6468,8554,0],[8992,9170,0],[6598,7729,0],[8206,8406,0],[11808,2036,0],[13386,10214,0],[5956,6690,0],[7921,7892,0],[12820,1754,0],[7024,7148,0],[6442,7428,0],[6053,6670,0],[7062,3124,0],[6432,6719,0],[3629,5151,0],[3417,13503,0],[1980,12693,1],[3589,13171,0],[1475,11888,0],[7389,13532,0],[983,7633,0],[1121,8118,0],[1845,3957,0],[6267,7642,0],[8252,8302,0],[9500,5522,0],[10736,5045,0],[13903,8364,0],[10952,8627,0],[9922,10206,1],[6492,9855,0],[12087,12722,1],[7234,6834,0],[5902,5486,0],[8983,5924,1],[13283,6607,0],[7578,7947,0],[6495,7666,0],[7719,5241,1],[6969,8016,0],[6057,5897,1],[5882,5522,0],[3965,3994,0],[5997,5664,0],[6585,6543,0],[13269,5529,0],[13653,4836,0],[11679,7130,1],[3392,4180,0],[4525,10463,0],[12146,12776,0],[7845,6484,0],[11752,4346,1],[7839,7911,0],[10016,13383,1],[13590,6312,1],[8819,7906,0],[6722,7070,1],[8640,8068,0],[13418,5620,0],[13848,10574,0],[8639,5783,1],[6309,5968,0],[8219,5124,1],[6094,6470,0],[6956,7146,0],[9956,4708,1],[2739,3705,0],[1252,5431,0],[13657,5872,0],[13116,4455,0],[8646,6916,0],[5133,12999,0],[10166,9909,0],[8637,11250,0],[8127,7414,1],[9676,1495,0],[6394,6866,0],[9824,6335,1],[7638,6980,1],[11257,4054,0],[9182,11365,0],[4594,7870,0],[8430,12005,1],[10349,5452,1],[5159,8523,0],[12863,4111,0],[9956,2545,0]]

const SAMPLE_GAMES = [["Katarina",0,6,8,4],["Katarina",1,7,0,4],["Katarina",1,7,5,5],["Katarina",1,17,0,6],["Katarina",0,5,7,4],["Katarina",0,7,9,2],["Kayle",1,5,8,5],["Katarina",0,2,9,3],["Katarina",1,7,0,2],["Katarina",1,8,5,5],["Katarina",1,11,4,4],["Katarina",1,16,1,2],["Katarina",0,8,2,10],["Katarina",0,7,7,8],["Katarina",1,14,5,14],["Katarina",1,11,6,3],["Katarina",0,2,7,2],["Katarina",1,13,6,3],["Katarina",1,14,4,9],["Katarina",0,6,9,7]]

/** The sample's headline figures, precomputed so the page does no work. */
export const DEMO_STATS = {
  "total": 102,
  "games": 20,
  "topZone": "Mid Lane",
  "topZoneCount": 30,
  "objective": 26,
  "loPct": 90,
  "loN": 10,
  "hiPct": 30,
  "hiN": 10
}

export const DEMO_ACCOUNT = { gameName: 'LittleChaddha', tagLine: 'NA1' }

/** Minimap plots from wx/wy, so the packed pairs are expanded to that shape. */
export const DEMO_DEATHS = RAW.map(([wx, wy, obj], i) => ({
  wx, wy,
  obj: obj ? 'drake' : null,
  t: '', zone: '', killer: '',
  i,
}))

export const DEMO_GAMES = SAMPLE_GAMES.map(([champion, win, kills, deaths, assists], i) => ({
  i, champion, win: !!win, kills, deaths, assists,
}))
