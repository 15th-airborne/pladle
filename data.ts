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
    "北京市", "天津市", "上海市", "重庆市", "香港特别行政区",
    "新北市", "台中市", "高雄市", "台北市", "桃园市", "台南市", "彰化县"
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
    if (place.full_name.endsWith("市") || place.full_name.endsWith("县"))
        place.short_name = place.full_name.slice(0, -1)
    else if (place.full_name.endsWith("特别行政区"))
        place.short_name = place.full_name.slice(0, -5)
    else
        throw "TODO"

    if (places_short_name_index[place.short_name] != null)
        throw "TODO"

    places_short_name_index[place.short_name] = places_full_name_index[place.full_name]
}

for (const place of places)
    place.pinyin = pinyin(place.short_name, { heteronym: false, segment: true, style: pinyin.STYLE_TONE2 }).map(x => x[0])

Deno.writeTextFileSync("places.json", JSON.stringify(places))
