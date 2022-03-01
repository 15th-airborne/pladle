#!/usr/bin/env -S deno run -A

import pinyin from "https://esm.sh/pinyin"

const high_pop_list =
    Deno.readTextFileSync("ChinaCityStat/citystatInfo.txt")
        .split('\n')
        .slice(0, -1)
        .map(line => line.split('\t'))
        .filter(([_name, population]) => parseFloat(population) > 100)
        .map(x => x[0])

const places: any[] = []
const places_full_name_index: Record<string, number> = {}
for (const file of [
        ...Deno.readDirSync("china-geojson/geometryProvince"),
        ...Deno.readDirSync("china-geojson/geometryCouties"),
    ]) {
    const text = file.name.length <= 7
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
    if (place.full_name.endsWith("市"))
        place.short_name = place.full_name.slice(0, -1)
    else
        throw "TODO"

    if (places_short_name_index[place.short_name] != null)
        throw "TODO"

    places_short_name_index[place.short_name] = places_full_name_index[place.full_name]
}

for (const place of places)
    place.pinyin = pinyin(place.short_name, { heteronym: false, segment: true, style: pinyin.STYLE_TONE2 }).map(x => x[0])

Deno.writeTextFileSync("places.json", JSON.stringify(places))

// https://www.movable-type.co.uk/scripts/latlong.html
function p2p_distance([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
    const R = 6371
    const φ1 = lat1 * Math.PI/180
    const φ2 = lat2 * Math.PI/180
    const Δφ = (lat2-lat1) * Math.PI/180
    const Δλ = (lon2-lon1) * Math.PI/180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
}

function distance(a: any, b: any) {
    let shortest = Infinity
    for (const coordinate_a of a.geometry.coordinates) for (const point_a of coordinate_a) {
        for (const coordinate_b of b.geometry.coordinates) for (const point_b of coordinate_b) {
            const dist = p2p_distance(point_a, point_b)
            if (dist < 1)
                return 0
            if (dist < shortest)
                shortest = dist
        }
    }
    return shortest
}
