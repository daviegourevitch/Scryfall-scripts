import fs from 'fs';
import fetch from 'node-fetch';

const WAIT_TIME = 100;
const VERBOSE = false;

async function main() {
    try {
        const cardNames = fs.readFileSync('./Pauper Cube Lists/ThePauperCube.txt', 'utf8').split('\n').map(line => line.trim().replace("\r", "")).filter(line => line.length > 0 && !line.startsWith('#'));
        const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
        const cardsBySet = groupCardsBySet(cardNames, data);
        writeCardsBySetCSV(cardsBySet, data);
        writeCardsByNameCSV(cardNames, data);
        console.log('Done!');
    } catch (e) {
        console.error(e);
    }
}


function groupCardsBySet(cardNames, queryResults) {
    const cardsBySet = {};
    cardNames.forEach(cardName => {
        try {
            const card = queryResults[cardName];
            if (!card) {
                console.error(`Card not found: ${cardName}`);
                return;
            }
            for (const printing of card.data) {
                printing.numberOfCubes = card.numberOfCubes;
                if (cardsBySet[printing.set_name]) {
                    cardsBySet[printing.set_name].push(printing);
                } else {
                    cardsBySet[printing.set_name] = [printing];
                }
            }
        } catch (e) {
            console.error(`Error processing ${cardName}`);
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

function writeCardsBySetCSV(cardsBySet) {
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
                card.numberOfCubes,
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

function writeCardsByNameCSV(cardNames, data) {
    const headers = [
        "Card Name",
        "# Cubes",
        "Sets",
        "Mana Cost",
        "Type",
    ];
    const rows = [];
    cardNames.forEach(cardName => {
        const printings = data[cardName];
        if (!printings) {
            console.error(`Card not found: ${cardName}`);
            return;
        }
        rows.push([
            cardName.replace(",", ".").replace("—", "-"),
            printings.numberOfCubes,
            printings.data.map(printing => printing.set_name).join(" "),
            printings.data[0].mana_cost,
            printings.data[0].type_line,
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