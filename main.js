const $ = document.querySelector.bind(document)

const load_time = new Date

const answer = places[(date => {
    const x = date.getFullYear() * 2
            + date.getMonth() * 14207929
            + date.getDay() * 36189529
    return (x * x) % 236573 * 287281 + x * 457979
})(load_time) % places.length]

const guesses = JSON.parse(window.localStorage?.getItem(load_time.toLocaleDateString()) ?? "[]")

const place_index = {}
for (place of places)
    place_index[place.short_name] = place

$("#submit").addEventListener("click", () => {
    const p = place_index[$("#input").value]
    if (!p) {
        $("#status").innerHTML = `查无此地。（提示：注意规则前两条）`
        return
    }

    if (guesses.includes(p.short_name)) {
        $("#status").innerHTML = `猜过了`
        return
    }

    guesses.push(p.short_name)
    window.localStorage?.setItem(load_time.toLocaleDateString(), JSON.stringify(guesses))

    $("#history").append(get_history_element(p))
    
    $("#input").value = ""
    $("#status").innerHTML = ""
})

$("#pixel").addEventListener("click", () => {
    function rep(node) {
        for (const child of node.childNodes) {
            if (child.nodeName == "#text")
                child.textContent = child.textContent.slice(0, 2).replace(/\S/g, "█")
            else
                rep(child)
        }
    }

    rep($("#history"))
    $("#status").className = "hidden"
})

$("#unpixel").addEventListener("click", () => {
    load_history(guesses)
    $("#status").innerHTML = ""
    $("#status").className = ""
})

$("#input").addEventListener("keydown", e => {
    if (e.keyCode == 13)
        $("#submit").click()
})

$("#history").addEventListener("touchstart", e => {
    if (!e.target.className.startsWith("tag-") || !e.target.title)
        return

    $("#status").innerHTML = `${e.target.textContent}: ${e.target.title}`
})

function get_history_element(p) {
    const tags = get_tags(p)

    const result_element = document.createElement("div")

    if (p.short_name == answer.short_name) {
        result_element.innerHTML = `
            <span class="guess">${p.short_name}</span> <span class="tag-4">猜对了！</span>
        `.trim()
        $("#pixel").className = ""
        $("#unpixel").className = ""
        $("#submit").disabled = true
    } else {
        let html = `<span class="guess">${p.short_name}</span>`
        for (const tag of tags)
            html += ` <span class="tag-${tag.rarity}" title="${tag.explaination}">${tag.name}</span>`
        result_element.innerHTML = html.trim()
    }

    return result_element
}

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
        case !(dist < 1000):
            tags.push({name: "较远", rarity: 2, explaination: "该地与答案直线距离小于 1000 千米"})
            break
        default:
            tags.push({name: "很远", rarity: 1, explaination: "该地与答案直线距离大于 1000 千米"})
    }

    // 2. name
    ;(() => {
        for (const char of p.short_name) if (answer.short_name.includes(char)) {
            return tags.push({name: "同字", rarity: 4, explaination: "该地名称中有至少一字出现在答案中"})
        }

        for (const pinyin of p.pinyin) if (answer.pinyin.includes(pinyin)) {
            return tags.push({name: "同拼音", rarity: 3, explaination: "该地名称中有至少一字拼音与答案中某字拼音完全相同(含声调)"})
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
            tags.push({name: "同声母", rarity: 2, explaination: "该地名称中有至少一字拼音声母与答案中某字声母相同"})
        if (same_vowel)
            tags.push({name: "同韵母", rarity: 2, explaination: "该地名称中有至少一字拼音韵母与答案中某字韵母相同"})
        if (same_tone)
            tags.push({name: "同声调", rarity: 2, explaination: "该地名称中有至少一字拼音声调与答案中某字声调相同"})
    })()

    // 3. direction
    ;(() => {
        const [Np, Sp, Wp, Ep] = min_bound_box(p)
        const [Na, Sa, Wa, Ea] = min_bound_box(answer)
        Np < Sa ? tags.push({name: "偏南", rarity: 2, explaination: "该地在答案南边"}) :
        Sp > Na ? tags.push({name: "偏北", rarity: 2, explaination: "该地在答案北边"}) :
                  tags.push({name: "同纬", rarity: 3, explaination: "该地与答案纬度相近"})

        Ep < Wa ? tags.push({name: "偏西", rarity: 2, explaination: "该地在答案西边"}) :
        Wp > Ea ? tags.push({name: "偏东", rarity: 2, explaination: "该地在答案东边"}) :
                  tags.push({name: "同经", rarity: 3, explaination: "该地与答案经度相近"})
    })()

    return tags
}

function load_history(guesses) {
    $("#history").innerHTML = ""
    for (const short_name of guesses) {
        $("#history").append(get_history_element(place_index[short_name]))
    }
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

function min_bound_box(p) {
    let N = -Infinity, S = Infinity, W = Infinity, E = -Infinity
    for (const coordinate of p.geometry.coordinates) for (const [lon, lat] of coordinate) {
        if (lat < S) S = lat
        if (lat > N) N = lat
        if (lon < W) W = lon
        if (lon > E) E = lon
    }
    return [N, S, W, E]
}

function split_pinyin(pinyin) {
    const consonants = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "r", "x", "w", "y", "zh", "ch", "sh", "z", "c", "s"]
    const consonant = consonants.find(x => pinyin.startsWith(x)) ?? ""
    const vowel = pinyin.slice(consonant.length, -1)
    const tone = pinyin[pinyin.length - 1]
    return { consonant, vowel, tone }
}

load_history(guesses)