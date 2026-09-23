import { GSI_MUNI_CODES } from "./japan-muni-data.js";

/**
 * 47 Japanese Prefectures mapping (JIS code / Kanji / English)
 */
export const JAPAN_PREFECTURES = {
  "01": { kanji: "北海道", en: "Hokkaido" },
  "02": { kanji: "青森県", en: "Aomori" },
  "03": { kanji: "岩手県", en: "Iwate" },
  "04": { kanji: "宮城県", en: "Miyagi" },
  "05": { kanji: "秋田県", en: "Akita" },
  "06": { kanji: "山形県", en: "Yamagata" },
  "07": { kanji: "福島県", en: "Fukushima" },
  "08": { kanji: "茨城県", en: "Ibaraki" },
  "09": { kanji: "栃木県", en: "Tochigi" },
  "10": { kanji: "群馬県", en: "Gunma" },
  "11": { kanji: "埼玉県", en: "Saitama" },
  "12": { kanji: "千葉県", en: "Chiba" },
  "13": { kanji: "東京都", en: "Tokyo" },
  "14": { kanji: "神奈川県", en: "Kanagawa" },
  "15": { kanji: "新潟県", en: "Niigata" },
  "16": { kanji: "富山県", en: "Toyama" },
  "17": { kanji: "石川県", en: "Ishikawa" },
  "18": { kanji: "福井県", en: "Fukui" },
  "19": { kanji: "山梨県", en: "Yamanashi" },
  "20": { kanji: "長野県", en: "Nagano" },
  "21": { kanji: "岐阜県", en: "Gifu" },
  "22": { kanji: "静岡県", en: "Shizuoka" },
  "23": { kanji: "愛知県", en: "Aichi" },
  "24": { kanji: "三重県", en: "Mie" },
  "25": { kanji: "滋賀県", en: "Shiga" },
  "26": { kanji: "京都府", en: "Kyoto" },
  "27": { kanji: "大阪府", en: "Osaka" },
  "28": { kanji: "兵庫県", en: "Hyogo" },
  "29": { kanji: "奈良県", en: "Nara" },
  "30": { kanji: "和歌山県", en: "Wakayama" },
  "31": { kanji: "鳥取県", en: "Tottori" },
  "32": { kanji: "島根県", en: "Shimane" },
  "33": { kanji: "岡山県", en: "Okayama" },
  "34": { kanji: "広島県", en: "Hiroshima" },
  "35": { kanji: "山口県", en: "Yamaguchi" },
  "36": { kanji: "徳島県", en: "Tokushima" },
  "37": { kanji: "香川県", en: "Kagawa" },
  "38": { kanji: "愛媛県", en: "Ehime" },
  "39": { kanji: "高知県", en: "Kochi" },
  "40": { kanji: "福岡県", en: "Fukuoka" },
  "41": { kanji: "佐賀県", en: "Saga" },
  "42": { kanji: "長崎県", en: "Nagasaki" },
  "43": { kanji: "熊本県", en: "Kumamoto" },
  "44": { kanji: "大分県", en: "Oita" },
  "45": { kanji: "宮崎県", en: "Miyazaki" },
  "46": { kanji: "鹿児島県", en: "Kagoshima" },
  "47": { kanji: "沖縄県", en: "Okinawa" },
};

/**
 * Mapping from JIS municipality codes to English ward & city names
 */
export const MUNI_CD_TO_EN = {
  // Tokyo 23 Special Wards
  "13101": { ward: "Chiyoda Ward", city: "Tokyo" },
  "13102": { ward: "Chuo Ward", city: "Tokyo" },
  "13103": { ward: "Minato Ward", city: "Tokyo" },
  "13104": { ward: "Shinjuku Ward", city: "Tokyo" },
  "13105": { ward: "Bunkyo Ward", city: "Tokyo" },
  "13106": { ward: "Taito Ward", city: "Tokyo" },
  "13107": { ward: "Sumida Ward", city: "Tokyo" },
  "13108": { ward: "Koto Ward", city: "Tokyo" },
  "13109": { ward: "Shinagawa Ward", city: "Tokyo" },
  "13110": { ward: "Meguro Ward", city: "Tokyo" },
  "13111": { ward: "Ota Ward", city: "Tokyo" },
  "13112": { ward: "Setagaya Ward", city: "Tokyo" },
  "13113": { ward: "Shibuya Ward", city: "Tokyo" },
  "13114": { ward: "Nakano Ward", city: "Tokyo" },
  "13115": { ward: "Suginami Ward", city: "Tokyo" },
  "13116": { ward: "Toshima Ward", city: "Tokyo" },
  "13117": { ward: "Kita Ward", city: "Tokyo" },
  "13118": { ward: "Arakawa Ward", city: "Tokyo" },
  "13119": { ward: "Itabashi Ward", city: "Tokyo" },
  "13120": { ward: "Nerima Ward", city: "Tokyo" },
  "13121": { ward: "Adachi Ward", city: "Tokyo" },
  "13122": { ward: "Katsushika Ward", city: "Tokyo" },
  "13123": { ward: "Edogawa Ward", city: "Tokyo" },

  // Tokyo Major Cities
  "13201": { ward: "Hachioji City", city: "Tokyo" },
  "13202": { ward: "Tachikawa City", city: "Tokyo" },
  "13203": { ward: "Musashino City", city: "Tokyo" },
  "13204": { ward: "Mitaka City", city: "Tokyo" },
  "13206": { ward: "Fuchu City", city: "Tokyo" },
  "13208": { ward: "Chofu City", city: "Tokyo" },
  "13209": { ward: "Machida City", city: "Tokyo" },
  "13214": { ward: "Kokubunji City", city: "Tokyo" },

  // Yokohama
  "14101": { ward: "Tsurumi Ward", city: "Yokohama" },
  "14102": { ward: "Kanagawa Ward", city: "Yokohama" },
  "14103": { ward: "Nishi Ward", city: "Yokohama" },
  "14104": { ward: "Naka Ward", city: "Yokohama" },
  "14105": { ward: "Minami Ward", city: "Yokohama" },
  "14109": { ward: "Kohoku Ward", city: "Yokohama" },
  "14117": { ward: "Aoba Ward", city: "Yokohama" },

  // Kawasaki
  "14131": { ward: "Kawasaki Ward", city: "Kawasaki" },
  "14132": { ward: "Saiwai Ward", city: "Kawasaki" },
  "14133": { ward: "Nakahara Ward", city: "Kawasaki" },
  "14134": { ward: "Takatsu Ward", city: "Kawasaki" },

  // Osaka
  "27102": { ward: "Miyakojima Ward", city: "Osaka" },
  "27104": { ward: "Fukushima Ward", city: "Osaka" },
  "27106": { ward: "Nishi Ward", city: "Osaka" },
  "27107": { ward: "Minato Ward", city: "Osaka" },
  "27109": { ward: "Tennoji Ward", city: "Osaka" },
  "27111": { ward: "Naniwa Ward", city: "Osaka" },
  "27123": { ward: "Yodogawa Ward", city: "Osaka" },
  "27127": { ward: "Kita Ward", city: "Osaka" },
  "27128": { ward: "Chuo Ward", city: "Osaka" },

  // Kyoto
  "26101": { ward: "Kamigyo Ward", city: "Kyoto" },
  "26102": { ward: "Shimogyo Ward", city: "Kyoto" },
  "26103": { ward: "Sakyo Ward", city: "Kyoto" },
  "26104": { ward: "Nakagyo Ward", city: "Kyoto" },
  "26105": { ward: "Higashiyama Ward", city: "Kyoto" },
  "26106": { ward: "Minami Ward", city: "Kyoto" },
  "26107": { ward: "Ukyo Ward", city: "Kyoto" },
  "26108": { ward: "Fushimi Ward", city: "Kyoto" },

  // Nagoya
  "23101": { ward: "Chikusa Ward", city: "Nagoya" },
  "23102": { ward: "Higashi Ward", city: "Nagoya" },
  "23105": { ward: "Nakamura Ward", city: "Nagoya" },
  "23106": { ward: "Naka Ward", city: "Nagoya" },

  // Fukuoka
  "40131": { ward: "Higashi Ward", city: "Fukuoka" },
  "40132": { ward: "Hakata Ward", city: "Fukuoka" },
  "40133": { ward: "Chuo Ward", city: "Fukuoka" },
  "40134": { ward: "Minami Ward", city: "Fukuoka" },
  "40135": { ward: "Nishi Ward", city: "Fukuoka" },
  "40136": { ward: "Jonan Ward", city: "Fukuoka" },
  "40137": { ward: "Sawara Ward", city: "Fukuoka" },

  // Sapporo
  "01101": { ward: "Chuo Ward", city: "Sapporo" },
  "01102": { ward: "Kita Ward", city: "Sapporo" },
  "1101": { ward: "Chuo Ward", city: "Sapporo" },
  "1102": { ward: "Kita Ward", city: "Sapporo" },

  // Kobe
  "28110": { ward: "Chuo Ward", city: "Kobe" },
  "28101": { ward: "Higashinada Ward", city: "Kobe" },
  "28102": { ward: "Nada Ward", city: "Kobe" },

  // Sendai
  "04101": { ward: "Aoba Ward", city: "Sendai" },
  "04102": { ward: "Miyagino Ward", city: "Sendai" },
  "4101": { ward: "Aoba Ward", city: "Sendai" },
  "4102": { ward: "Miyagino Ward", city: "Sendai" },
};

/**
 * Kanji ward/city string to English mapping
 */
export const WARD_KANJI_TO_EN = {
  千代田区: "Chiyoda Ward",
  中央区: "Chuo Ward",
  港区: "Minato Ward",
  新宿区: "Shinjuku Ward",
  文京区: "Bunkyo Ward",
  台東区: "Taito Ward",
  墨田区: "Sumida Ward",
  江東区: "Koto Ward",
  品川区: "Shinagawa Ward",
  目黒区: "Meguro Ward",
  大田区: "Ota Ward",
  世田谷区: "Setagaya Ward",
  渋谷区: "Shibuya Ward",
  中野区: "Nakano Ward",
  杉並区: "Suginami Ward",
  豊島区: "Toshima Ward",
  北区: "Kita Ward",
  荒川区: "Arakawa Ward",
  板橋区: "Itabashi Ward",
  練馬区: "Nerima Ward",
  足立区: "Adachi Ward",
  葛飾区: "Katsushika Ward",
  江戸川区: "Edogawa Ward",
  八王子市: "Hachioji City",
  立川市: "Tachikawa City",
  武蔵野市: "Musashino City",
  三鷹市: "Mitaka City",
  調布市: "Chofu City",
  町田市: "Machida City",
  府中市: "Fuchu City",
};

/**
 * Common ward and municipality names in Kanji mapped to Romaji
 */
export const COMMON_WARD_NAMES = {
  千代田: "Chiyoda", 中央: "Chuo", 港: "Minato", 新宿: "Shinjuku", 文京: "Bunkyo", 台東: "Taito",
  墨田: "Sumida", 江東: "Koto", 品川: "Shinagawa", 目黒: "Meguro", 大田: "Ota", 世田谷: "Setagaya",
  渋谷: "Shibuya", 中野: "Nakano", 杉並: "Suginami", 豊島: "Toshima", 北: "Kita", 荒川: "Arakawa",
  板橋: "Itabashi", 練馬: "Nerima", 足立: "Adachi", 葛飾: "Katsushika", 江戸川: "Edogawa",
  八王子: "Hachioji", 立川: "Tachikawa", 武蔵野: "Musashino", 三鷹: "Mitaka", 調布: "Chofu",
  町田: "Machida", 府中: "Fuchu",
  南: "Minami", 東: "Higashi", 西: "Nishi", 中: "Naka", 緑: "Midori", 青葉: "Aoba", 旭: "Asahi",
  泉: "Izumi", 城東: "Joto", 阿倍野: "Abeno", 天王寺: "Tennoji", 浪速: "Naniwa", 淀川: "Yodogawa",
  西淀川: "Nishiyodogawa", 東淀川: "Higashiyodogawa", 東成: "Higashinari", 生野: "Ikuno",
  住吉: "Sumiyoshi", 東住吉: "Higashisumiyoshi", 西成: "Nishinari", 此花: "Konohana", 大正: "Taisho",
  住之江: "Suminoe", 平野: "Hirano", 福島: "Fukushima", 都島: "Miyakojima",
  鶴見: "Tsurumi", 神奈川: "Kanagawa", 磯子: "Isogo", 金沢: "Kanazawa", 港北: "Kohoku",
  戸塚: "Totsuka", 港南: "Konan", 保土ケ谷: "Hodogaya", 栄: "Sakae", 瀬谷: "Seya",
  都筑: "Tsuzuki", 博多: "Hakata", 早良: "Sawara", 城南: "Jonan",
};

/**
 * Normalization dictionary for common city, ward, or neighborhood strings
 * (often returned by Cloudflare Edge IP geolocation).
 */
export const JAPAN_CITY_WARD_MAP = {
  // Tokyo 23 Special Wards & Neighborhoods
  chiyoda: { ward: "Chiyoda Ward", pref: "Tokyo", kanji: "東京都千代田区" },
  marunouchi: { ward: "Chiyoda Ward", town: "Marunouchi", pref: "Tokyo", kanji: "東京都千代田区丸の内" },
  otemachi: { ward: "Chiyoda Ward", town: "Otemachi", pref: "Tokyo", kanji: "東京都千代田区大手町" },
  akihabara: { ward: "Chiyoda Ward", town: "Akihabara", pref: "Tokyo", kanji: "東京都千代田区秋葉原" },
  kanda: { ward: "Chiyoda Ward", town: "Kanda", pref: "Tokyo", kanji: "東京都千代田区神田" },

  chuo: { ward: "Chuo Ward", pref: "Tokyo", kanji: "東京都中央区" },
  ginza: { ward: "Chuo Ward", town: "Ginza", pref: "Tokyo", kanji: "東京都中央区銀座" },
  nihonbashi: { ward: "Chuo Ward", town: "Nihonbashi", pref: "Tokyo", kanji: "東京都中央区日本橋" },
  tsukiji: { ward: "Chuo Ward", town: "Tsukiji", pref: "Tokyo", kanji: "東京都中央区築地" },

  minato: { ward: "Minato Ward", pref: "Tokyo", kanji: "東京都港区" },
  roppongi: { ward: "Minato Ward", town: "Roppongi", pref: "Tokyo", kanji: "東京都港区六本木" },
  akasaka: { ward: "Minato Ward", town: "Akasaka", pref: "Tokyo", kanji: "東京都港区赤坂" },
  azabu: { ward: "Minato Ward", town: "Azabu", pref: "Tokyo", kanji: "東京都港区麻布" },
  aoyama: { ward: "Minato Ward", town: "Aoyama", pref: "Tokyo", kanji: "東京都港区青山" },
  toranomon: { ward: "Minato Ward", town: "Toranomon", pref: "Tokyo", kanji: "東京都港区虎ノ門" },
  shimbashi: { ward: "Minato Ward", town: "Shimbashi", pref: "Tokyo", kanji: "東京都港区新橋" },
  shinbashi: { ward: "Minato Ward", town: "Shimbashi", pref: "Tokyo", kanji: "東京都港区新橋" },
  shiba: { ward: "Minato Ward", town: "Shiba", pref: "Tokyo", kanji: "東京都港区芝" },
  shibakoen: { ward: "Minato Ward", town: "Shibakoen", pref: "Tokyo", kanji: "東京都港区芝公園" },
  odaiba: { ward: "Minato Ward", town: "Odaiba", pref: "Tokyo", kanji: "東京都港区お台場" },

  shinjuku: { ward: "Shinjuku Ward", pref: "Tokyo", kanji: "東京都新宿区" },
  kabukicho: { ward: "Shinjuku Ward", town: "Kabukicho", pref: "Tokyo", kanji: "東京都新宿区歌舞伎町" },
  takadanobaba: { ward: "Shinjuku Ward", town: "Takadanobaba", pref: "Tokyo", kanji: "東京都新宿区高田馬場" },
  yotsuya: { ward: "Shinjuku Ward", town: "Yotsuya", pref: "Tokyo", kanji: "東京都新宿区四谷" },

  bunkyo: { ward: "Bunkyo Ward", pref: "Tokyo", kanji: "東京都文京区" },
  hongo: { ward: "Bunkyo Ward", town: "Hongo", pref: "Tokyo", kanji: "東京都文京区本郷" },

  taito: { ward: "Taito Ward", pref: "Tokyo", kanji: "東京都台東区" },
  ueno: { ward: "Taito Ward", town: "Ueno", pref: "Tokyo", kanji: "東京都台東区上野" },
  asakusa: { ward: "Taito Ward", town: "Asakusa", pref: "Tokyo", kanji: "東京都台東区浅草" },

  sumida: { ward: "Sumida Ward", pref: "Tokyo", kanji: "東京都墨田区" },
  kinshicho: { ward: "Sumida Ward", town: "Kinshicho", pref: "Tokyo", kanji: "東京都墨田区錦糸町" },
  oshiage: { ward: "Sumida Ward", town: "Oshiage", pref: "Tokyo", kanji: "東京都墨田区押上" },

  koto: { ward: "Koto Ward", pref: "Tokyo", kanji: "東京都江東区" },
  toyosu: { ward: "Koto Ward", town: "Toyosu", pref: "Tokyo", kanji: "東京都江東区豊洲" },
  ariake: { ward: "Koto Ward", town: "Ariake", pref: "Tokyo", kanji: "東京都江東区有明" },

  shinagawa: { ward: "Shinagawa Ward", pref: "Tokyo", kanji: "東京都品川区" },
  gotanda: { ward: "Shinagawa Ward", town: "Gotanda", pref: "Tokyo", kanji: "東京都品川区五反田" },
  osaki: { ward: "Shinagawa Ward", town: "Osaki", pref: "Tokyo", kanji: "東京都品川区大崎" },

  meguro: { ward: "Meguro Ward", pref: "Tokyo", kanji: "東京都目黒区" },
  nakameguro: { ward: "Meguro Ward", town: "Nakameguro", pref: "Tokyo", kanji: "東京都目黒区中目黒" },
  jiyugaoka: { ward: "Meguro Ward", town: "Jiyugaoka", pref: "Tokyo", kanji: "東京都目黒区自由が丘" },

  ota: { ward: "Ota Ward", pref: "Tokyo", kanji: "東京都大田区" },
  kamata: { ward: "Ota Ward", town: "Kamata", pref: "Tokyo", kanji: "東京都大田区蒲田" },
  haneda: { ward: "Ota Ward", town: "Haneda", pref: "Tokyo", kanji: "東京都大田区羽田" },

  setagaya: { ward: "Setagaya Ward", pref: "Tokyo", kanji: "東京都世田谷区" },
  shimokitazawa: { ward: "Setagaya Ward", town: "Shimokitazawa", pref: "Tokyo", kanji: "東京都世田谷区下北沢" },
  sangenjaya: { ward: "Setagaya Ward", town: "Sangenjaya", pref: "Tokyo", kanji: "東京都世田谷区三軒茶屋" },

  shibuya: { ward: "Shibuya Ward", pref: "Tokyo", kanji: "東京都渋谷区" },
  harajuku: { ward: "Shibuya Ward", town: "Harajuku", pref: "Tokyo", kanji: "東京都渋谷区原宿" },
  ebisu: { ward: "Shibuya Ward", town: "Ebisu", pref: "Tokyo", kanji: "東京都渋谷区恵比寿" },
  daikanyama: { ward: "Shibuya Ward", town: "Daikanyama", pref: "Tokyo", kanji: "東京都渋谷区代官山" },
  yoyogi: { ward: "Shibuya Ward", town: "Yoyogi", pref: "Tokyo", kanji: "東京都渋谷区代々木" },
  hiroo: { ward: "Shibuya Ward", town: "Hiroo", pref: "Tokyo", kanji: "東京都渋谷区広尾" },

  nakano: { ward: "Nakano Ward", pref: "Tokyo", kanji: "東京都中野区" },
  suginami: { ward: "Suginami Ward", pref: "Tokyo", kanji: "東京都杉並区" },
  koenji: { ward: "Suginami Ward", town: "Koenji", pref: "Tokyo", kanji: "東京都杉並区高円寺" },
  ogikubo: { ward: "Suginami Ward", town: "Ogikubo", pref: "Tokyo", kanji: "東京都杉並区荻窪" },

  toshima: { ward: "Toshima Ward", pref: "Tokyo", kanji: "東京都豊島区" },
  ikebukuro: { ward: "Toshima Ward", town: "Ikebukuro", pref: "Tokyo", kanji: "東京都豊島区池袋" },

  kita: { ward: "Kita Ward", pref: "Tokyo", kanji: "東京都北区" },
  akabane: { ward: "Kita Ward", town: "Akabane", pref: "Tokyo", kanji: "東京都北区赤羽" },

  arakawa: { ward: "Arakawa Ward", pref: "Tokyo", kanji: "東京都荒川区" },
  nippori: { ward: "Arakawa Ward", town: "Nippori", pref: "Tokyo", kanji: "東京都荒川区日暮里" },

  itabashi: { ward: "Itabashi Ward", pref: "Tokyo", kanji: "東京都板橋区" },
  nerima: { ward: "Nerima Ward", pref: "Tokyo", kanji: "東京都練馬区" },
  adachi: { ward: "Adachi Ward", pref: "Tokyo", kanji: "東京都足立区" },
  kitasenju: { ward: "Adachi Ward", town: "Kitasenju", pref: "Tokyo", kanji: "東京都足立区北千住" },

  katsushika: { ward: "Katsushika Ward", pref: "Tokyo", kanji: "東京都葛飾区" },
  edogawa: { ward: "Edogawa Ward", pref: "Tokyo", kanji: "東京都江戸川区" },

  // Major Metros & Cities
  yokohama: { city: "Yokohama", pref: "Kanagawa", kanji: "神奈川県横浜市" },
  kawasaki: { city: "Kawasaki", pref: "Kanagawa", kanji: "神奈川県川崎市" },
  osaka: { city: "Osaka", pref: "Osaka", kanji: "大阪府大阪市" },
  kyoto: { city: "Kyoto", pref: "Kyoto", kanji: "京都府京都市" },
  nagoya: { city: "Nagoya", pref: "Aichi", kanji: "愛知県名古屋市" },
  sapporo: { city: "Sapporo", pref: "Hokkaido", kanji: "北海道札幌市" },
  fukuoka: { city: "Fukuoka", pref: "Fukuoka", kanji: "福岡県福岡市" },
  kobe: { city: "Kobe", pref: "Hyogo", kanji: "兵庫県神戸市" },
  sendai: { city: "Sendai", pref: "Miyagi", kanji: "宮城県仙台市" },
  hiroshima: { city: "Hiroshima", pref: "Hiroshima", kanji: "広島県広島市" },
  saitama: { city: "Saitama", pref: "Saitama", kanji: "埼玉県さいたま市" },
  chiba: { city: "Chiba", pref: "Chiba", kanji: "千葉県千葉市" },
};

/**
 * Resolves postal code (7-digit Japanese zip code) using Zipcloud API.
 */
export async function lookupJapanPostalCode(postalCode, fetchFn = fetch) {
  if (!postalCode) return null;
  const cleanZip = String(postalCode).replace(/[^\d]/g, "");
  if (cleanZip.length !== 7) return null;

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;

    const res = await fetchFn(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`, {
      method: "GET",
      signal: controller ? controller.signal : undefined,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.results) || data.results.length === 0) return null;

    const result = data.results[0];
    const pref = result.address1 || "";
    const cityWard = result.address2 || "";
    const town = result.address3 && result.address3 !== "以下に掲載がない場合" ? result.address3 : "";
    const prefCode = String(result.prefcode || "").padStart(2, "0");
    const prefEn = JAPAN_PREFECTURES[prefCode]?.en || "";

    const jpAddress = `${pref}${cityWard}${town ? town : ""}`;

    // Determine English name for Ward or City
    let enWard = WARD_KANJI_TO_EN[cityWard];
    if (!enWard && cityWard.endsWith("区")) {
      const pureWard = cityWard.replace(/.*市/, "").replace(/区$/, "");
      const romaji = COMMON_WARD_NAMES[pureWard] || pureWard;
      enWard = `${romaji} Ward`;
    } else if (!enWard && cityWard.endsWith("市")) {
      const pureCity = cityWard.replace(/市$/, "");
      const romaji = COMMON_WARD_NAMES[pureCity] || pureCity;
      enWard = `${romaji} City`;
    }

    const displayEn = enWard && prefEn ? `${enWard}, ${prefEn}` : enWard || prefEn || "Japan";

    return {
      source: "postal_code",
      postalCode: cleanZip,
      prefecture: pref,
      cityWard,
      town,
      jpAddress,
      display: `${displayEn} (${jpAddress})`,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves coordinates (lat, lon) using GSI (国土地理院) Reverse Geocoder API.
 */
export async function lookupJapanCoordinates(lat, lon, fetchFn = fetch, options = {}) {
  const { includeMicroStreet = false } = options;
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (isNaN(numLat) || isNaN(numLon)) return null;

  // Basic bounding box for Japan (approx 20°N to 46°N, 122°E to 154°E)
  if (numLat < 20 || numLat > 46 || numLon < 122 || numLon > 154) return null;

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;

    const res = await fetchFn(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${numLat}&lon=${numLon}`,
      {
        method: "GET",
        signal: controller ? controller.signal : undefined,
      }
    );

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.results || !data.results.muniCd) return null;

    const muniCd = String(data.results.muniCd);
    const lv01Nm = data.results.lv01Nm || "";
    const paddedCd = muniCd.padStart(5, "0");
    const prefCode = paddedCd.slice(0, 2);
    const prefInfo = JAPAN_PREFECTURES[prefCode];

    const baseAddress = GSI_MUNI_CODES[muniCd] || GSI_MUNI_CODES[paddedCd];
    let jpAddress = "";
    let muniName = "";

    if (baseAddress) {
      const parts = baseAddress.split(" ");
      const pref = parts[0] || "";
      muniName = parts.slice(1).join(" ");
      // Only append micro-street (lv01Nm) if explicitly requested (e.g. from GPS)
      // IP coordinates should NEVER include micro-streets due to wide error margins
      jpAddress = includeMicroStreet && lv01Nm ? `${pref}${muniName} ${lv01Nm}` : `${pref}${muniName}`;
    } else if (prefInfo) {
      jpAddress = includeMicroStreet && lv01Nm ? `${prefInfo.kanji} ${lv01Nm}` : prefInfo.kanji;
      muniName = lv01Nm;
    } else {
      jpAddress = lv01Nm;
    }

    const enMapping = MUNI_CD_TO_EN[muniCd] || MUNI_CD_TO_EN[paddedCd];
    let displayEn = "";

    if (enMapping) {
      displayEn = `${enMapping.ward}, ${enMapping.city}`;
    } else {
      const enPref = prefInfo ? prefInfo.en : "";
      let enWardOrCity = WARD_KANJI_TO_EN[muniName];
      if (!enWardOrCity) {
        if (muniName.endsWith("区")) {
          enWardOrCity = `${muniName.replace(/.*市\s*/, "").replace(/区$/, "")} Ward`;
        } else if (muniName.endsWith("市")) {
          enWardOrCity = `${muniName.replace(/市$/, "")} City`;
        } else {
          enWardOrCity = muniName;
        }
      }
      displayEn = enPref && enWardOrCity && enWardOrCity !== enPref
        ? `${enWardOrCity}, ${enPref}`
        : enWardOrCity || enPref;
    }

    return {
      source: "coordinates",
      muniCd,
      prefCode,
      town: includeMicroStreet ? lv01Nm : "",
      jpAddress,
      display: `${displayEn} (${jpAddress})`,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves location for Japanese visitors extracting fine-grained ward, city, and town.
 * Falls back safely to standard city/country formatting for non-Japan or unresolved requests.
 *
 * @param {Object} options
 * @param {string} [options.city]
 * @param {string} [options.country]
 * @param {string} [options.region]
 * @param {string} [options.regionCode]
 * @param {string} [options.postalCode]
 * @param {number|string} [options.latitude]
 * @param {number|string} [options.longitude]
 * @param {boolean} [options.isGps]
 * @param {Function} [fetchFn=fetch]
 * @returns {Promise<{ resolvedCity: string, country: string, isJapan: boolean, details: any }>}
 */
export async function resolveDetailedLocation({
  city,
  country,
  region,
  regionCode,
  postalCode,
  latitude,
  longitude,
  isGps = false,
  fetchFn = fetch,
}) {
  const cleanCountry = String(country || "").trim().toUpperCase();
  const cleanCity = String(city || "").trim();
  const cleanRegion = String(region || "").trim();
  const cleanRegionCode = String(regionCode || "").trim();

  const isJapan =
    cleanCountry === "JP" ||
    cleanCountry === "JAPAN" ||
    cleanRegion.toLowerCase() === "tokyo" ||
    cleanRegionCode === "13" ||
    (postalCode && String(postalCode).replace(/[^\d]/g, "").length === 7 && !cleanCountry);

  if (!isJapan) {
    // Non-Japan requests retain clean City
    return {
      resolvedCity: cleanCity || "Unknown",
      country: cleanCountry || null,
      isJapan: false,
      details: null,
    };
  }

  // 1. Path 1: Postal Code lookup (7-digit Japanese zip)
  if (postalCode) {
    const postalResult = await lookupJapanPostalCode(postalCode, fetchFn);
    if (postalResult && postalResult.display) {
      return {
        resolvedCity: postalResult.display,
        country: "JP",
        isJapan: true,
        details: postalResult,
      };
    }
  }

  // 2. Path 2: Direct Ward / Neighborhood matching from City header
  // e.g. "Shibuya", "Minato", "Roppongi", "Ginza" detected by Cloudflare Edge IP Geo
  const normalizedCityKey = cleanCity.toLowerCase().replace(/[^a-z]/g, "");
  if (normalizedCityKey && JAPAN_CITY_WARD_MAP[normalizedCityKey]) {
    const info = JAPAN_CITY_WARD_MAP[normalizedCityKey];
    const enLabel = info.ward ? `${info.ward}, ${info.pref}` : `${info.city}, ${info.pref}`;
    const display = `${enLabel} (${info.kanji})`;
    return {
      resolvedCity: display,
      country: "JP",
      isJapan: true,
      details: { source: "city_mapping", ...info },
    };
  }

  // 3. Path 3: Explicit City / Prefecture from Cloudflare (Tokyo, Osaka, etc.)
  // When Cloudflare says region or city is "Tokyo", do NOT let coarse IP coordinates override it with another prefecture!
  if (cleanCity) {
    const prefMatch = Object.values(JAPAN_PREFECTURES).find(
      (p) => p.en.toLowerCase() === cleanCity.toLowerCase() || p.kanji === cleanCity
    );
    if (prefMatch) {
      return {
        resolvedCity: `${prefMatch.en}, Japan (${prefMatch.kanji})`,
        country: "JP",
        isJapan: true,
        details: { source: "prefecture_fallback", ...prefMatch },
      };
    }
  }

  if (cleanRegion) {
    const regMatch = Object.values(JAPAN_PREFECTURES).find(
      (p) => p.en.toLowerCase() === cleanRegion.toLowerCase() || p.kanji === cleanRegion
    );
    if (regMatch) {
      return {
        resolvedCity: `${regMatch.en}, Japan (${regMatch.kanji})`,
        country: "JP",
        isJapan: true,
        details: { source: "region_fallback", ...regMatch },
      };
    }
  }

  // 4. Path 4: Coordinates lookup (only if city/region is unknown or coordinates are verified GPS)
  if (latitude && longitude) {
    const coordResult = await lookupJapanCoordinates(latitude, longitude, fetchFn, {
      includeMicroStreet: isGps,
    });
    if (coordResult && coordResult.display) {
      return {
        resolvedCity: coordResult.display,
        country: "JP",
        isJapan: true,
        details: coordResult,
      };
    }
  }

  // 5. Fallback
  if (cleanCity && cleanCity !== "Unknown") {
    return {
      resolvedCity: `${cleanCity}`,
      country: "JP",
      isJapan: true,
      details: { source: "raw_city" },
    };
  }

  return {
    resolvedCity: "Tokyo, Japan (東京都)",
    country: "JP",
    isJapan: true,
    details: { source: "default_jp" },
  };
}
