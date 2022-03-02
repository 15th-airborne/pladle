const $ = document.querySelector.bind(document)

const answer = places[(date => {
    const x = date.getFullYear() * 7
            + date.getMonth() * 14207929
            + date.getDay() * 36189529
    return (x * x) % 236573 * 287281 + x * 457979
})(new Date) % places.length]

const place_index = {}
for (place of places)
    place_index[place.short_name] = place

$("#submit").addEventListener("click", () => {
    const p = place_index[$("#input").value]
    if (!p) {
        $("#status").innerHTML = `查无此地。（提示：注意规则前两条）`
        return
    }

    const tags = get_tags(p)

    if (p.short_name == answer.short_name) {
        const result_element = document.createElement("div")
        result_element.innerHTML = `
            <span class="guess">${p.short_name}</span> <span class="tag-4">猜对了！</span>
        `.trim()
        $("#history").append(result_element)
    } else {
        let html = `<span class="guess">${p.short_name}</span>`
        for (const tag of tags)
            html += ` <span class="tag-${tag.rarity}" title="${tag.explaination}">${tag.name}</span>`
        const result_element = document.createElement("div")
        result_element.innerHTML = html.trim()
        $("#history").append(result_element)
    }
})

function get_tags(p) {
    let tags = []

    // 1. distance
    const dist = distance(p, answer)
    console.log(dist)
    switch (false) {
        case !(dist < 1):
            tags.push({name: "相邻", rarity: 4, explaination: "该地与答案有共同边界"})
            break
        case !(dist < 100):
            tags.push({name: "很近", rarity: 3, explaination: "该地与答案直线距离小于 100 千米"})
            break
        case !(dist < 500):
            tags.push({name: "较近", rarity: 2, explaination: "该地与答案直线距离小于 500 千米"})
            break
        default:
            tags.push({name: "较远", rarity: 1, explaination: "该地与答案直线距离大于 500 千米"})
    }

    // 2. name
    ;(() => {
        for (const char of p.short_name) if (answer.short_name.includes(char)) {
            return tags.push({name: "同字", rarity: 4, explaination: "该地名称中有至少一字出现在答案中"})
        }

        for (const pinyin of p.pinyin) if (answer.pinyin.includes(pinyin)) {
            return tags.push({name: "同音", rarity: 3, explaination: "该地名称中有至少一字读音与答案中某字读音完全相同"})
        }

        let same_consonant = false, same_vowel = false, same_tone = false
        for (const pinyin of p.pinyin) for (const answer_pinyin of answer.pinyin) {
            const { consonant: p_consonant, vowel: p_vowel, tone: p_tone } = split_pinyin(pinyin)
            const { consonant: a_consonant, vowel: a_vowel, tone: a_tone } = split_pinyin(answer_pinyin)
            if (!same_consonant && p_consonant == a_consonant)
                same_consonant = true
            if (!same_vowel && p_vowel == a_vowel)
                same_vowel = true
            if (!same_tone && p_tone == a_tone)
                same_tone = true
        }
        if (same_consonant)
            return tags.push({name: "同声", rarity: 2, explaination: "该地名称中有至少一字拼音声母与答案中某字声母相同"})
        if (same_vowel)
            return tags.push({name: "同韵", rarity: 2, explaination: "该地名称中有至少一字拼音韵母与答案中某字韵母相同"})
        if (same_tone)
            return tags.push({name: "同调", rarity: 2, explaination: "该地名称中有至少一字拼音声调与答案中某字声调相同"})
    })()

    return tags
}


// https://www.movable-type.co.uk/scripts/latlong.html
function p2p_distance([lon1, lat1], [lon2, lat2]) {
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

function distance(a, b) {
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

function split_pinyin(pinyin) {
    const consonants = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "r", "x", "w", "y", "zh", "ch", "sh", "z", "c", "s"]
    const consonant = consonants.find(x => pinyin.startsWith(x)) ?? ""
    const vowel = pinyin.slice(consonant.length, -1)
    const tone = pinyin[pinyin.length - 1]
    return { consonant, vowel, tone }
}