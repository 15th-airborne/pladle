const $ = document.querySelector.bind(document)

const place_index = {}
for (place of places)
    place_index[place.short_name] = place

const load_time = new Date
const load_date_str = (load_time).toLocaleDateString()

const records = JSON.parse(window.localStorage?.getItem("records") ?? "{}")

const answer = records[load_date_str]?.answer ? place_index[records[load_date_str].answer] : places[(date => {
    const x = date.getFullYear() * 2
            + date.getMonth() * 14207929
            + date.getDay() * 36189529
    return (x * x) % 236573 * 287281 + x * 457979
})(load_time) % places.length]

if (!records[load_date_str])
    records[load_date_str] = { guesses: [], answer: answer.short_name }
const record_today = records[load_date_str]

const status = {
    el: $("#status"),
    locked: false,

    set(msg) {
        if (!this.locked)
            this.el.textContent = msg
    },

    lock() {
        this.clear()
        this.locked = true
    },

    unlock() {
        this.locked = false
    },

    clear() {
        this.el.textContent = ""
    }
}

const stat = {
    set_stat() {
        const hist = []

        for (const date_str in records) if (records[date_str].finish_time)
            hist.push(records[date_str])

        if (hist.length == 0)
            return

        const avg_time = hist
            .map(x => (x.finish_time - x.start_time) / 1000)
            .reduce((x, y) => x + y)
            / hist.length
        const avg_guesses = hist
            .map(x => x.guesses.length)
            .reduce((x, y) => x + y)
            / hist.length

        $("#stat-hist").textContent = `您已完成 ${hist.length} 次，平均耗时 ${avg_time.toFixed(2)}s，平均猜测次数：${avg_guesses.toFixed(2)}（含猜中那次）`
        $("#stat-hist").className = ""
    },

    start_ticking() {
        if (this.ticking_handler)
            return

        if (!record_today.start_time) {
            record_today.start_time = +new Date
            save_records()
        }

        this.ticking_handler = setInterval(this.tick.bind(this), 1000)
        this.tick()
    },

    stop_ticking() {
        if (!record_today.finish_time) {
            record_today.finish_time = +new Date
            save_records()
        }

        clearInterval(this.ticking_handler)
        this.set_stat()
    },

    tick() {
        const now = record_today.finish_time ?? +new Date
        const seconds = Math.round((now - record_today.start_time) / 1000)
        $("#time").textContent =
            seconds > 3600 ? `>1h` :
            seconds >   60 ? `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s` :
                             `${seconds}s`
        $("#stat-today").className = ""
    },
}

$("#submit").addEventListener("click", () => {
    const p = place_index[$("#input").value]
    if (!p)
        return status.set(`查无此地。（提示：注意规则前两条）`)

    if (record_today.guesses.includes(p.short_name))
        return status.set(`猜过了`)

    record_today.guesses.push(p.short_name)
    save_records()

    put_history(p)

    $("#input").value = ""
    status.clear()
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
    status.lock()
})

$("#unpixel").addEventListener("click", () => {
    load_history()
    status.unlock()
})

$("#input").addEventListener("keydown", e => {
    if (e.keyCode == 13)
        $("#submit").click()
})

$("#history").addEventListener("touchstart", e => {
    if (!e.target.className.startsWith("tag-") || !e.target.title)
        return

    status.set(`${e.target.textContent}: ${e.target.title}`)
})

function save_records() {
    window.localStorage?.setItem("records", JSON.stringify(records))
}

function put_history(p) {
    const tags = get_tags(p)

    const result_element = document.createElement("div")

    if (p.short_name == answer.short_name) {
        result_element.innerHTML = `
            <span class="guess">${p.short_name}</span> <span class="tag-4">猜对了！</span>
        `.trim()
        $("#pixel").className = ""
        $("#unpixel").className = ""
        $("#submit").disabled = true
        stat.stop_ticking()
    } else {
        let html = `<span class="guess">${p.short_name}</span>`
        for (const tag of tags)
            html += ` <span class="tag-${tag.rarity}" title="${tag.explaination}">${tag.name}</span>`
        result_element.innerHTML = html.trim()
        stat.start_ticking()
    }

    $("#history").append(result_element)
}

function get_tags(p) {
    let tags = []

    // 1. distance
    const dist = distance(p, answer)
    console.log(dist)
    switch (false) {
        case !(dist < 1):
            tags.push({name: "相邻", rarity: 4, explaination: "该地与答案有共同边界或重合（如行政区划级别不同）"})
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

function load_history() {
    $("#history").innerHTML = ""
    for (const short_name of record_today.guesses)
        put_history(place_index[short_name])
}

function* vertices(p) {
    switch (p.geometry.type) {
        case "MultiPolygon":
            for (const polygon of p.geometry.coordinates)
                for (const coordinate of polygon)
                    for (const point of coordinate)
                        yield point
            break
        case "Polygon":
            for (const coordinate of p.geometry.coordinates)
                for (const point of coordinate)
                    yield point
            break
        default:
            throw "unknown geometry type"
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
    for (const point_a of vertices(a)) {
        for (const point_b of vertices(b)) {
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
    for (const [lon, lat] of vertices(p)) {
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

load_history()
stat.set_stat()
