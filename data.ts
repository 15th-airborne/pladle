#!/usr/bin/env -S deno run -A

import pinyin from "https://esm.sh/pinyin"

const high_pop_list =
    Deno.readTextFileSync("ChinaCityStat/citystatInfo.txt")
        .split('\n')
        .slice(0, -1)
        .map(line => line.split('\t'))
        .filter(([_name, population]) => parseFloat(population) > 100)
        .map(x => x[0])

high_pop_list.push(
    "北京市", "天津市", "上海市", "重庆市", "香港特别行政区", "澳门特别行政区",
    "新北市", "台中市", "高雄市", "台北市", "桃园市", "台南市", "彰化县",
    "三亚市", "防城港市", "西双版纳傣族自治州", "大理白族自治州", "伊犁哈萨克自治州",
    "延边朝鲜族自治州", "锡林郭勒盟", "兴安盟"
)

const places: any[] = []
const places_full_name_index: Record<string, number> = {}
for (const file of [
        ...Deno.readDirSync("china-geojson/geometryProvince"),
        ...Deno.readDirSync("china-geojson/geometryCouties"),
        { name: "china.json" }
    ]) {
    const text = file.name == "china.json"
        ? Deno.readTextFileSync("china-geojson/"+file.name)
        : file.name.length <= 7
        ? Deno.readTextFileSync("china-geojson/geometryProvince/"+file.name)
        : Deno.readTextFileSync("china-geojson/geometryCouties/"+file.name)
    const content = JSON.parse(text)
    for (const place of content.features) {
        const name = place.properties.name
        if (high_pop_list.includes(name) && places_full_name_index[name] == null) {
            places.push({ full_name: name, geometry: place.geometry })
            places_full_name_index[name] = places.length - 1
        }
    }
}

const places_short_name_index: Record<string, number> = {}
for (const place of places) {
    const suffixes = ["市", "县", "盟", "特别行政区", "傣族自治州", "白族自治州", "哈萨克自治州", "朝鲜族自治州"]
    for (const suffix of suffixes) if (place.full_name.endsWith(suffix)) {
        place.short_name = place.full_name.slice(0, -suffix.length)
        break
    }

    if (!place.short_name)
        throw "TODO: no suffix found for " + place.full_name

    if (places_short_name_index[place.short_name] != null)
        throw "TODO: duplicated short name"

    places_short_name_index[place.short_name] = places_full_name_index[place.full_name]
}

for (const place of places)
    place.pinyin = pinyin(place.short_name, { heteronym: false, segment: true, style: pinyin.STYLE_TONE2 }).map(x => x[0])

// Sort to ensure a consistent ordering. The indexes are invalided after sorting!
places.sort((x, y) => x.short_name < y.short_name ? -1 : x.short_name == y.short_name ? 0 : 1)

Deno.writeTextFileSync("places.json", JSON.stringify(places))
