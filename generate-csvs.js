import fs from 'fs';
import fetch from 'node-fetch';

const WAIT_TIME = 100;
const VERBOSE = false;

async function main() {
    try {
        const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
        const cardsBySet = groupCardsBySet(data);
        // write results to a json file in case we want to use it later
        writeCardsBySetCSV(cardsBySet, cardNames);
        const cardsByName = groupCardsByName(data);
        writeCardsByNameCSV(cardsByName, cardNames);
        console.log('Done!');
    } catch (e) {
        console.error(e);
    }
}


function groupCardsBySet(queryResults) {
    const cardsBySet = {};
    queryResults.forEach(result => {
        try {
            result.data?.forEach(card => {
                if (shouldIgnoreCard(card)) {
                    return;
                }
                if (cardsBySet[card.set_name]) {
                    cardsBySet[card.set_name].push(card);
                } else {
                    cardsBySet[card.set_name] = [card];
                }
            });
        } catch (e) {
            console.error(`Error processing ${result}`);
            console.log({result});
            console.error(e);
        }
    });
    for (const set of Object.keys(cardsBySet)) {
        // remove duplicates
        cardsBySet[set] = cardsBySet[set].filter((card, index, self) => {
            return self.findIndex(c => c.name === card.name) === index;
        });
    }
    const setsToIgnore = [
        "Summer Magic / Edgar",
        "Mystery Booster",
        "The List",
        "Limited Edition Alpha",
        "Limited Edition Beta",
        "Unlimited Edition",
    ];
    for (const set of Object.keys(cardsBySet)) {
        if (setsToIgnore[set]) {
            delete cardsBySet[set];
        }
    }
    for (const set of Object.keys(cardsBySet)) {
        cardsBySet[set].sort((a, b) => {
            // sort by collector's number
            return parseInt(a.collector_number) - parseInt(b.collector_number);
        });
    }
    return cardsBySet;
}

function shouldIgnoreCard(card) {
    // ignore cards that are not in paper
    if (card.digital) {
        return true;
    }
    // ignore cards that are not in English
    if (card.lang !== "en") {
        return true;
    }
    // ignore set types that we don't care about
    if (["masterpiece", "alchemy", "memorabilia"].includes(card.set_type)) {
        return true;
    }
    return false;
}

function writeCardsBySetCSV(cardsBySet, cardsByCubes) {
    const headers = [
        "Set",
        "Release Date",
        "Card Name",
        "# Cubes",
        "Card No.",
        "Mana Cost",
        "Type",
        "Rarity",
        "Price"
    ];
    const rows = [];
    Object.keys(cardsBySet).forEach(set => {
        cardsBySet[set].forEach(card => {
            rows.push([
                card.set_name,
                card.released_at,
                card.name.replace(",", ".").replace("—", "-"),
                cardsByCubes[card.name] || 0,
                card.collector_number,
                card.mana_cost,
                card.type_line,
                card.rarity,
                card.prices.usd,
            ]);
        });
    });
    // sort by release date, oldest to newest then by collector's number
    rows.sort((a, b) => {
        if (a[1] === b[1]) {
            return parseInt(a[4]) - parseInt(b[4]);
        }
        return new Date(a[1]) - new Date(b[1]);
    });
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    fs.writeFileSync('./cards-by-set.csv', csv);
}

function groupCardsByName(queryResults) {
    const cardsByName = {};
    queryResults.forEach(result => {
        try {
            result.data?.forEach(card => {
                if (cardsByName[card.name]) {
                    cardsByName[card.name].push(card);
                } else {
                    cardsByName[card.name] = [card];
                }
            });
        } catch (e) {
            console.error(`Error processing ${result}`);
            console.log({result});
            console.error(e);
        }
    });
    for (const name of Object.keys(cardsByName)) {
        // remove duplicates
        cardsByName[name] = cardsByName[name].filter((card, index, self) => {
            return self.findIndex(c => c.set_name === card.set_name) === index;
        });
    }
    return cardsByName;
}

function writeCardsByNameCSV(cardsByName, cardsByCubes) {
    const headers = [
        "Card Name",
        "# Cubes",
        "Sets",
        "Mana Cost",
        "Type",
    ];
    const rows = [];
    Object.keys(cardsByName).forEach(name => {
        rows.push([
            name.replace(",", ".").replace("—", "-"),
            cardsByCubes[name] || 0,
            cardsByName[name].map(card => card.set_name).join(" "),
            cardsByName[name][0].mana_cost,
            cardsByName[name][0].type_line,
        ]);
    });
    // sort by name
    rows.sort((a, b) => {
        return a[0].localeCompare(b[0]);
    });
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    fs.writeFileSync('./cards-by-name.csv', csv);
}

main();